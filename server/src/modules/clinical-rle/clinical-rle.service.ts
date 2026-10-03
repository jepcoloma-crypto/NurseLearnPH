import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  clinicalRotations,
  rotationStudents,
  patientAssignments,
  attendanceRecords,
  clinicalLogs,
  instructorEvaluations,
  courses,
  users,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { NotFoundError, ForbiddenError, ConflictError, AppError } from "../../middleware/error-handler.js";
import { createNotification } from "../notifications/notifications.service.js";
import { createChildLogger } from "../../utils/logger.js";

const logger = createChildLogger("clinical-rle-service");

// ─── Rotations ───────────────────────────────────────────────────────────────

export async function listRotations(query: { courseId?: string; status?: string; instructorId?: string; page: number; limit: number }) {
  const { courseId, status, instructorId, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (courseId) conditions.push(eq(clinicalRotations.courseId, courseId));
  if (status) conditions.push(eq(clinicalRotations.status, status as "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"));
  if (instructorId) conditions.push(eq(clinicalRotations.instructorId, instructorId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clinicalRotations)
    .where(where);

  const items = await db
    .select({
      id: clinicalRotations.id,
      courseId: clinicalRotations.courseId,
      instructorId: clinicalRotations.instructorId,
      sectionId: clinicalRotations.sectionId,
      title: clinicalRotations.title,
      description: clinicalRotations.description,
      facility: clinicalRotations.facility,
      department: clinicalRotations.department,
      startDate: clinicalRotations.startDate,
      endDate: clinicalRotations.endDate,
      requiredHours: clinicalRotations.requiredHours,
      maxStudents: clinicalRotations.maxStudents,
      status: clinicalRotations.status,
      createdBy: clinicalRotations.createdBy,
      createdAt: clinicalRotations.createdAt,
      updatedAt: clinicalRotations.updatedAt,
      instructorFirstName: users.firstName,
      instructorLastName: users.lastName,
      courseName: courses.name,
      courseCode: courses.code,
    })
    .from(clinicalRotations)
    .leftJoin(users, eq(clinicalRotations.instructorId, users.id))
    .leftJoin(courses, eq(clinicalRotations.courseId, courses.id))
    .where(where)
    .orderBy(desc(clinicalRotations.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getRotationById(id: string) {
  const [item] = await db.select().from(clinicalRotations).where(eq(clinicalRotations.id, id));
  if (!item) throw new NotFoundError("Clinical Rotation");
  return item;
}

export async function createRotation(
  data: {
    courseId: string;
    instructorId: string;
    sectionId?: string;
    title: string;
    description?: string;
    facility?: string;
    department?: string;
    startDate: string;
    endDate: string;
    requiredHours?: number;
    maxStudents?: number;
  },
  createdBy?: string
) {
  const [item] = await db
    .insert(clinicalRotations)
    .values({
      courseId: data.courseId,
      instructorId: data.instructorId,
      sectionId: data.sectionId ?? null,
      title: data.title,
      description: data.description ?? null,
      facility: data.facility ?? null,
      department: data.department ?? null,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      requiredHours: data.requiredHours ?? 120,
      maxStudents: data.maxStudents ?? 20,
      createdBy: createdBy ?? null,
    })
    .returning();

  await logAudit({ userId: createdBy, action: "CREATE_ROTATION", resource: "CLINICAL_ROTATION", resourceId: item.id });
  return item;
}

export async function updateRotation(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(clinicalRotations).where(eq(clinicalRotations.id, id));
  if (!existing) throw new NotFoundError("Clinical Rotation");

  const patch: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (typeof data.status === "string" && data.status !== existing.status) {
    patch.completedAt = data.status === "COMPLETED" ? new Date() : null;
  }

  const [item] = await db.update(clinicalRotations).set(patch).where(eq(clinicalRotations.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_ROTATION", resource: "CLINICAL_ROTATION", resourceId: id });
  return item;
}

export async function deleteRotation(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(clinicalRotations).where(eq(clinicalRotations.id, id));
  if (!existing) throw new NotFoundError("Clinical Rotation");

  await db.delete(clinicalRotations).where(eq(clinicalRotations.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_ROTATION", resource: "CLINICAL_ROTATION", resourceId: id });
}

// ─── Rotation Completion ────────────────────────────────────────────────────

export async function getCompletionSummary(rotationId: string) {
  const [rotation] = await db.select().from(clinicalRotations).where(eq(clinicalRotations.id, rotationId));
  if (!rotation) throw new NotFoundError("Clinical Rotation");

  const students = await listRotationStudents(rotationId);

  const attendance = await db
    .select({
      studentId: attendanceRecords.studentId,
      totalHours: sql<number>`coalesce(sum(${attendanceRecords.hoursLogged}), 0)::int`,
      totalDays: sql<number>`count(*)::int`,
      presentDays: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'PRESENT')::int`,
      lateDays: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'LATE')::int`,
      absentDays: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'ABSENT')::int`,
      excusedDays: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'EXCUSED')::int`,
    })
    .from(attendanceRecords)
    .where(eq(attendanceRecords.rotationId, rotationId))
    .groupBy(attendanceRecords.studentId);

  const logs = await db
    .select({ studentId: clinicalLogs.studentId, count: sql<number>`count(*)::int` })
    .from(clinicalLogs)
    .where(eq(clinicalLogs.rotationId, rotationId))
    .groupBy(clinicalLogs.studentId);

  const attByStudent = new Map(attendance.map((a) => [a.studentId, a] as const));
  const logByStudent = new Map(logs.map((l) => [l.studentId, l.count] as const));

  const rows = students.map((s) => {
    const att = attByStudent.get(s.studentId);
    const totalHours = att?.totalHours ?? 0;
    const totalDays = att?.totalDays ?? 0;
    const attendedDays = (att?.presentDays ?? 0) + (att?.lateDays ?? 0);

    return {
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      completedAt: s.completedAt,
      totalHours,
      requiredHours: rotation.requiredHours,
      hoursPercentage: rotation.requiredHours ? Math.round((totalHours / rotation.requiredHours) * 100) : 0,
      metRequiredHours: totalHours >= rotation.requiredHours,
      totalDays,
      presentDays: att?.presentDays ?? 0,
      lateDays: att?.lateDays ?? 0,
      absentDays: att?.absentDays ?? 0,
      excusedDays: att?.excusedDays ?? 0,
      attendancePercentage: totalDays ? Math.round((attendedDays / totalDays) * 100) : 0,
      logCount: logByStudent.get(s.studentId) ?? 0,
    };
  });

  return {
    rotation: {
      id: rotation.id,
      title: rotation.title,
      status: rotation.status,
      startDate: rotation.startDate,
      endDate: rotation.endDate,
      requiredHours: rotation.requiredHours,
      completedAt: rotation.completedAt,
    },
    students: rows,
    totals: {
      studentCount: rows.length,
      totalHours: rows.reduce((sum, r) => sum + r.totalHours, 0),
      studentsBelowRequiredHours: rows.filter((r) => !r.metRequiredHours).length,
      studentsWithoutAttendance: rows.filter((r) => r.totalDays === 0).length,
    },
  };
}

async function notifyStudentCompletion(rotationId: string, rotationTitle: string, studentIds: string[]) {
  await Promise.all(
    studentIds.map((userId) =>
      createNotification({
        userId,
        type: "ROTATION_COMPLETED",
        title: "Rotation completed",
        content: `"${rotationTitle}" has been completed. Your certificate of completion is now available.`,
        relatedId: rotationId,
      }).catch((err) => logger.warn({ err, rotationId, userId }, "Failed to send completion notification"))
    )
  );
}

async function applyStudentCompletion(rotationId: string, targetIds: Set<string>, now: Date) {
  const assigned = await db
    .select({ studentId: rotationStudents.studentId, completedAt: rotationStudents.completedAt })
    .from(rotationStudents)
    .where(eq(rotationStudents.rotationId, rotationId));

  const newlyCompleted: string[] = [];
  for (const a of assigned) {
    const shouldComplete = targetIds.has(a.studentId);
    if (shouldComplete && !a.completedAt) {
      await db
        .update(rotationStudents)
        .set({ completedAt: now })
        .where(and(eq(rotationStudents.rotationId, rotationId), eq(rotationStudents.studentId, a.studentId)));
      newlyCompleted.push(a.studentId);
    } else if (!shouldComplete && a.completedAt) {
      await db
        .update(rotationStudents)
        .set({ completedAt: null })
        .where(and(eq(rotationStudents.rotationId, rotationId), eq(rotationStudents.studentId, a.studentId)));
    }
  }
  return newlyCompleted;
}

function restrictToAssigned(assignedIds: Set<string>, studentIds?: string[]): Set<string> {
  return new Set((studentIds ?? [...assignedIds]).filter((id) => assignedIds.has(id)));
}

export async function completeRotation(rotationId: string, completedBy?: string, studentIds?: string[]) {
  const [existing] = await db.select().from(clinicalRotations).where(eq(clinicalRotations.id, rotationId));
  if (!existing) throw new NotFoundError("Clinical Rotation");
  if (existing.status === "COMPLETED") throw new ConflictError("Rotation is already completed");
  if (existing.status === "CANCELLED") throw new ConflictError("A cancelled rotation cannot be completed");

  const now = new Date();
  const [item] = await db
    .update(clinicalRotations)
    .set({ status: "COMPLETED", completedAt: now, updatedAt: now })
    .where(eq(clinicalRotations.id, rotationId))
    .returning();

  await logAudit({ userId: completedBy, action: "COMPLETE_ROTATION", resource: "CLINICAL_ROTATION", resourceId: rotationId });
  logger.info({ rotationId, completedBy, studentIds }, "Rotation completed");

  // undefined => every assigned student is completed; a list limits completion to those students
  const assigned = await db
    .select({ studentId: rotationStudents.studentId })
    .from(rotationStudents)
    .where(eq(rotationStudents.rotationId, rotationId));
  const assignedIds = new Set(assigned.map((a) => a.studentId));
  const targetIds = restrictToAssigned(assignedIds, studentIds);

  const newlyCompleted = await applyStudentCompletion(rotationId, targetIds, now);
  await notifyStudentCompletion(rotationId, existing.title, newlyCompleted);

  const summary = await getCompletionSummary(rotationId);
  return { rotation: item, summary };
}

export async function updateRotationCompletion(rotationId: string, studentIds: string[], updatedBy?: string) {
  const [rotation] = await db.select().from(clinicalRotations).where(eq(clinicalRotations.id, rotationId));
  if (!rotation) throw new NotFoundError("Clinical Rotation");
  if (rotation.status !== "COMPLETED") {
    throw new ConflictError("Complete the rotation before adjusting student completion");
  }

  const assigned = await db
    .select({ studentId: rotationStudents.studentId })
    .from(rotationStudents)
    .where(eq(rotationStudents.rotationId, rotationId));
  const assignedIds = new Set(assigned.map((a) => a.studentId));
  const targetIds = restrictToAssigned(assignedIds, studentIds);

  const now = new Date();
  const newlyCompleted = await applyStudentCompletion(rotationId, targetIds, now);

  await logAudit({ userId: updatedBy, action: "UPDATE_ROTATION_COMPLETION", resource: "CLINICAL_ROTATION", resourceId: rotationId });
  logger.info({ rotationId, updatedBy, completedCount: targetIds.size }, "Rotation student completion updated");
  await notifyStudentCompletion(rotationId, rotation.title, newlyCompleted);

  return getCompletionSummary(rotationId);
}

export async function getRotationCertificate(rotationId: string, studentId: string) {
  const [rotation] = await db.select().from(clinicalRotations).where(eq(clinicalRotations.id, rotationId));
  if (!rotation) throw new NotFoundError("Clinical Rotation");
  if (rotation.status !== "COMPLETED") {
    throw new ConflictError("Certificate is available only after the rotation is completed");
  }

  const [assignment] = await db
    .select({ id: rotationStudents.id, completedAt: rotationStudents.completedAt })
    .from(rotationStudents)
    .where(and(eq(rotationStudents.rotationId, rotationId), eq(rotationStudents.studentId, studentId)));
  if (!assignment) throw new ForbiddenError("Student is not assigned to this rotation");
  if (!assignment.completedAt) {
    throw new ConflictError("This student has not been marked as completed for this rotation yet");
  }

  const [student] = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, middleName: users.middleName })
    .from(users)
    .where(eq(users.id, studentId));
  if (!student) throw new NotFoundError("Student");

  const [instructor] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, rotation.instructorId));

  const [course] = await db
    .select({ name: courses.name, code: courses.code })
    .from(courses)
    .where(eq(courses.id, rotation.courseId));

  const [att] = await db
    .select({
      totalHours: sql<number>`coalesce(sum(${attendanceRecords.hoursLogged}), 0)::int`,
      totalDays: sql<number>`count(*)::int`,
      presentDays: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'PRESENT')::int`,
      lateDays: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'LATE')::int`,
      absentDays: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'ABSENT')::int`,
      excusedDays: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'EXCUSED')::int`,
    })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.rotationId, rotationId), eq(attendanceRecords.studentId, studentId)));

  const [logCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clinicalLogs)
    .where(and(eq(clinicalLogs.rotationId, rotationId), eq(clinicalLogs.studentId, studentId)));

  const totalHours = att?.totalHours ?? 0;
  const totalDays = att?.totalDays ?? 0;
  const attendedDays = (att?.presentDays ?? 0) + (att?.lateDays ?? 0);

  return {
    student,
    rotation: {
      id: rotation.id,
      title: rotation.title,
      facility: rotation.facility,
      department: rotation.department,
      startDate: rotation.startDate,
      endDate: rotation.endDate,
      requiredHours: rotation.requiredHours,
      completedAt: rotation.completedAt,
    },
    course: course ?? null,
    instructor: instructor ?? null,
    hours: {
      total: totalHours,
      required: rotation.requiredHours,
      percentage: rotation.requiredHours ? Math.round((totalHours / rotation.requiredHours) * 100) : 0,
      metRequiredHours: totalHours >= rotation.requiredHours,
    },
    attendance: {
      totalDays,
      presentDays: att?.presentDays ?? 0,
      lateDays: att?.lateDays ?? 0,
      absentDays: att?.absentDays ?? 0,
      excusedDays: att?.excusedDays ?? 0,
      percentage: totalDays ? Math.round((attendedDays / totalDays) * 100) : 0,
    },
    logCount: logCount?.count ?? 0,
  };
}

