import { eq, and, desc, sql, or, inArray, lte, gt, isNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import path from "path";
import { unlink } from "fs/promises";
import { db } from "../../database/index.js";
import {
  announcements,
  announcementAttachments,
  announcementReads,
  courses,
  users,
  courseEnrollments,
  notifications,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";
import { sendEmail } from "../../services/email.service.js";
import {
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  ListAnnouncementQuery,
} from "./announcements.schema.js";

const logger = createChildLogger("announcements-service");

type Actor = { userId: string; role: string };

type UploadedFile = {
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
};

const MANAGER_ROLES = ["ADMIN", "PROGRAM_COORDINATOR"];
const TEACHER_ROLES = ["INSTRUCTOR", "CLINICAL_INSTRUCTOR"];

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

const STORAGE_BASE = path.resolve(process.cwd(), "../storage");

function isManager(actor?: Actor) {
  return !!actor && MANAGER_ROLES.includes(actor.role);
}

function isTeacher(actor?: Actor) {
  return !!actor && TEACHER_ROLES.includes(actor.role);
}

/** Effective visibility: published, started (or no publish date), not expired. */
function effectiveConditions(now: Date): SQL[] {
  return [
    eq(announcements.status, "PUBLISHED"),
    or(isNull(announcements.publishAt), lte(announcements.publishAt, now))!,
    or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now))!,
  ];
}

function effectiveNow(
  item: { status: string; publishAt: Date | null; expiresAt: Date | null },
  now: Date
) {
  if (item.status !== "PUBLISHED") return false;
  if (item.publishAt && item.publishAt > now) return false;
  if (item.expiresAt && item.expiresAt <= now) return false;
  return true;
}

async function taughtCourseIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.instructorId, userId));
  return rows.map((r) => r.id);
}

async function enrolledCourseIds(studentId: string): Promise<string[]> {
  const rows = await db
    .select({ courseId: courseEnrollments.courseId })
    .from(courseEnrollments)
    .where(
      and(
        eq(courseEnrollments.studentId, studentId),
        eq(courseEnrollments.isActive, true)
      )
    );
  return [...new Set(rows.map((r) => r.courseId))];
}

/**
 * Ownership gate for writes. Managers act everywhere; instructors and clinical
 * instructors only on their own courses' announcements (never institution-wide).
 */
async function assertManageAccess(
  item: { courseId: string | null },
  actor?: Actor
) {
  if (!actor) throw new ForbiddenError("Not allowed");
  if (isManager(actor)) return;
  if (isTeacher(actor)) {
    if (!item.courseId) {
      throw new ForbiddenError(
        "Institution-wide announcements can only be managed by coordinators and admins"
      );
    }
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, item.courseId));
    if (!course || course.instructorId !== actor.userId) {
      throw new ForbiddenError(
        "You can only manage announcements for your own courses"
      );
    }
    return;
  }
  throw new ForbiddenError("Not allowed");
}

