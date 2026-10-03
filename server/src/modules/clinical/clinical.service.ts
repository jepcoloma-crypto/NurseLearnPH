import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  clinicalCases,
  caseStages,
  caseOptions,
  caseAttempts,
  caseResponses,
  carePlans,
  courses,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { NotFoundError, ForbiddenError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";

const logger = createChildLogger("clinical-service");

// ─── Cases ───────────────────────────────────────────────────────────────────

export async function listCases(query: {
  courseId?: string;
  difficulty?: string;
  isPublished?: boolean;
  instructorId?: string;
  showAll?: boolean;
  page: number;
  limit: number;
}) {
  const { courseId, difficulty, isPublished, instructorId, showAll, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  // Students only see published cases; admin/coordinator/instructor see all via showAll
  if (!showAll && !instructorId && isPublished === undefined) {
    conditions.push(eq(clinicalCases.isPublished, true));
  }
  if (courseId) conditions.push(eq(clinicalCases.courseId, courseId));
  if (difficulty) conditions.push(eq(clinicalCases.difficulty, difficulty as "BEGINNER" | "INTERMEDIATE" | "ADVANCED"));
  if (isPublished !== undefined) conditions.push(eq(clinicalCases.isPublished, isPublished));

  if (instructorId) {
    // Get course IDs owned by this instructor, then filter cases by those courses
    const instructorCourses = await db.select({ id: courses.id }).from(courses).where(eq(courses.instructorId, instructorId));
    const courseIds = instructorCourses.map((c) => c.id);
    if (courseIds.length === 0) {
      return { items: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }
    conditions.push(sql`${clinicalCases.courseId} IN ${courseIds}`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(clinicalCases).where(where);
  const items = await db.select().from(clinicalCases).where(where).orderBy(desc(clinicalCases.createdAt)).limit(limit).offset(offset);
  return {
    items,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getCaseById(id: string) {
  const [item] = await db.select().from(clinicalCases).where(eq(clinicalCases.id, id));
  if (!item) throw new NotFoundError("Clinical Case");

  const stages = await db.select().from(caseStages).where(eq(caseStages.caseId, id)).orderBy(caseStages.order);

  const stagesWithOptions = await Promise.all(
    stages.map(async (stage) => {
      const options = await db.select().from(caseOptions).where(eq(caseOptions.stageId, stage.id)).orderBy(caseOptions.order);
      return { ...stage, options };
    })
  );

  return { ...item, stages: stagesWithOptions };
}

export async function createCase(
  data: {
    courseId: string;
    title: string;
    description?: string;
    department?: string;
    patientName?: string;
    patientAge?: number;
    patientGender?: string;
    chiefComplaint?: string;
    difficulty?: string;
    tags?: string[];
    maxAttempts?: number;
  },
  createdBy?: string
) {
  const [item] = await db
    .insert(clinicalCases)
    .values({
      courseId: data.courseId,
      title: data.title,
      description: data.description ?? null,
      department: data.department ?? null,
      patientName: data.patientName ?? null,
      patientAge: data.patientAge ?? null,
      patientGender: data.patientGender ?? null,
      chiefComplaint: data.chiefComplaint ?? null,
      difficulty: (data.difficulty as "BEGINNER" | "INTERMEDIATE" | "ADVANCED") ?? "BEGINNER",
      tags: data.tags ?? null,
      maxAttempts: data.maxAttempts ?? 3,
      createdBy: createdBy ?? null,
    })
    .returning();

  await logAudit({ userId: createdBy, action: "CREATE_CASE", resource: "CLINICAL_CASE", resourceId: item.id });
  return item;
}

export async function updateCase(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(clinicalCases).where(eq(clinicalCases.id, id));
  if (!existing) throw new NotFoundError("Clinical Case");

  const [item] = await db.update(clinicalCases).set({ ...data, updatedAt: new Date() }).where(eq(clinicalCases.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_CASE", resource: "CLINICAL_CASE", resourceId: id });
  return item;
}

export async function deleteCase(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(clinicalCases).where(eq(clinicalCases.id, id));
  if (!existing) throw new NotFoundError("Clinical Case");

  // Delete related records first (case_responses -> case_attempts -> care_plans)
  const attempts = await db.select({ id: caseAttempts.id }).from(caseAttempts).where(eq(caseAttempts.caseId, id));
  for (const attempt of attempts) {
    await db.delete(caseResponses).where(eq(caseResponses.attemptId, attempt.id));
  }
  await db.delete(caseAttempts).where(eq(caseAttempts.caseId, id));
  await db.delete(carePlans).where(eq(carePlans.caseId, id));

  // case_stages has onDelete: cascade, so it will be auto-deleted
  await db.delete(clinicalCases).where(eq(clinicalCases.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_CASE", resource: "CLINICAL_CASE", resourceId: id });
}

export async function toggleCasePublish(id: string, toggledBy?: string) {
  const [existing] = await db.select().from(clinicalCases).where(eq(clinicalCases.id, id));
  if (!existing) throw new NotFoundError("Clinical Case");

  const newStatus = !existing.isPublished;
  await db.update(clinicalCases).set({ isPublished: newStatus, updatedAt: new Date() }).where(eq(clinicalCases.id, id));
  await logAudit({ userId: toggledBy, action: "TOGGLE_CASE_PUBLISH", resource: "CLINICAL_CASE", resourceId: id });
  return { ...existing, isPublished: newStatus };
}

// ─── Stages ──────────────────────────────────────────────────────────────────

export async function createStage(
  caseId: string,
  data: {
    title: string;
    description?: string;
    patientData?: Record<string, unknown>;
    order?: number;
    points?: number;
    options: Array<{ text: string; isCorrect: boolean; rationale?: string; order?: number }>;
  },
  createdBy?: string
) {
  const [stage] = await db
    .insert(caseStages)
    .values({
      caseId,
      title: data.title,
      description: data.description ?? null,
      patientData: data.patientData ?? null,
      order: data.order ?? 0,
      points: data.points ?? 1,
    })
    .returning();

  if (data.options && data.options.length > 0) {
    await db.insert(caseOptions).values(
      data.options.map((opt, idx) => ({
        stageId: stage.id,
        text: opt.text,
        isCorrect: opt.isCorrect,
        rationale: opt.rationale ?? null,
        order: opt.order ?? idx,
      }))
    );
  }

  await logAudit({ userId: createdBy, action: "CREATE_STAGE", resource: "CASE_STAGE", resourceId: stage.id });
  return getStageById(stage.id);
}

export async function getStageById(id: string) {
  const [stage] = await db.select().from(caseStages).where(eq(caseStages.id, id));
  if (!stage) throw new NotFoundError("Case Stage");

  const options = await db.select().from(caseOptions).where(eq(caseOptions.stageId, id)).orderBy(caseOptions.order);
  return { ...stage, options };
}

export async function updateStage(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(caseStages).where(eq(caseStages.id, id));
  if (!existing) throw new NotFoundError("Case Stage");

  const [item] = await db.update(caseStages).set(data).where(eq(caseStages.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_STAGE", resource: "CASE_STAGE", resourceId: id });
  return item;
}

export async function deleteStage(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(caseStages).where(eq(caseStages.id, id));
  if (!existing) throw new NotFoundError("Case Stage");

  await db.delete(caseStages).where(eq(caseStages.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_STAGE", resource: "CASE_STAGE", resourceId: id });
}

// ─── Attempts ────────────────────────────────────────────────────────────────

export async function startCaseAttempt(caseId: string, studentId: string) {
  const [caseItem] = await db.select().from(clinicalCases).where(eq(clinicalCases.id, caseId));
  if (!caseItem) throw new NotFoundError("Clinical Case");
  if (!caseItem.isPublished) throw new ForbiddenError("Case is not published");

  // Auto-abandon old IN_PROGRESS attempts (older than 1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  await db
    .update(caseAttempts)
    .set({ status: "ABANDONED", updatedAt: new Date() })
    .where(and(eq(caseAttempts.caseId, caseId), eq(caseAttempts.studentId, studentId), eq(caseAttempts.status, "IN_PROGRESS"), sql`${caseAttempts.createdAt} < ${oneHourAgo}`));

  // Resume a fresh IN_PROGRESS attempt instead of creating a duplicate —
  // otherwise a student could stack multiple in-progress attempts within the
  // hour and submit them all, bypassing the max-attempts limit.
  const [inProgress] = await db
    .select()
    .from(caseAttempts)
    .where(
      and(
        eq(caseAttempts.caseId, caseId),
        eq(caseAttempts.studentId, studentId),
        eq(caseAttempts.status, "IN_PROGRESS")
      )
    )
    .limit(1);

  // Count completed attempts
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(caseAttempts)
    .where(and(eq(caseAttempts.caseId, caseId), eq(caseAttempts.studentId, studentId), eq(caseAttempts.status, "COMPLETED")));

  const maxAttempts = caseItem.maxAttempts ?? 3;
  const attemptsUsed = countResult.count + 1;

  if (inProgress) {
    return {
      ...inProgress,
      maxAttempts,
      attemptsUsed,
      attemptsRemaining: Math.max(maxAttempts - attemptsUsed, 0),
    };
  }

  if (countResult.count >= maxAttempts) {
    throw new ForbiddenError(`Maximum ${maxAttempts} attempts reached for this case`);
  }

  const stages = await db.select().from(caseStages).where(eq(caseStages.caseId, caseId));
  const totalPoints = stages.reduce((sum, s) => sum + s.points, 0);

  const [attempt] = await db
    .insert(caseAttempts)
    .values({ caseId, studentId, totalPoints })
    .returning();

  await logAudit({ userId: studentId, action: "START_CASE_ATTEMPT", resource: "CASE_ATTEMPT", resourceId: attempt.id });
  return { ...attempt, totalPoints, maxAttempts, attemptsUsed: countResult.count + 1, attemptsRemaining: maxAttempts - countResult.count - 1 };
}

export async function submitCaseAttempt(attemptId: string, studentId: string, responses: Array<{ stageId: string; selectedOptionId: string }>) {
  const [attempt] = await db.select().from(caseAttempts).where(eq(caseAttempts.id, attemptId));
  if (!attempt) throw new NotFoundError("Case Attempt");
  if (attempt.studentId !== studentId) throw new ForbiddenError("Not your attempt");
  if (attempt.status !== "IN_PROGRESS") throw new ForbiddenError("Attempt already completed");

  let totalScore = 0;

  for (const response of responses) {
    const [option] = await db.select().from(caseOptions).where(eq(caseOptions.id, response.selectedOptionId));
    if (!option) continue;

    const isCorrect = option.isCorrect;
    const [stage] = await db.select().from(caseStages).where(eq(caseStages.id, response.stageId));
    const pointsAwarded = isCorrect && stage ? stage.points : 0;

    totalScore += pointsAwarded;

    await db.insert(caseResponses).values({
      attemptId,
      stageId: response.stageId,
      selectedOptionId: response.selectedOptionId,
      isCorrect,
      pointsAwarded,
    });
  }

  await db
    .update(caseAttempts)
    .set({
      status: "COMPLETED",
      completedAt: new Date(),
      score: totalScore,
      timeSpentSeconds: Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000),
      updatedAt: new Date(),
    })
    .where(eq(caseAttempts.id, attemptId));

  await logAudit({ userId: studentId, action: "SUBMIT_CASE_ATTEMPT", resource: "CASE_ATTEMPT", resourceId: attemptId });

  return {
    attemptId,
    score: totalScore,
    totalPoints: attempt.totalPoints,
    percentage: attempt.totalPoints > 0 ? Math.round((totalScore / attempt.totalPoints) * 100) : 0,
  };
}

export async function getCaseAttempt(attemptId: string, userId: string) {
  const [attempt] = await db.select().from(caseAttempts).where(eq(caseAttempts.id, attemptId));
  if (!attempt) throw new NotFoundError("Case Attempt");
  if (attempt.studentId !== userId) throw new ForbiddenError("Not your attempt");

  const caseItem = await getCaseById(attempt.caseId);
  const responses = await db.select().from(caseResponses).where(eq(caseResponses.attemptId, attemptId));

  return { ...attempt, case: caseItem, responses };
}

export async function listAttempts(studentId: string, page: number, limit: number) {
  const offset = (page - 1) * limit;
  const conditions = [eq(caseAttempts.studentId, studentId)];

  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(caseAttempts).where(and(...conditions));
  const items = await db.select().from(caseAttempts).where(and(...conditions)).orderBy(desc(caseAttempts.createdAt)).limit(limit).offset(offset);

  // Attach case details
  const itemsWithCase = await Promise.all(
    items.map(async (attempt) => {
      const [caseItem] = await db.select().from(clinicalCases).where(eq(clinicalCases.id, attempt.caseId));
      return { ...attempt, case: caseItem ?? null };
    })
  );

  return {
    items: itemsWithCase,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getCaseAttemptResult(attemptId: string, studentId: string) {
  const [attempt] = await db.select().from(caseAttempts).where(eq(caseAttempts.id, attemptId));
  if (!attempt) throw new NotFoundError("Case Attempt");
  if (attempt.studentId !== studentId) throw new ForbiddenError("Not your attempt");

  const responses = await db.select().from(caseResponses).where(eq(caseResponses.attemptId, attemptId));

  const responsesWithDetails = await Promise.all(
    responses.map(async (r) => {
      const [option] = r.selectedOptionId
        ? await db.select().from(caseOptions).where(eq(caseOptions.id, r.selectedOptionId))
        : [null];
      const [stage] = await db.select().from(caseStages).where(eq(caseStages.id, r.stageId));
      return { ...r, option, stage };
    })
  );

  return { ...attempt, responses: responsesWithDetails };
}

export async function getStudentCaseHistory(caseId: string, studentId: string) {
  const attempts = await db
    .select()
    .from(caseAttempts)
    .where(and(eq(caseAttempts.caseId, caseId), eq(caseAttempts.studentId, studentId)))
    .orderBy(desc(caseAttempts.startedAt));

  return attempts;
}