// ─── Rotation Students ──────────────────────────────────────────────────────

export async function listRotationStudents(rotationId: string) {
  const items = await db
    .select({
      id: rotationStudents.id,
      rotationId: rotationStudents.rotationId,
      studentId: rotationStudents.studentId,
      assignedBy: rotationStudents.assignedBy,
      assignedAt: rotationStudents.assignedAt,
      completedAt: rotationStudents.completedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(rotationStudents)
    .innerJoin(users, eq(rotationStudents.studentId, users.id))
    .where(eq(rotationStudents.rotationId, rotationId))
    .orderBy(users.lastName);

  return items;
}

export async function assignStudentsToRotation(rotationId: string, studentIds: string[], assignedBy?: string) {
  // Verify rotation exists
  const [rotation] = await db.select().from(clinicalRotations).where(eq(clinicalRotations.id, rotationId));
  if (!rotation) throw new NotFoundError("Clinical Rotation");

  // Check max students
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rotationStudents)
    .where(eq(rotationStudents.rotationId, rotationId));

  const availableSlots = rotation.maxStudents - countResult.count;
  if (studentIds.length > availableSlots) {
    throw new ForbiddenError(`Only ${availableSlots} slots available (max: ${rotation.maxStudents})`);
  }

  // Get existing assignments to avoid duplicates
  const existing = await db
    .select({ studentId: rotationStudents.studentId })
    .from(rotationStudents)
    .where(eq(rotationStudents.rotationId, rotationId));
  const existingIds = new Set(existing.map((e) => e.studentId));

  const newStudents = studentIds.filter((id) => !existingIds.has(id));
  if (newStudents.length === 0) return { assigned: 0 };

  await db.insert(rotationStudents).values(
    newStudents.map((studentId) => ({
      rotationId,
      studentId,
      assignedBy: assignedBy ?? null,
    }))
  );

  await logAudit({ userId: assignedBy, action: "ASSIGN_STUDENTS_TO_ROTATION", resource: "ROTATION_STUDENTS", resourceId: rotationId });
  return { assigned: newStudents.length };
}

export async function removeStudentFromRotation(rotationId: string, studentId: string) {
  await db
    .delete(rotationStudents)
    .where(and(eq(rotationStudents.rotationId, rotationId), eq(rotationStudents.studentId, studentId)));
  return { removed: true };
}

export async function getRotationWithStudents(rotationId: string) {
  const [rotation] = await db.select().from(clinicalRotations).where(eq(clinicalRotations.id, rotationId));
  if (!rotation) throw new NotFoundError("Clinical Rotation");

  const students = await listRotationStudents(rotationId);
  const [instructor] = await db
    .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .where(eq(users.id, rotation.instructorId));

  return { ...rotation, students, instructor };
}

// ─── Patient Assignments ─────────────────────────────────────────────────────

export async function listPatientAssignments(rotationId: string, studentId?: string) {
  const conditions = [eq(patientAssignments.rotationId, rotationId)];
  if (studentId) conditions.push(eq(patientAssignments.studentId, studentId));

  const items = await db.select().from(patientAssignments).where(and(...conditions)).orderBy(desc(patientAssignments.assignedAt));
  return items;
}

export async function createPatientAssignment(data: {
  rotationId: string;
  studentId: string;
  patientName: string;
  patientAge?: number;
  patientGender?: string;
  diagnosis?: string;
}) {
  const [item] = await db
    .insert(patientAssignments)
    .values({
      rotationId: data.rotationId,
      studentId: data.studentId,
      patientName: data.patientName,
      patientAge: data.patientAge ?? null,
      patientGender: data.patientGender ?? null,
      diagnosis: data.diagnosis ?? null,
    })
    .returning();

  return item;
}

export async function releasePatientAssignment(id: string) {
  const [existing] = await db.select().from(patientAssignments).where(eq(patientAssignments.id, id));
  if (!existing) throw new NotFoundError("Patient Assignment");

  const [item] = await db.update(patientAssignments).set({ releasedAt: new Date() }).where(eq(patientAssignments.id, id)).returning();
  return item;
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export async function listAttendance(rotationId: string, studentId?: string) {
  const conditions = [eq(attendanceRecords.rotationId, rotationId)];
  if (studentId) conditions.push(eq(attendanceRecords.studentId, studentId));

  const items = await db.select().from(attendanceRecords).where(and(...conditions)).orderBy(desc(attendanceRecords.date));
  return items;
}

export async function markAttendance(data: {
  rotationId: string;
  studentId: string;
  date: string;
  status: string;
  hoursLogged?: number;
  notes?: string;
}, markedBy?: string) {
  const [item] = await db
    .insert(attendanceRecords)
    .values({
      rotationId: data.rotationId,
      studentId: data.studentId,
      date: new Date(data.date),
      status: data.status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
      hoursLogged: data.hoursLogged ?? 8,
      notes: data.notes ?? null,
      markedBy: markedBy ?? null,
    })
    .returning();

  return item;
}

export async function getStudentHours(rotationId: string, studentId: string) {
  const [result] = await db
    .select({ totalHours: sql<number>`coalesce(sum(${attendanceRecords.hoursLogged}), 0)::int` })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.rotationId, rotationId), eq(attendanceRecords.studentId, studentId)));

  const [rotation] = await db.select().from(clinicalRotations).where(eq(clinicalRotations.id, rotationId));

  return {
    totalHours: result?.totalHours ?? 0,
    requiredHours: rotation?.requiredHours ?? 120,
    percentage: rotation ? Math.round(((result?.totalHours ?? 0) / rotation.requiredHours) * 100) : 0,
  };
}