async function unlinkStoredFile(filePath: string) {
  try {
    const rel = filePath.replace(/^\/?storage\//, "").replace(/^\//, "");
    if (!rel || rel.includes("..")) return;
    await unlink(path.join(STORAGE_BASE, rel));
  } catch {
    // Best effort — orphaned files are harmless.
  }
}

// ─── Queries ────────────────────────────────────────────────────────────────

export async function listAnnouncements(
  query: ListAnnouncementQuery,
  actor?: Actor
) {
  const { page, limit, courseId, instructorId, status } = query;
  const publishedOnly = query.publishedOnly === "true";
  const unreadOnly = query.unreadOnly === "true";
  const offset = (page - 1) * limit;
  const now = new Date();
  const conditions: SQL[] = [];

  if (publishedOnly) conditions.push(...effectiveConditions(now));
  if (status) conditions.push(eq(announcements.status, status));
  if (unreadOnly && actor) {
    // Dashboard feed: only announcements this user has NOT read yet, filtered
    // in SQL so the limit/pagination stay correct (older unread rows can
    // still surface once the newer ones have been read).
    conditions.push(
      sql`NOT EXISTS (
        SELECT 1 FROM announcement_reads ar
        WHERE ar.announcement_id = ${announcements.id}
          AND ar.user_id = ${actor.userId}
      )`
    );
    // Your own posts count as read, matching the list's `read` flag.
    conditions.push(
      sql`${announcements.createdBy} IS DISTINCT FROM ${actor.userId}`
    );
  }
  if (courseId) conditions.push(eq(announcements.courseId, courseId));
  if (instructorId) {
    // Institution-wide rows have no course to join on (course_id IS NULL);
    // the filter must not hide them from the requesting instructor.
    conditions.push(
      or(isNull(announcements.courseId), eq(courses.instructorId, instructorId))!
    );
  }

  if (actor && !isManager(actor)) {
    if (actor.role === "STUDENT") {
      // Students only ever see live announcements aimed at them
      // (institution-wide or for a course they are enrolled in).
      conditions.push(
        ...effectiveConditions(now),
        eq(announcements.audienceStudents, true)
      );
      const enrolled = await enrolledCourseIds(actor.userId);
      conditions.push(
        or(
          isNull(announcements.courseId),
          enrolled.length > 0
            ? inArray(announcements.courseId, enrolled)
            : sql`false`
        )!
      );
    } else if (isTeacher(actor)) {
      // Teachers see all statuses on their own courses, plus live
      // institution-wide announcements targeted at instructors.
      const taught = await taughtCourseIds(actor.userId);
      const own = taught.length > 0
        ? inArray(announcements.courseId, taught)
        : sql`false`;
      const globalStaff = and(
        isNull(announcements.courseId),
        eq(announcements.audienceInstructors, true),
        ...(publishedOnly ? [] : effectiveConditions(now))
      )!;
      conditions.push(or(own, globalStaff)!);
    } else {
      throw new ForbiddenError("Not allowed");
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(announcements)
    .leftJoin(courses, eq(announcements.courseId, courses.id))
    .where(where);

  const selectColumns = {
    id: announcements.id,
    courseId: announcements.courseId,
    title: announcements.title,
    content: announcements.content,
    priority: announcements.priority,
    status: announcements.status,
    audienceStudents: announcements.audienceStudents,
    audienceInstructors: announcements.audienceInstructors,
    publishAt: announcements.publishAt,
    expiresAt: announcements.expiresAt,
    isPublished: announcements.isPublished,
    createdBy: announcements.createdBy,
    createdAt: announcements.createdAt,
    updatedAt: announcements.updatedAt,
    courseName: courses.name,
    courseCode: courses.code,
    authorFirstName: users.firstName,
    authorLastName: users.lastName,
    authorEmail: users.email,
  };

  const items = await db
    .select(selectColumns)
    .from(announcements)
    .leftJoin(courses, eq(announcements.courseId, courses.id))
    .leftJoin(users, eq(announcements.createdBy, users.id))
    .where(where)
    .orderBy(desc(announcements.createdAt))
    .limit(limit)
    .offset(offset);

  const attachments =
    items.length > 0
      ? await db
          .select()
          .from(announcementAttachments)
          .where(
            inArray(
              announcementAttachments.announcementId,
              items.map((i) => i.id)
            )
          )
      : [];
  const grouped = new Map<string, typeof attachments>();
  for (const a of attachments) {
    const list = grouped.get(a.announcementId) ?? [];
    list.push(a);
    grouped.set(a.announcementId, list);
  }

  // Receiver read-state for the current user (your own posts count as read).
  const ids = items.map((i) => i.id);
  const readSet = new Set<string>();
  if (actor && ids.length > 0) {
    const mine = await db
      .select({ announcementId: announcementReads.announcementId })
      .from(announcementReads)
      .where(
        and(
          inArray(announcementReads.announcementId, ids),
          eq(announcementReads.userId, actor.userId)
        )
      );
    for (const r of mine) readSet.add(r.announcementId);
  }

  // Sender receipts — "X of Y read". Visible to coordinators/admins (all
  // items) and to each publisher (their own items); receivers never see it.
  const statsById = new Map<
    string,
    { readCount: number; receiverCount: number }
  >();
  const statItems = items.filter(
    (i) => !!actor && (isManager(actor) || i.createdBy === actor.userId)
  );
  if (statItems.length > 0) {
    const statIds = statItems.map((i) => i.id);
    const authorIds = [...new Set(statItems.map((i) => i.createdBy))];
    const authors = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(inArray(users.id, authorIds));
    const roleById = new Map(authors.map((a) => [a.id, a.role]));

    // Receiver sets vary only by course × audience × author-role — dedupe by
    // that key so a page of similar announcements computes each combo once.
    const comboKey = (i: (typeof items)[number]) =>
      `${i.courseId ?? "global"}|${i.audienceStudents}|${
        i.audienceInstructors
      }|${TEACHER_ROLES.includes(roleById.get(i.createdBy) ?? "") ? "T" : "M"}`;
    const receiversByCombo = new Map<string, Set<string>>();
    for (const i of statItems) {
      const key = comboKey(i);
      if (receiversByCombo.has(key)) continue;
      const { audience, oversight } = await computeReceivers({
        courseId: i.courseId,
        audienceStudents: i.audienceStudents,
        audienceInstructors: i.audienceInstructors,
        createdBy: i.createdBy,
      });
      receiversByCombo.set(
        key,
        new Set([...audience, ...oversight].map((r) => r.id))
      );
    }

    const allReceiverIds = new Set<string>();
    for (const set of receiversByCombo.values()) {
      for (const uid of set) allReceiverIds.add(uid);
    }
    const readPairs =
      allReceiverIds.size > 0
        ? await db
            .select({
              announcementId: announcementReads.announcementId,
              userId: announcementReads.userId,
            })
            .from(announcementReads)
            .where(
              and(
                inArray(announcementReads.announcementId, statIds),
                inArray(announcementReads.userId, [...allReceiverIds])
              )
            )
        : [];
    const readersByItem = new Map<string, Set<string>>();
    for (const p of readPairs) {
      const set = readersByItem.get(p.announcementId) ?? new Set<string>();
      set.add(p.userId);
      readersByItem.set(p.announcementId, set);
    }
    for (const i of statItems) {
      const receivers = receiversByCombo.get(comboKey(i));
      const readers = readersByItem.get(i.id);
      let readCount = 0;
      if (receivers && readers) {
        for (const uid of readers) {
          if (receivers.has(uid)) readCount++;
        }
      }
      statsById.set(i.id, {
        readCount,
        receiverCount: receivers?.size ?? 0,
      });
    }
  }

  return {
    items: items.map((i) => ({
      ...i,
      attachments: grouped.get(i.id) ?? [],
      read: i.createdBy === (actor?.userId ?? "") || readSet.has(i.id),
      stats: statsById.get(i.id),
    })),
    pagination: {
      page,
      limit,
      total: countResult.count,
      totalPages: Math.ceil(countResult.count / limit),
    },
  };
}

export async function getAnnouncementById(id: string, actor?: Actor) {
  const [item] = await db
    .select({
      id: announcements.id,
      courseId: announcements.courseId,
      title: announcements.title,
      content: announcements.content,
      priority: announcements.priority,
      status: announcements.status,
      audienceStudents: announcements.audienceStudents,
      audienceInstructors: announcements.audienceInstructors,
      publishAt: announcements.publishAt,
      expiresAt: announcements.expiresAt,
      isPublished: announcements.isPublished,
      createdBy: announcements.createdBy,
      createdAt: announcements.createdAt,
      updatedAt: announcements.updatedAt,
      courseName: courses.name,
      courseCode: courses.code,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorEmail: users.email,
    })
    .from(announcements)
    .leftJoin(courses, eq(announcements.courseId, courses.id))
    .leftJoin(users, eq(announcements.createdBy, users.id))
    .where(eq(announcements.id, id));

  if (!item) {
    throw new NotFoundError("Announcement");
  }

  if (actor && !isManager(actor)) {
    const now = new Date();
    let visible = false;
    if (actor.role === "STUDENT") {
      visible =
        effectiveNow(item, now) &&
        item.audienceStudents === true &&
        (item.courseId === null ||
          (await enrolledCourseIds(actor.userId)).includes(item.courseId));
    } else if (isTeacher(actor)) {
      const taught = await taughtCourseIds(actor.userId);
      visible =
        (item.courseId !== null && taught.includes(item.courseId)) ||
        (item.courseId === null &&
          item.audienceInstructors === true &&
          effectiveNow(item, now));
    }
    if (!visible) {
      throw new ForbiddenError(
        "You do not have access to this announcement"
      );
    }
  }

  const attachments = await db
    .select()
    .from(announcementAttachments)
    .where(eq(announcementAttachments.announcementId, id));

  return { ...item, attachments };
}

// ─── Read receipts ──────────────────────────────────────────────────────────

/**
 * Receiver marks the announcement as read. Idempotent — the first read time is
 * kept — and it clears the receiver's bell notification for the same
 * announcement. Visibility is enforced by getAnnouncementById (404/403).
 */
export async function markAnnouncementRead(id: string, actor: Actor) {
  await getAnnouncementById(id, actor);

  const [existing] = await db
    .select({ readAt: announcementReads.readAt })
    .from(announcementReads)
    .where(
      and(
        eq(announcementReads.announcementId, id),
        eq(announcementReads.userId, actor.userId)
      )
    );

  let readAt = existing?.readAt;
  if (!readAt) {
    const [row] = await db
      .insert(announcementReads)
      .values({ announcementId: id, userId: actor.userId })
      .onConflictDoNothing()
      .returning();
    readAt = row?.readAt ?? new Date();
  }

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.relatedId, id),
        eq(notifications.userId, actor.userId),
        eq(notifications.type, "ANNOUNCEMENT")
      )
    );

  return { read: true, readAt };
}

