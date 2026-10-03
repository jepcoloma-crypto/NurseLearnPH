import request from "supertest";
import fs from "fs";
import path from "path";
import { sql, inArray, eq } from "drizzle-orm";
import { app, SEED_USERS, SEED_IDS } from "./helpers.js";
import { db } from "../src/database/index.js";
import {
  announcements,
  announcementAttachments,
  notifications,
  users,
} from "../src/database/schema/index.js";

const PREFIX = "ANN-TEST ";
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const toFs = (filePath: string) =>
  path.resolve(process.cwd(), "../storage", filePath.replace(/^\/?storage\//, ""));

let coordinatorToken: string;
let instructorToken: string;
let clinicalToken: string;
let studentToken: string;
let adminToken: string;
let studentDbId: string;

async function loginAs(key: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app).post("/api/auth/login").send(SEED_USERS[key]);
  expect(res.status).toBe(200);
  return res.body.data.accessToken as string;
}

async function listTitles(token: string, qs = ""): Promise<string[]> {
  const res = await request(app)
    .get(`/api/announcements?limit=100${qs}`)
    .set(auth(token));
  expect(res.status).toBe(200);
  return (res.body.data.items as Array<{ title: string }>).map((i) => i.title);
}

beforeAll(async () => {
  coordinatorToken = await loginAs("coordinator");
  instructorToken = await loginAs("instructor");
  clinicalToken = await loginAs("clinical");
  studentToken = await loginAs("student");
  adminToken = await loginAs("admin");

  // Resolve the seed student's id from the DB — avoids a 6th login, which the
  // loginLimiter would reject after the five beforeAll logins.
  const [stuRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, "student"));
  studentDbId = stuRow.id;

  // The seed leaves courses without an assigned instructor; the own-course
  // tests below need `instructor` on the seed course. Assign it for this file
  // only (no other suite touches NUR101's instructor) and clear it in afterAll.
  const assign = await request(app)
    .put(`/api/academic/courses/${SEED_IDS.courseId}`)
    .set(auth(adminToken))
    .send({ instructorId: SEED_IDS.instructorId });
  expect(assign.status).toBe(200);
});

afterAll(async () => {
  const stale = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(sql`${announcements.title} LIKE ${PREFIX + "%"}`);
  if (stale.length > 0) {
    const ids = stale.map((s) => s.id);
    const atts = await db
      .select()
      .from(announcementAttachments)
      .where(inArray(announcementAttachments.announcementId, ids));
    for (const a of atts) {
      try {
        fs.unlinkSync(toFs(a.filePath));
      } catch {
        // best effort
      }
    }
    await db
      .delete(notifications)
      .where(inArray(notifications.relatedId, ids));
    await db.delete(announcements).where(inArray(announcements.id, ids));
  }

  // Restore the seed baseline: courses ship with no assigned instructor.
  const clear = await request(app)
    .put(`/api/academic/courses/${SEED_IDS.courseId}`)
    .set(auth(adminToken))
    .send({ instructorId: "" });
  expect(clear.status).toBe(200);
});