// ─── Clinical Logs ───────────────────────────────────────────────────────────

export async function listRotationLogs(rotationId: string, studentId?: string) {
  const conditions = [eq(clinicalLogs.rotationId, rotationId)];
  if (studentId) conditions.push(eq(clinicalLogs.studentId, studentId));

  const items = await db
    .select({
      id: clinicalLogs.id,
      rotationId: clinicalLogs.rotationId,
      studentId: clinicalLogs.studentId,
      date: clinicalLogs.date,
      patientCount: clinicalLogs.patientCount,
      procedures: clinicalLogs.procedures,
      reflections: clinicalLogs.reflections,
      challenges: clinicalLogs.challenges,
      learningOutcomes: clinicalLogs.learningOutcomes,
      status: clinicalLogs.status,
      reviewedBy: clinicalLogs.reviewedBy,
      reviewedAt: clinicalLogs.reviewedAt,
      feedback: clinicalLogs.feedback,
      createdAt: clinicalLogs.createdAt,
      studentFirstName: users.firstName,
      studentLastName: users.lastName,
    })
    .from(clinicalLogs)
    .leftJoin(users, eq(clinicalLogs.studentId, users.id))
    .where(and(...conditions))
    .orderBy(desc(clinicalLogs.date));
  return items;
}

export async function listClinicalLogs(rotationId: string, studentId?: string) {
  const conditions = [eq(clinicalLogs.rotationId, rotationId)];
  if (studentId) conditions.push(eq(clinicalLogs.studentId, studentId));

  const items = await db.select().from(clinicalLogs).where(and(...conditions)).orderBy(desc(clinicalLogs.date));
  return items;
}