/**
 * Per-receiver breakdown for the sender: every current receiver with their
 * own read state, split into read (newest first, with timestamps) and not
 * yet read (alphabetical). Each entry carries the receiver's role so the UI
 * can present students and instructors separately. Long name lists are
 * capped; counts always reflect the full totals. Only the publisher,
 * coordinators and admins may see it.
 */
export async function getAnnouncementReceipts(id: string, actor: Actor) {
  const item = await getAnnouncementById(id, actor);

  if (!(isManager(actor) || item.createdBy === actor.userId)) {
    throw new ForbiddenError(
      "Only the publisher, coordinators and admins can see read receipts"
    );
  }

  const { audience, oversight } = await computeReceivers(item);
  const byId = new Map<string, Receiver>();
  for (const r of [...audience, ...oversight]) byId.set(r.id, r);
  const receivers = [...byId.values()];

  const receiverIds = receivers.map((r) => r.id);
  const readRows =
    receiverIds.length > 0
      ? await db
          .select({
            userId: announcementReads.userId,
            readAt: announcementReads.readAt,
          })
          .from(announcementReads)
          .where(
            and(
              eq(announcementReads.announcementId, id),
              inArray(announcementReads.userId, receiverIds)
            )
          )
      : [];
  const readAtBy = new Map(readRows.map((r) => [r.userId, r.readAt]));

  // Role per receiver so the sender can separate students from instructors.
  const roleRows =
    receiverIds.length > 0
      ? await db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(inArray(users.id, receiverIds))
      : [];
  const roleById = new Map(roleRows.map((u) => [u.id, u.role]));

  const read = receivers
    .filter((r) => readAtBy.has(r.id))
    .map((r) => ({
      userId: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      role: roleById.get(r.id) ?? "",
      readAt: readAtBy.get(r.id)!,
    }))
    .sort((a, b) => b.readAt.getTime() - a.readAt.getTime());

  const unread = receivers
    .filter((r) => !readAtBy.has(r.id))
    .map((r) => ({
      userId: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      role: roleById.get(r.id) ?? "",
    }))
    .sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(
        `${b.firstName} ${b.lastName}`
      )
    );

  const CAP = 200;
  return {
    receiverCount: receivers.length,
    readCount: read.length,
    unreadCount: unread.length,
    read: read.slice(0, CAP),
    unread: unread.slice(0, CAP),
    truncated: read.length > CAP || unread.length > CAP,
  };
}