describe("Announcements workflow, audiences and attachments", () => {
  let globalDraftId: string;
  let courseDraftId: string;
  let transitionId: string;
  let attachId: string;
  let doomedId: string;

  it("coordinator creates an institution-wide announcement that defaults to DRAFT", async () => {
    const res = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({ title: PREFIX + "Global draft", content: "Draft body content" });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("DRAFT");
    expect(res.body.data.courseId).toBeNull();
    expect(res.body.data.audienceStudents).toBe(true);
    expect(res.body.data.audienceInstructors).toBe(false);
    expect(res.body.data.isPublished).toBe(false);
    globalDraftId = res.body.data.id;
  });

  it("rejects an announcement with no audience selected", async () => {
    const res = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({
        title: PREFIX + "No audience",
        content: "Body",
        audienceStudents: false,
        audienceInstructors: false,
      });

    expect(res.status).toBe(400);
  });

  it("student list hides drafts", async () => {
    const titles = await listTitles(studentToken);
    expect(titles).not.toContain(PREFIX + "Global draft");
  });

  it("student cannot fetch a draft announcement by id", async () => {
    const res = await request(app)
      .get(`/api/announcements/${globalDraftId}`)
      .set(auth(studentToken));

    expect(res.status).toBe(403);
  });

  it("instructor cannot post an institution-wide announcement", async () => {
    const res = await request(app)
      .post("/api/announcements")
      .set(auth(instructorToken))
      .send({ title: PREFIX + "Instructor global", content: "Body" });

    expect(res.status).toBe(403);
  });

  it("instructor cannot target the instructor audience", async () => {
    const res = await request(app)
      .post("/api/announcements")
      .set(auth(instructorToken))
      .send({
        courseId: SEED_IDS.courseId,
        title: PREFIX + "Instructor staff post",
        content: "Body",
        audienceStudents: false,
        audienceInstructors: true,
      });

    expect(res.status).toBe(403);
  });

  it("clinical instructor cannot announce to another instructor's course", async () => {
    const res = await request(app)
      .post("/api/announcements")
      .set(auth(clinicalToken))
      .send({ courseId: SEED_IDS.courseId, title: PREFIX + "Clinical post", content: "Body" });

    expect(res.status).toBe(403);
  });

  it("instructor creates a draft on their own course", async () => {
    const res = await request(app)
      .post("/api/announcements")
      .set(auth(instructorToken))
      .send({
        courseId: SEED_IDS.courseId,
        title: PREFIX + "Course draft",
        content: "Course body",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("DRAFT");
    expect(res.body.data.courseId).toBe(SEED_IDS.courseId);
    courseDraftId = res.body.data.id;
  });

  it("instructor sees their own course drafts in the list", async () => {
    const titles = await listTitles(instructorToken);
    expect(titles).toContain(PREFIX + "Course draft");
  });

  it("publishing the global draft makes it visible to students", async () => {
    const put = await request(app)
      .put(`/api/announcements/${globalDraftId}`)
      .set(auth(coordinatorToken))
      .send({ status: "PUBLISHED" });

    expect(put.status).toBe(200);
    expect(put.body.data.status).toBe("PUBLISHED");
    expect(put.body.data.isPublished).toBe(true);

    const titles = await listTitles(studentToken);
    expect(titles).toContain(PREFIX + "Global draft");
  });

  it("instructor-audience announcement is hidden from students but shown to instructors", async () => {
    const create = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({
        title: PREFIX + "Staff notice",
        content: "Faculty only",
        audienceStudents: false,
        audienceInstructors: true,
        status: "PUBLISHED",
      });

    expect(create.status).toBe(201);
    expect(create.body.data.audienceInstructors).toBe(true);

    const studentTitles = await listTitles(studentToken);
    expect(studentTitles).not.toContain(PREFIX + "Staff notice");

    const instructorTitles = await listTitles(instructorToken);
    expect(instructorTitles).toContain(PREFIX + "Staff notice");
  });

  it("instructor list keeps institution-wide rows when the page sends instructorId", async () => {
    // Regression: the Announcements page sends instructorId; the INNER JOIN on
    // courses used to drop every global row (course_id IS NULL).
    const titles = await listTitles(
      instructorToken,
      `&instructorId=${SEED_IDS.instructorId}`
    );
    expect(titles).toContain(PREFIX + "Staff notice");
    expect(titles).toContain(PREFIX + "Course draft");
    // Students-only announcements stay hidden from instructors.
    expect(titles).not.toContain(PREFIX + "Global draft");
  });

  it("enforces the transition rules: archived cannot be published directly", async () => {
    const create = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({ title: PREFIX + "Transitions", content: "Body" });

    expect(create.status).toBe(201);
    transitionId = create.body.data.id;

    const archive = await request(app)
      .put(`/api/announcements/${transitionId}`)
      .set(auth(coordinatorToken))
      .send({ status: "ARCHIVED" });
    expect(archive.status).toBe(200);

    const badPublish = await request(app)
      .put(`/api/announcements/${transitionId}`)
      .set(auth(coordinatorToken))
      .send({ status: "PUBLISHED" });
    expect(badPublish.status).toBe(400);

    const restore = await request(app)
      .put(`/api/announcements/${transitionId}`)
      .set(auth(coordinatorToken))
      .send({ status: "DRAFT" });
    expect(restore.status).toBe(200);
    expect(restore.body.data.status).toBe("DRAFT");
  });

  it("unpublishing hides the announcement from students again", async () => {
    const before = await listTitles(studentToken);
    expect(before).toContain(PREFIX + "Global draft");

    const put = await request(app)
      .put(`/api/announcements/${globalDraftId}`)
      .set(auth(coordinatorToken))
      .send({ status: "DRAFT" });

    expect(put.status).toBe(200);

    const after = await listTitles(studentToken);
    expect(after).not.toContain(PREFIX + "Global draft");
  });

  it("expired announcements are hidden from students but listed for managers", async () => {
    const create = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({
        title: PREFIX + "Expired notice",
        content: "Body",
        status: "PUBLISHED",
        expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      });

    expect(create.status).toBe(201);

    const studentTitles = await listTitles(studentToken);
    expect(studentTitles).not.toContain(PREFIX + "Expired notice");

    const coordinatorTitles = await listTitles(coordinatorToken);
    expect(coordinatorTitles).toContain(PREFIX + "Expired notice");
  });

  it("scheduled announcements stay hidden from students until publishAt passes", async () => {
    const create = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({
        title: PREFIX + "Scheduled notice",
        content: "Body",
        status: "PUBLISHED",
        publishAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      });

    expect(create.status).toBe(201);

    const studentTitles = await listTitles(studentToken);
    expect(studentTitles).not.toContain(PREFIX + "Scheduled notice");

    const coordinatorTitles = await listTitles(coordinatorToken);
    expect(coordinatorTitles).toContain(PREFIX + "Scheduled notice");
  });

  it("legacy isPublished: true maps to PUBLISHED status", async () => {
    const res = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({ title: PREFIX + "Legacy", content: "Body", isPublished: true });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PUBLISHED");
  });

  it("uploads, lists and removes attachments (files on disk)", async () => {
    const create = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({ title: PREFIX + "With files", content: "Body" });

    expect(create.status).toBe(201);
    attachId = create.body.data.id;

    const upload = await request(app)
      .post(`/api/announcements/${attachId}/attachments`)
      .set(auth(coordinatorToken))
      .attach("files", Buffer.from("%PDF-1.4 test"), "handbook.pdf")
      .attach("files", Buffer.from("orientation notes"), "notes.txt");

    expect(upload.status).toBe(201);
    expect(upload.body.data).toHaveLength(2);
    const [first] = upload.body.data as Array<{ id: string; filePath: string; fileName: string }>;
    expect(String(first.filePath)).toMatch(/^\/storage\/documents\//);
    expect(fs.existsSync(toFs(first.filePath))).toBe(true);

    // Draft is still invisible to students (attachments ride on visibility).
    const studentDetail = await request(app)
      .get(`/api/announcements/${attachId}`)
      .set(auth(studentToken));
    expect(studentDetail.status).toBe(403);

    const detail = await request(app)
      .get(`/api/announcements/${attachId}`)
      .set(auth(coordinatorToken));
    expect(detail.status).toBe(200);
    expect(detail.body.data.attachments).toHaveLength(2);

    const remove = await request(app)
      .delete(`/api/announcements/${attachId}/attachments/${first.id}`)
      .set(auth(coordinatorToken));
    expect(remove.status).toBe(200);
    expect(fs.existsSync(toFs(first.filePath))).toBe(false);

    const after = await request(app)
      .get(`/api/announcements/${attachId}`)
      .set(auth(coordinatorToken));
    expect(after.body.data.attachments).toHaveLength(1);
  });

  it("instructor cannot edit or delete an institution-wide announcement", async () => {
    const put = await request(app)
      .put(`/api/announcements/${globalDraftId}`)
      .set(auth(instructorToken))
      .send({ title: PREFIX + "Hijacked" });
    expect(put.status).toBe(403);

    const del = await request(app)
      .delete(`/api/announcements/${globalDraftId}`)
      .set(auth(instructorToken));
    expect(del.status).toBe(403);
  });

  it("admin deletes an announcement and its attachments are cleaned up", async () => {
    const create = await request(app)
      .post("/api/announcements")
      .set(auth(adminToken))
      .send({ title: PREFIX + "Doomed", content: "Body" });
    expect(create.status).toBe(201);
    doomedId = create.body.data.id;

    const upload = await request(app)
      .post(`/api/announcements/${doomedId}/attachments`)
      .set(auth(adminToken))
      .attach("files", Buffer.from("%PDF-1.4 doomed"), "doomed.pdf");
    expect(upload.status).toBe(201);
    const filePath = String(upload.body.data[0].filePath);
    expect(fs.existsSync(toFs(filePath))).toBe(true);

    const del = await request(app)
      .delete(`/api/announcements/${doomedId}`)
      .set(auth(adminToken));
    expect(del.status).toBe(200);

    const gone = await request(app)
      .get(`/api/announcements/${doomedId}`)
      .set(auth(adminToken));
    expect(gone.status).toBe(404);

    const rows = await db
      .select({ id: announcementAttachments.id })
      .from(announcementAttachments)
      .where(eq(announcementAttachments.announcementId, doomedId));
    expect(rows).toHaveLength(0);
    expect(fs.existsSync(toFs(filePath))).toBe(false);
  });

  it("instructor can edit and delete their own course announcement", async () => {
    const put = await request(app)
      .put(`/api/announcements/${courseDraftId}`)
      .set(auth(instructorToken))
      .send({ content: "Updated course body" });
    expect(put.status).toBe(200);
    expect(put.body.data.content).toBe("Updated course body");

    const del = await request(app)
      .delete(`/api/announcements/${courseDraftId}`)
      .set(auth(instructorToken));
    expect(del.status).toBe(200);

    const gone = await request(app)
      .get(`/api/announcements/${courseDraftId}`)
      .set(auth(instructorToken));
    expect(gone.status).toBe(404);
  });

  it("draft, scheduled and expired announcements create no in-app notifications", async () => {
    const assertNone = async (id: string) => {
      const rows = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(eq(notifications.relatedId, id));
      expect(rows).toHaveLength(0);
    };

    const draft = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({ title: PREFIX + "No-notify draft", content: "Body" });
    expect(draft.status).toBe(201);
    await assertNone(draft.body.data.id);

    const scheduled = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({
        title: PREFIX + "No-notify scheduled",
        content: "Body",
        status: "PUBLISHED",
        publishAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      });
    expect(scheduled.status).toBe(201);
    await assertNone(scheduled.body.data.id);

    const expired = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({
        title: PREFIX + "No-notify expired",
        content: "Body",
        status: "PUBLISHED",
        expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      });
    expect(expired.status).toBe(201);
    await assertNone(expired.body.data.id);
  });

  it("publishing notifies the student audience in-app (minus author) and deleting cleans up", async () => {
    const [coord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "coordinator"));

    const create = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({ title: PREFIX + "Notify students", content: "Notify body" });
    expect(create.status).toBe(201);
    const id = create.body.data.id as string;

    // Draft stage: no notifications yet.
    const whileDraft = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.relatedId, id));
    expect(whileDraft).toHaveLength(0);

    const pub = await request(app)
      .put(`/api/announcements/${id}`)
      .set(auth(coordinatorToken))
      .send({ status: "PUBLISHED" });
    expect(pub.status).toBe(200);

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.relatedId, id));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.type === "ANNOUNCEMENT")).toBe(true);
    expect(rows.every((r) => r.isRead === false)).toBe(true);
    expect(rows.some((r) => r.userId === studentDbId)).toBe(true);
    expect(rows.some((r) => r.userId === coord.id)).toBe(false);

    const del = await request(app)
      .delete(`/api/announcements/${id}`)
      .set(auth(coordinatorToken));
    expect(del.status).toBe(200);
    const afterDel = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.relatedId, id));
    expect(afterDel).toHaveLength(0);
  });

  it("instructor-audience announcements notify instructors but not students", async () => {
    const create = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({
        title: PREFIX + "Notify staff",
        content: "Staff body",
        audienceStudents: false,
        audienceInstructors: true,
        status: "PUBLISHED",
      });
    expect(create.status).toBe(201);

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.relatedId, create.body.data.id));

    expect(rows.some((r) => r.userId === SEED_IDS.instructorId)).toBe(true);
    expect(rows.some((r) => r.userId === studentDbId)).toBe(false);
    expect(rows.every((r) => r.type === "ANNOUNCEMENT")).toBe(true);
  });

  it("coordinators and admins get an attributed bell notification when an instructor publishes", async () => {
    const [coordRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "coordinator"));
    const [adminRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "admin"));
    const [instr] = await db
      .select({ id: users.id, firstName: users.firstName })
      .from(users)
      .where(eq(users.username, "instructor"));

    const create = await request(app)
      .post("/api/announcements")
      .set(auth(instructorToken))
      .send({
        courseId: SEED_IDS.courseId,
        title: PREFIX + "Instructor published",
        content: "Posted by the instructor",
        status: "PUBLISHED",
      });
    expect(create.status).toBe(201);

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.relatedId, create.body.data.id));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.userId === coordRow.id)).toBe(true);
    expect(rows.some((r) => r.userId === adminRow.id)).toBe(true);
    // The publisher never notifies themselves.
    expect(rows.some((r) => r.userId === instr.id)).toBe(false);
    // Attribution: every row names the instructor who published it.
    expect(rows.every((r) => r.title.includes(instr.firstName))).toBe(true);
    expect(
      rows.every((r) => r.title.includes(PREFIX + "Instructor published"))
    ).toBe(true);
  });

  it("a receiver can mark an announcement read (idempotent) and it clears their bell", async () => {
    const create = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({
        title: PREFIX + "Read tracking",
        content: "Body",
        status: "PUBLISHED",
      });
    expect(create.status).toBe(201);
    const id = create.body.data.id as string;

    // Receiver sees it as unread, with no sender stats.
    const before = await request(app)
      .get("/api/announcements")
      .query({ limit: "50" })
      .set(auth(studentToken));
    const beforeItem = before.body.data.items.find(
      (i: { id: string }) => i.id === id
    );
    expect(beforeItem).toBeDefined();
    expect(beforeItem.read).toBe(false);
    expect(beforeItem.stats).toBeUndefined();

    // Their bell notification exists and starts unread.
    const notifBefore = await db
      .select()
      .from(notifications)
      .where(eq(notifications.relatedId, id));
    expect(notifBefore.some((n) => n.userId === studentDbId)).toBe(true);
    expect(
      notifBefore.find((n) => n.userId === studentDbId)?.isRead
    ).toBe(false);

    const mark1 = await request(app)
      .post(`/api/announcements/${id}/read`)
      .set(auth(studentToken));
    expect(mark1.status).toBe(200);
    expect(mark1.body.data.read).toBe(true);

    // Idempotent — a second mark keeps the original timestamp.
    const mark2 = await request(app)
      .post(`/api/announcements/${id}/read`)
      .set(auth(studentToken));
    expect(mark2.status).toBe(200);
    expect(new Date(mark2.body.data.readAt).getTime()).toBe(
      new Date(mark1.body.data.readAt).getTime()
    );

    // The list flips to read and the receiver's bell row is cleared.
    const after = await request(app)
      .get("/api/announcements")
      .query({ limit: "50" })
      .set(auth(studentToken));
    const afterItem = after.body.data.items.find(
      (i: { id: string }) => i.id === id
    );
    expect(afterItem.read).toBe(true);

    const notifAfter = await db
      .select()
      .from(notifications)
      .where(eq(notifications.relatedId, id));
    expect(notifAfter.find((n) => n.userId === studentDbId)?.isRead).toBe(
      true
    );
    // Other receivers keep their own (unread) state.
    expect(notifAfter.some((n) => n.isRead === false)).toBe(true);
  });

  it("multiple receivers get individual read state; the sender sees the aggregate", async () => {
    const create = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({
        title: PREFIX + "Aggregate",
        content: "Body",
        audienceStudents: true,
        audienceInstructors: true,
        status: "PUBLISHED",
      });
    expect(create.status).toBe(201);
    const id = create.body.data.id as string;

    // Sender's list: aggregate present, everyone unread to start.
    const list1 = await request(app)
      .get("/api/announcements")
      .query({ limit: "50" })
      .set(auth(coordinatorToken));
    const item1 = list1.body.data.items.find((i: { id: string }) => i.id === id);
    expect(item1.stats).toBeDefined();
    expect(item1.stats.receiverCount).toBeGreaterThanOrEqual(2);
    expect(item1.stats.readCount).toBe(0);

    // One of the receivers reads it.
    const mark = await request(app)
      .post(`/api/announcements/${id}/read`)
      .set(auth(studentToken));
    expect(mark.status).toBe(200);

    // Receipts: exactly one read, everyone else individually unread.
    const receipts = await request(app)
      .get(`/api/announcements/${id}/receipts`)
      .set(auth(coordinatorToken));
    expect(receipts.status).toBe(200);
    expect(receipts.body.data.readCount).toBe(1);
    expect(receipts.body.data.unreadCount).toBe(
      receipts.body.data.receiverCount - 1
    );
    expect(receipts.body.data.read[0].userId).toBe(studentDbId);
    expect(receipts.body.data.read[0].readAt).toBeTruthy();
    expect(receipts.body.data.read[0].role).toBe("STUDENT");
    // Roles are exposed so the UI can separate students from instructors.
    expect(
      receipts.body.data.unread.some(
        (u: { role: string }) =>
          u.role === "INSTRUCTOR" || u.role === "CLINICAL_INSTRUCTOR"
      )
    ).toBe(true);
    expect(
      receipts.body.data.unread.some(
        (u: { userId: string }) => u.userId === studentDbId
      )
    ).toBe(false);

    // The sender's aggregate updates too.
    const list2 = await request(app)
      .get("/api/announcements")
      .query({ limit: "50" })
      .set(auth(coordinatorToken));
    expect(
      list2.body.data.items.find((i: { id: string }) => i.id === id).stats
        .readCount
    ).toBe(1);
  });

  it("read receipts are restricted to the publisher, coordinators and admins", async () => {
    const create = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({
        title: PREFIX + "Receipts gate",
        content: "Body",
        audienceStudents: false,
        audienceInstructors: true,
        status: "PUBLISHED",
      });
    expect(create.status).toBe(201);
    const id = create.body.data.id as string;

    // Instructor can see the announcement but not the receipts (not author).
    const denied = await request(app)
      .get(`/api/announcements/${id}/receipts`)
      .set(auth(instructorToken));
    expect(denied.status).toBe(403);

    // Publisher (coordinator) and admin can.
    const asCoordinator = await request(app)
      .get(`/api/announcements/${id}/receipts`)
      .set(auth(coordinatorToken));
    expect(asCoordinator.status).toBe(200);
    const asAdmin = await request(app)
      .get(`/api/announcements/${id}/receipts`)
      .set(auth(adminToken));
    expect(asAdmin.status).toBe(200);

    // A student cannot even mark it read — visibility gate applies first.
    const notVisible = await request(app)
      .post(`/api/announcements/${id}/read`)
      .set(auth(studentToken));
    expect(notVisible.status).toBe(403);
  });

  it("own posts count as read for the author, and stats only reach senders", async () => {
    // Instructor publishes on their own course.
    const own = await request(app)
      .post("/api/announcements")
      .set(auth(instructorToken))
      .send({
        courseId: SEED_IDS.courseId,
        title: PREFIX + "Author view",
        content: "Body",
        status: "PUBLISHED",
      });
    expect(own.status).toBe(201);
    const ownId = own.body.data.id as string;

    // Author's own list: already "read", stats present with zero readers.
    const asAuthor = await request(app)
      .get("/api/announcements")
      .query({ limit: "50" })
      .set(auth(instructorToken));
    const authorItem = asAuthor.body.data.items.find(
      (i: { id: string }) => i.id === ownId
    );
    expect(authorItem.read).toBe(true);
    expect(authorItem.stats).toBeDefined();
    expect(authorItem.stats.readCount).toBe(0);

    // Coordinator (oversight role) sees the same stats.
    const asCoordinator = await request(app)
      .get("/api/announcements")
      .query({ limit: "50" })
      .set(auth(coordinatorToken));
    expect(
      asCoordinator.body.data.items.find((i: { id: string }) => i.id === ownId)
        .stats
    ).toBeDefined();

    // A non-publisher who can only read it gets no stats and an unread flag.
    const global = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({
        title: PREFIX + "Not my stats",
        content: "Body",
        audienceStudents: false,
        audienceInstructors: true,
        status: "PUBLISHED",
      });
    expect(global.status).toBe(201);
    const globalId = global.body.data.id as string;

    const asInstructor = await request(app)
      .get("/api/announcements")
      .query({ limit: "50" })
      .set(auth(instructorToken));
    const foreignItem = asInstructor.body.data.items.find(
      (i: { id: string }) => i.id === globalId
    );
    expect(foreignItem).toBeDefined();
    expect(foreignItem.stats).toBeUndefined();
    expect(foreignItem.read).toBe(false);
  });
});