export async function createClinicalLog(data: {
  rotationId: string;
  studentId: string;
  date: string;
  patientCount?: number;
  procedures?: string[];
  reflections?: string;
  challenges?: string;
  learningOutcomes?: string;
}) {
  const [item] = await db
    .insert(clinicalLogs)
    .values({
      rotationId: data.rotationId,
      studentId: data.studentId,
      date: new Date(data.date),
      patientCount: data.patientCount ?? 0,
      procedures: data.procedures ?? null,
      reflections: data.reflections ?? null,
      challenges: data.challenges ?? null,
      learningOutcomes: data.learningOutcomes ?? null,
    })
    .returning();

  return item;
}

export async function reviewClinicalLog(id: string, reviewedBy: string, feedback: string) {
  const [existing] = await db.select().from(clinicalLogs).where(eq(clinicalLogs.id, id));
  if (!existing) throw new NotFoundError("Clinical Log");

  const [item] = await db
    .update(clinicalLogs)
    .set({ reviewedBy, reviewedAt: new Date(), feedback, status: "REVIEWED" })
    .where(eq(clinicalLogs.id, id))
    .returning();

  try {
    await createNotification({
      userId: existing.studentId,
      type: "CLINICAL_LOG_REVIEWED",
      title: "Clinical log reviewed",
      content: `Your clinical log for ${new Date(existing.date).toLocaleDateString()} has been reviewed. View the instructor's feedback.`,
      relatedId: existing.id,
    });
  } catch (err) {
    logger.error({ err, clinicalLogId: id }, "Failed to create review notification");
  }

  return item;
}