// ─── Workflow: DRAFT → PUBLISHED → ARCHIVED ─────────────────────────────────

export async function createAnnouncement(
  data: CreateAnnouncementInput,
  actor: Actor
) {
  const courseId = data.courseId ?? null;

  if (isTeacher(actor)) {
    if (!courseId) {
      throw new ForbiddenError(
        "Only coordinators and admins can post institution-wide announcements"
      );
    }
    if (data.audienceInstructors) {
      throw new ForbiddenError(
        "Only coordinators and admins can target the instructor audience"
      );
    }
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId));
    if (!course) throw new NotFoundError("Course");
    if (course.instructorId !== actor.userId) {
      throw new ForbiddenError(
        "You can only announce to your own courses"
      );
    }
  }

  const audienceStudents = data.audienceStudents ?? true;
  const audienceInstructors = data.audienceInstructors ?? false;
  if (!audienceStudents && !audienceInstructors) {
    throw new ValidationError({ audienceStudents: ["Select at least one audience"] });
  }

  // Explicit status wins; legacy isPublished maps to PUBLISHED/DRAFT; default is DRAFT.
  const status = data.status ?? (data.isPublished ? "PUBLISHED" : "DRAFT");

  const [newAnnouncement] = await db
    .insert(announcements)
    .values({
      courseId,
      title: data.title,
      content: data.content,
      priority: data.priority,
      status,
      audienceStudents,
      audienceInstructors,
      publishAt: data.publishAt ?? null,
      expiresAt: data.expiresAt ?? null,
      isPublished: status === "PUBLISHED",
      createdBy: actor.userId,
    })
    .returning();

  await logAudit({
    userId: actor.userId,
    action: "CREATE_ANNOUNCEMENT",
    resource: "ANNOUNCEMENT",
    resourceId: newAnnouncement.id,
    metadata: {
      title: data.title,
      courseId,
      status,
      audienceStudents,
      audienceInstructors,
    },
  });

  logger.info({ announcementId: newAnnouncement.id }, "Announcement created");

  if (effectiveNow(newAnnouncement, new Date())) {
    await sendAnnouncementNotifications(newAnnouncement, actor.userId);
  }

  return newAnnouncement;
}