describe("Dashboard feed: unreadOnly hides read announcements", () => {
  it("excludes announcements the viewer has read (and own posts) from the unread-only list", async () => {
    const created = await request(app)
      .post("/api/announcements")
      .set(auth(coordinatorToken))
      .send({
        title: PREFIX + "Feed unread filter",
        content: "Body",
        audienceStudents: true,
        audienceInstructors: false,
        status: "PUBLISHED",
      });
    expect(created.status).toBe(201);
    const feedId = created.body.data.id as string;

    // The student hasn't read it yet, so it shows up in the unread feed.
    const before = await request(app)
      .get("/api/announcements")
      .query({ publishedOnly: "true", unreadOnly: "true", limit: "100" })
      .set(auth(studentToken));
    expect(before.status).toBe(200);
    const beforeItem = before.body.data.items.find(
      (i: { id: string }) => i.id === feedId
    );
    expect(beforeItem).toBeDefined();
    expect(beforeItem.read).toBe(false);

    // The author never sees their own post as "unread".
    const asAuthor = await request(app)
      .get("/api/announcements")
      .query({ unreadOnly: "true", limit: "100" })
      .set(auth(coordinatorToken));
    expect(asAuthor.status).toBe(200);
    expect(
      asAuthor.body.data.items.find((i: { id: string }) => i.id === feedId)
    ).toBeUndefined();

    // The student reads it → it drops out of the unread-only feed.
    const read = await request(app)
      .post(`/api/announcements/${feedId}/read`)
      .set(auth(studentToken));
    expect(read.status).toBe(200);

    const after = await request(app)
      .get("/api/announcements")
      .query({ publishedOnly: "true", unreadOnly: "true", limit: "100" })
      .set(auth(studentToken));
    expect(after.status).toBe(200);
    expect(
      after.body.data.items.find((i: { id: string }) => i.id === feedId)
    ).toBeUndefined();

    // ...but the regular (read-state-aware) list still shows it as read.
    const full = await request(app)
      .get("/api/announcements")
      .query({ publishedOnly: "true", limit: "100" })
      .set(auth(studentToken));
    expect(full.status).toBe(200);
    const fullItem = full.body.data.items.find(
      (i: { id: string }) => i.id === feedId
    );
    expect(fullItem).toBeDefined();
    expect(fullItem.read).toBe(true);
  });
});