export async function updateClinicalLog(
  id: string,
  studentId: string,
  data: {
    date?: string;
    patientCount?: number;
    procedures?: string[];
    reflections?: string;
    challenges?: string;
    learningOutcomes?: string;
  }
) {
  const [existing] = await db.select().from(clinicalLogs).where(eq(clinicalLogs.id, id));
  if (!existing) throw new NotFoundError("Clinical Log");
  if (existing.studentId !== studentId) throw new ForbiddenError("You can only edit your own clinical logs");
  if (existing.status === "REVIEWED") throw new AppError("Reviewed clinical logs cannot be edited", 400);

  const set: Record<string, unknown> = {};
  if (data.date !== undefined) set.date = new Date(data.date);
  if (data.patientCount !== undefined) set.patientCount = data.patientCount;
  if (data.procedures !== undefined) set.procedures = data.procedures;
  if (data.reflections !== undefined) set.reflections = data.reflections;
  if (data.challenges !== undefined) set.challenges = data.challenges;
  if (data.learningOutcomes !== undefined) set.learningOutcomes = data.learningOutcomes;

  const [item] = await db.update(clinicalLogs).set(set).where(eq(clinicalLogs.id, id)).returning();

  logger.info({ clinicalLogId: id, studentId }, "Clinical log updated");
  return item;
}