export async function updateAnnouncement(
  id: string,
  data: UpdateAnnouncementInput,
  actor: Actor
) {
  const [existing] = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, id));

  if (!existing) {
    throw new NotFoundError("Announcement");
  }
  await assertManageAccess(existing, actor);

  let nextStatus = existing.status;
  if (data.status !== undefined) {
    nextStatus = data.status;
  } else if (data.isPublished !== undefined) {
    nextStatus = data.isPublished ? "PUBLISHED" : "DRAFT";
  }
  if (
    nextStatus !== existing.status &&
    !ALLOWED_TRANSITIONS[existing.status]?.includes(nextStatus)
  ) {
    throw new ValidationError({
      status: [`Invalid status change from ${existing.status} to ${nextStatus}`],
    });
  }

  const audienceStudents = data.audienceStudents ?? existing.audienceStudents;
  const audienceInstructors =
    data.audienceInstructors ?? existing.audienceInstructors;
  if (!audienceStudents && !audienceInstructors) {
    throw new ValidationError({ audienceStudents: ["Select at least one audience"] });
  }

  const courseId =
    data.courseId !== undefined ? data.courseId : existing.courseId;

  if (isTeacher(actor)) {
    if (!courseId) {
      throw new ForbiddenError(
        "Institution-wide announcements can only be managed by coordinators and admins"
      );
    }
    if (courseId !== existing.courseId) {
      const [target] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, courseId));
      if (!target || target.instructorId !== actor.userId) {
        throw new ForbiddenError(
          "You can only announce to your own courses"
        );
      }
    }
    if (audienceInstructors && !existing.audienceInstructors) {
      throw new ForbiddenError(
        "Only coordinators and admins can target the instructor audience"
      );
    }
  }

  const publishAt =
    data.publishAt !== undefined ? data.publishAt : existing.publishAt;
  const expiresAt =
    data.expiresAt !== undefined ? data.expiresAt : existing.expiresAt;
  if (
    publishAt &&
    expiresAt &&
    publishAt.getTime() >= expiresAt.getTime()
  ) {
    throw new ValidationError({
      publishAt: ["Publish date must be before the expiry date"],
    });
  }

  const [updated] = await db
    .update(announcements)
    .set({
      courseId,
      title: data.title ?? existing.title,
      content: data.content ?? existing.content,
      priority: data.priority ?? existing.priority,
      audienceStudents,
      audienceInstructors,
      status: nextStatus,
      publishAt,
      expiresAt,
      isPublished: nextStatus === "PUBLISHED",
      updatedAt: new Date(),
    })
    .where(eq(announcements.id, id))
    .returning();

  await logAudit({
    userId: actor.userId,
    action: "UPDATE_ANNOUNCEMENT",
    resource: "ANNOUNCEMENT",
    resourceId: id,
    metadata: {
      changes: {
        ...data,
        publishAt: publishAt ?? null,
        expiresAt: expiresAt ?? null,
      },
      fromStatus: existing.status,
      toStatus: nextStatus,
    },
  });

  logger.info({ announcementId: id }, "Announcement updated");

  // Notify only when the announcement newly becomes effectively visible.
  if (
    existing.status !== "PUBLISHED" &&
    nextStatus === "PUBLISHED" &&
    effectiveNow(updated, new Date())
  ) {
    await sendAnnouncementNotifications(updated, actor.userId);
  }

  return updated;
}

export async function deleteAnnouncement(id: string, actor: Actor) {
  const [existing] = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, id));

  if (!existing) {
    throw new NotFoundError("Announcement");
  }
  await assertManageAccess(existing, actor);

  const attachments = await db
    .select()
    .from(announcementAttachments)
    .where(eq(announcementAttachments.announcementId, id));

  await db.delete(announcements).where(eq(announcements.id, id));
  // relatedId has no FK cascade — drop the announcement's bell notifications too.
  await db.delete(notifications).where(eq(notifications.relatedId, id));
  for (const a of attachments) {
    await unlinkStoredFile(a.filePath);
  }

  await logAudit({
    userId: actor.userId,
    action: "DELETE_ANNOUNCEMENT",
    resource: "ANNOUNCEMENT",
    resourceId: id,
    metadata: { title: existing.title, courseId: existing.courseId },
  });

  logger.info({ announcementId: id }, "Announcement deleted");
}

// ─── Attachments ────────────────────────────────────────────────────────────

export async function addAttachments(
  announcementId: string,
  files: UploadedFile[],
  actor: Actor
) {
  const [existing] = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, announcementId));

  if (!existing) throw new NotFoundError("Announcement");
  await assertManageAccess(existing, actor);
  if (!files || files.length === 0) {
    throw new ValidationError({ files: ["No files provided"] });
  }

  const rows = await db
    .insert(announcementAttachments)
    .values(
      files.map((f) => ({
        announcementId,
        fileName: f.originalname,
        filePath: `/storage/documents/${f.filename}`,
        mimeType: f.mimetype,
        sizeBytes: f.size,
        uploadedBy: actor.userId,
      }))
    )
    .returning();

  await logAudit({
    userId: actor.userId,
    action: "UPDATE_ANNOUNCEMENT",
    resource: "ANNOUNCEMENT",
    resourceId: announcementId,
    metadata: { attached: files.map((f) => f.originalname) },
  });

  logger.info(
    { announcementId, count: files.length },
    "Announcement attachments added"
  );

  return rows;
}