export async function deleteClinicalLog(id: string, studentId: string) {
  const [existing] = await db.select().from(clinicalLogs).where(eq(clinicalLogs.id, id));
  if (!existing) throw new NotFoundError("Clinical Log");
  if (existing.studentId !== studentId) throw new ForbiddenError("You can only delete your own clinical logs");
  if (existing.status === "REVIEWED") throw new AppError("Reviewed clinical logs cannot be deleted", 400);

  await db.delete(clinicalLogs).where(eq(clinicalLogs.id, id));

  logger.info({ clinicalLogId: id, studentId }, "Clinical log deleted");
  return { deleted: true };
}

// ─── Student Rotations ──────────────────────────────────────────────────────

export async function getStudentRotations(studentId: string) {
  // Get all rotations the student is assigned to
  const assigned = await db
    .select({
      rotationId: rotationStudents.rotationId,
      assignedAt: rotationStudents.assignedAt,
      studentCompletedAt: rotationStudents.completedAt,
    })
    .from(rotationStudents)
    .where(eq(rotationStudents.studentId, studentId));

  if (assigned.length === 0) return [];

  const rotationIds = assigned.map((a) => a.rotationId);

  // Get rotation details with course and instructor info
  const rotations = await db
    .select({
      id: clinicalRotations.id,
      courseId: clinicalRotations.courseId,
      instructorId: clinicalRotations.instructorId,
      title: clinicalRotations.title,
      description: clinicalRotations.description,
      facility: clinicalRotations.facility,
      department: clinicalRotations.department,
      startDate: clinicalRotations.startDate,
      endDate: clinicalRotations.endDate,
      requiredHours: clinicalRotations.requiredHours,
      maxStudents: clinicalRotations.maxStudents,
      status: clinicalRotations.status,
      courseName: courses.name,
      courseCode: courses.code,
      instructorFirstName: users.firstName,
      instructorLastName: users.lastName,
    })
    .from(clinicalRotations)
    .leftJoin(courses, eq(clinicalRotations.courseId, courses.id))
    .leftJoin(users, eq(clinicalRotations.instructorId, users.id))
    .where(sql`${clinicalRotations.id} IN ${rotationIds}`);

  const completedAtByRotation = new Map(assigned.map((a) => [a.rotationId, a.studentCompletedAt] as const));

  // Get hours for each rotation
  const results = await Promise.all(
    rotations.map(async (r) => {
      const [hoursResult] = await db
        .select({ totalHours: sql<number>`coalesce(sum(${attendanceRecords.hoursLogged}), 0)::int` })
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.rotationId, r.id), eq(attendanceRecords.studentId, studentId)));

      const logCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(clinicalLogs)
        .where(and(eq(clinicalLogs.rotationId, r.id), eq(clinicalLogs.studentId, studentId)));

      return {
        ...r,
        studentCompletedAt: completedAtByRotation.get(r.id) ?? null,
        totalHours: hoursResult?.totalHours ?? 0,
        percentage: r.requiredHours ? Math.round(((hoursResult?.totalHours ?? 0) / r.requiredHours) * 100) : 0,
        logCount: logCount?.[0]?.count ?? 0,
      };
    })
  );

  return results;
}