export async function removeAttachment(
  announcementId: string,
  attachmentId: string,
  actor: Actor
) {
  const [existing] = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, announcementId));

  if (!existing) throw new NotFoundError("Announcement");
  await assertManageAccess(existing, actor);

  const [attachment] = await db
    .select()
    .from(announcementAttachments)
    .where(
      and(
        eq(announcementAttachments.id, attachmentId),
        eq(announcementAttachments.announcementId, announcementId)
      )
    );

  if (!attachment) throw new NotFoundError("Attachment");

  await db
    .delete(announcementAttachments)
    .where(eq(announcementAttachments.id, attachmentId));
  await unlinkStoredFile(attachment.filePath);

  await logAudit({
    userId: actor.userId,
    action: "UPDATE_ANNOUNCEMENT",
    resource: "ANNOUNCEMENT",
    resourceId: announcementId,
    metadata: { detached: attachment.fileName },
  });

  logger.info({ announcementId, attachmentId }, "Announcement attachment removed");
}

// ─── Notifications ──────────────────────────────────────────────────────────

type Receiver = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type ReceiverSource = Pick<
  typeof announcements.$inferSelect,
  "courseId" | "audienceStudents" | "audienceInstructors" | "createdBy"
>;

/**
 * Who an announcement reaches — single source of truth shared by the publish
 * fan-out, list stats and read receipts:
 *   audience  = students (all active, or enrolled for a course) and/or
 *               instructors (the course instructor, or all active staff),
 *               minus the author;
 *   oversight = active coordinators + admins, added when the author is an
 *               instructor so they know what went out and who posted it
 *               (bell only — they never receive the audience email).
 */
async function computeReceivers(announcement: ReceiverSource): Promise<{
  audience: Receiver[];
  oversight: Receiver[];
}> {
  const audience = new Map<string, Receiver>();

  if (announcement.audienceStudents) {
    if (announcement.courseId) {
      const enrolled = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(courseEnrollments)
        .innerJoin(users, eq(courseEnrollments.studentId, users.id))
        .where(
          and(
            eq(courseEnrollments.courseId, announcement.courseId),
            eq(courseEnrollments.isActive, true),
            eq(users.isActive, true)
          )
        );
      for (const r of enrolled) audience.set(r.id, r);
    } else {
      const all = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .where(and(eq(users.role, "STUDENT"), eq(users.isActive, true)));
      for (const r of all) audience.set(r.id, r);
    }
  }

  if (announcement.audienceInstructors) {
    if (announcement.courseId) {
      const [course] = await db
        .select({ instructorId: courses.instructorId })
        .from(courses)
        .where(eq(courses.id, announcement.courseId));
      if (course?.instructorId) {
        const [t] = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          })
          .from(users)
          .where(
            and(eq(users.id, course.instructorId), eq(users.isActive, true))
          );
        if (t) audience.set(t.id, t);
      }
    } else {
      const staff = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .where(
          and(
            or(
              eq(users.role, "INSTRUCTOR"),
              eq(users.role, "CLINICAL_INSTRUCTOR")
            )!,
            eq(users.isActive, true)
          )
        );
      for (const r of staff) audience.set(r.id, r);
    }
  }

  // The author is never their own receiver.
  audience.delete(announcement.createdBy);

  let oversight: Receiver[] = [];
  const [author] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, announcement.createdBy));
  if (author && TEACHER_ROLES.includes(author.role)) {
    const overseers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(
        and(
          or(eq(users.role, "PROGRAM_COORDINATOR"), eq(users.role, "ADMIN"))!,
          eq(users.isActive, true)
        )
      );
    oversight = overseers.filter((o) => o.id !== announcement.createdBy);
  }

  return { audience: [...audience.values()], oversight };
}