// ─── Evaluations ─────────────────────────────────────────────────────────────

export async function listEvaluations(rotationId: string, studentId?: string) {
  const conditions = [eq(instructorEvaluations.rotationId, rotationId)];
  if (studentId) conditions.push(eq(instructorEvaluations.studentId, studentId));

  const items = await db
    .select({
      id: instructorEvaluations.id,
      rotationId: instructorEvaluations.rotationId,
      studentId: instructorEvaluations.studentId,
      instructorId: instructorEvaluations.instructorId,
      type: instructorEvaluations.type,
      overallScore: instructorEvaluations.overallScore,
      clinicalPerformance: instructorEvaluations.clinicalPerformance,
      professionalBehavior: instructorEvaluations.professionalBehavior,
      communicationSkills: instructorEvaluations.communicationSkills,
      criticalThinking: instructorEvaluations.criticalThinking,
      strengths: instructorEvaluations.strengths,
      areasForImprovement: instructorEvaluations.areasForImprovement,
      comments: instructorEvaluations.comments,
      evaluatedAt: instructorEvaluations.evaluatedAt,
      studentFirstName: users.firstName,
      studentLastName: users.lastName,
    })
    .from(instructorEvaluations)
    .leftJoin(users, eq(instructorEvaluations.studentId, users.id))
    .where(and(...conditions))
    .orderBy(desc(instructorEvaluations.evaluatedAt));
  return items;
}