async function sendAnnouncementNotifications(
  announcement: typeof announcements.$inferSelect,
  publisherId: string
) {
  try {
    const { audience, oversight } = await computeReceivers(announcement);
    if (oversight.length > 0) {
      logger.info(
        {
          announcementId: announcement.id,
          authorId: announcement.createdBy,
          overseerCount: oversight.length,
        },
        "Instructor announcement surfaced to coordinators and admins"
      );
    }

    let courseName = "Institution-wide";
    if (announcement.courseId) {
      const [course] = await db
        .select({ name: courses.name })
        .from(courses)
        .where(eq(courses.id, announcement.courseId));
      courseName = course?.name || "Course";
    }

    const [publisher] = await db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, publisherId));
    const authorName = publisher
      ? `${publisher.firstName ?? ""} ${publisher.lastName ?? ""}`.trim()
      : "Staff";

    // Bell: audience ∪ oversight, minus whoever clicked publish.
    const notifyIds = new Set(audience.map((r) => r.id));
    for (const o of oversight) notifyIds.add(o.id);
    notifyIds.delete(publisherId);

    // In-app notification (header bell) — attributed to the publisher.
    const scopeLabel = announcement.courseId ? courseName : "Institution-wide";
    const body = announcement.content.replace(/\s+/g, " ").trim();
    const excerpt = body.length > 180 ? `${body.slice(0, 180)}…` : body;
    const bellTitle = `New announcement by ${authorName}: ${announcement.title}`.slice(
      0,
      255
    );
    if (notifyIds.size > 0) {
      await db.insert(notifications).values(
        [...notifyIds].map((userId) => ({
          userId,
          type: "ANNOUNCEMENT",
          title: bellTitle,
          content: `[${scopeLabel}] ${excerpt}`,
          relatedId: announcement.id,
        }))
      );
      logger.info(
        { announcementId: announcement.id, count: notifyIds.size },
        "Announcement in-app notifications created"
      );
    }

    // Email goes to the audience only (oversight is bell-only), minus the publisher.
    const emailList = audience.filter((r) => r.id !== publisherId);
    if (emailList.length === 0) return;

    const attachments = await db
      .select({ fileName: announcementAttachments.fileName })
      .from(announcementAttachments)
      .where(
        eq(announcementAttachments.announcementId, announcement.id)
      );

    const priorityLabel =
      announcement.priority === "URGENT"
        ? "[URGENT] "
        : announcement.priority === "HIGH"
        ? "[HIGH] "
        : "";
    const audienceLabel = [
      announcement.audienceStudents ? "Students" : null,
      announcement.audienceInstructors ? "Instructors" : null,
    ]
      .filter(Boolean)
      .join(" & ");

    const subject = `${priorityLabel}New Announcement: ${announcement.title} - ${courseName}`;
    const attachmentsHtml =
      attachments.length > 0
        ? `<p style="font-size: 13px; color: #555;">Attachments (${attachments.length}): ${attachments
            .map((a) => a.fileName)
            .join(", ")} — sign in to NurseLearn PH to download.</p>`
        : "";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-bottom: 2px solid #0d6efd;">
          <h2 style="margin: 0; color: #0d6efd;">NurseLearn PH</h2>
        </div>
        <div style="padding: 20px; background-color: #ffffff;">
          <h3 style="color: #333;">${priorityLabel}${announcement.title}</h3>
          <p style="color: #666; font-size: 14px;">Scope: <strong>${courseName}</strong></p>
          <p style="color: #666; font-size: 14px;">Audience: <strong>${audienceLabel}</strong></p>
          <p style="color: #666; font-size: 14px;">Priority: <strong>${announcement.priority}</strong></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <div style="color: #333; line-height: 1.6; white-space: pre-wrap;">${announcement.content}</div>
          ${attachmentsHtml}
        </div>
        <div style="padding: 16px; background-color: #f8f9fa; text-align: center;">
          <p style="color: #999; font-size: 12px;">This is an automated notification from NurseLearn PH</p>
        </div>
      </div>
    `;

    for (const r of emailList) {
      sendEmail(r.email, subject, html).catch((err) => {
        logger.error(
          { err, announcementId: announcement.id },
          "Failed to send announcement email"
        );
      });
    }

    logger.info(
      { announcementId: announcement.id, recipientCount: emailList.length },
      "Announcement notifications queued"
    );
  } catch (err) {
    logger.error(
      { err, announcementId: announcement.id },
      "Failed to send announcement notifications"
    );
  }
}