export async function createEvaluation(data: {
  rotationId: string;
  studentId: string;
  instructorId: string;
  type?: string;
  clinicalPerformance?: number;
  professionalBehavior?: number;
  communicationSkills?: number;
  criticalThinking?: number;
  strengths?: string;
  areasForImprovement?: string;
  comments?: string;
}) {
  const scores = [data.clinicalPerformance, data.professionalBehavior, data.communicationSkills, data.criticalThinking].filter((s) => s !== undefined);
  const overallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b!, 0) / scores.length) : null;

  const [item] = await db
    .insert(instructorEvaluations)
    .values({
      rotationId: data.rotationId,
      studentId: data.studentId,
      instructorId: data.instructorId,
      type: (data.type as "FORMATIVE" | "SUMMATIVE" | "MIDTERM" | "FINAL") ?? "FORMATIVE",
      clinicalPerformance: data.clinicalPerformance ?? null,
      professionalBehavior: data.professionalBehavior ?? null,
      communicationSkills: data.communicationSkills ?? null,
      criticalThinking: data.criticalThinking ?? null,
      overallScore,
      strengths: data.strengths ?? null,
      areasForImprovement: data.areasForImprovement ?? null,
      comments: data.comments ?? null,
    })
    .returning();

  return item;
}

export async function updateEvaluation(
  id: string,
  data: {
    type?: string;
    clinicalPerformance?: number;
    professionalBehavior?: number;
    communicationSkills?: number;
    criticalThinking?: number;
    strengths?: string;
    areasForImprovement?: string;
    comments?: string;
  }
) {
  const [existing] = await db.select().from(instructorEvaluations).where(eq(instructorEvaluations.id, id));
  if (!existing) throw new NotFoundError("Evaluation");

  const clinical = data.clinicalPerformance ?? existing.clinicalPerformance;
  const behavior = data.professionalBehavior ?? existing.professionalBehavior;
  const comm = data.communicationSkills ?? existing.communicationSkills;
  const critical = data.criticalThinking ?? existing.criticalThinking;
  const scores = [clinical, behavior, comm, critical].filter((s): s is number => s !== null && s !== undefined);
  const overallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const [item] = await db
    .update(instructorEvaluations)
    .set({
      type: (data.type as "FORMATIVE" | "SUMMATIVE" | "MIDTERM" | "FINAL") ?? existing.type,
      clinicalPerformance: clinical,
      professionalBehavior: behavior,
      communicationSkills: comm,
      criticalThinking: critical,
      overallScore,
      strengths: data.strengths ?? existing.strengths,
      areasForImprovement: data.areasForImprovement ?? existing.areasForImprovement,
      comments: data.comments ?? existing.comments,
      evaluatedAt: new Date(),
    })
    .where(eq(instructorEvaluations.id, id))
    .returning();

  logger.info({ evaluationId: id }, "Evaluation updated");
  return item;
}

export async function getStudentRotationSummary(rotationId: string, studentId: string) {
  const [attendance] = await db
    .select({ totalHours: sql<number>`coalesce(sum(${attendanceRecords.hoursLogged}), 0)::int` })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.rotationId, rotationId), eq(attendanceRecords.studentId, studentId)));

  const logs = await db.select().from(clinicalLogs).where(and(eq(clinicalLogs.rotationId, rotationId), eq(clinicalLogs.studentId, studentId)));

  const evaluations = await db.select().from(instructorEvaluations).where(and(eq(instructorEvaluations.rotationId, rotationId), eq(instructorEvaluations.studentId, studentId)));

  const assignments = await db.select().from(patientAssignments).where(and(eq(patientAssignments.rotationId, rotationId), eq(patientAssignments.studentId, patientAssignments.studentId)));

  return {
    hours: { total: attendance?.totalHours ?? 0, logs: logs.length },
    patients: assignments.length,
    evaluations: evaluations.length,
    latestEvaluation: evaluations[0] ?? null,
  };
}
