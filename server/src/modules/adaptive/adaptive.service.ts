import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  learningPaths,
  learningPathItems,
  remediationPlans,
  remediationItems,
  prerequisiteRules,
  courseEnrollments,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { NotFoundError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";

const logger = createChildLogger("adaptive-service");

// ─── Learning Paths ──────────────────────────────────────────────────────────

export async function listLearningPaths(query: { courseId?: string; studentId?: string; status?: string; page: number; limit: number }) {
  const { courseId, studentId, status, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (courseId) conditions.push(eq(learningPaths.courseId, courseId));
  if (studentId) conditions.push(eq(learningPaths.studentId, studentId));
  if (status) conditions.push(eq(learningPaths.status, status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(learningPaths).where(where);

  const items = await db.select().from(learningPaths).where(where).orderBy(desc(learningPaths.createdAt)).limit(limit).offset(offset);
  return {
    items,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getLearningPathById(id: string) {
  const [item] = await db.select().from(learningPaths).where(eq(learningPaths.id, id));
  if (!item) throw new NotFoundError("Learning Path");

  const items = await db.select().from(learningPathItems).where(eq(learningPathItems.pathId, id)).orderBy(learningPathItems.order);
  return { ...item, items };
}

export async function createLearningPath(data: {
  courseId: string;
  studentId: string;
  title: string;
  description?: string;
  isAdaptive?: boolean;
}, createdBy?: string) {
  const [item] = await db
    .insert(learningPaths)
    .values({
      courseId: data.courseId,
      studentId: data.studentId,
      title: data.title,
      description: data.description ?? null,
      isAdaptive: data.isAdaptive ?? false,
      createdBy: createdBy ?? null,
    })
    .returning();

  await logAudit({ userId: createdBy, action: "CREATE_LEARNING_PATH", resource: "LEARNING_PATH", resourceId: item.id });
  return item;
}

export async function updateLearningPath(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(learningPaths).where(eq(learningPaths.id, id));
  if (!existing) throw new NotFoundError("Learning Path");

  const [item] = await db.update(learningPaths).set({ ...data, updatedAt: new Date() }).where(eq(learningPaths.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_LEARNING_PATH", resource: "LEARNING_PATH", resourceId: id });
  return item;
}

export async function deleteLearningPath(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(learningPaths).where(eq(learningPaths.id, id));
  if (!existing) throw new NotFoundError("Learning Path");

  await db.delete(learningPaths).where(eq(learningPaths.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_LEARNING_PATH", resource: "LEARNING_PATH", resourceId: id });
}

// ─── Path Items ──────────────────────────────────────────────────────────────

export async function addPathItem(pathId: string, data: { itemType: string; itemId: string; order?: number; isRequired?: boolean }) {
  const [existing] = await db.select().from(learningPaths).where(eq(learningPaths.id, pathId));
  if (!existing) throw new NotFoundError("Learning Path");

  const [item] = await db
    .insert(learningPathItems)
    .values({
      pathId,
      itemType: data.itemType,
      itemId: data.itemId,
      order: data.order ?? 0,
      isRequired: data.isRequired ?? true,
    })
    .returning();

  await db.update(learningPaths).set({ totalItems: existing.totalItems + 1, updatedAt: new Date() }).where(eq(learningPaths.id, pathId));
  return item;
}

export async function completePathItem(id: string, score?: number) {
  const [existing] = await db.select().from(learningPathItems).where(eq(learningPathItems.id, id));
  if (!existing) throw new NotFoundError("Learning Path Item");

  const [item] = await db.update(learningPathItems).set({ isCompleted: true, completedAt: new Date(), score: score ?? null }).where(eq(learningPathItems.id, id)).returning();

  const [path] = await db.select().from(learningPaths).where(eq(learningPaths.id, existing.pathId));
  if (path) {
    await db.update(learningPaths).set({ completedItems: path.completedItems + 1, updatedAt: new Date() }).where(eq(learningPaths.id, existing.pathId));
  }

  return item;
}

export async function removePathItem(id: string) {
  const [existing] = await db.select().from(learningPathItems).where(eq(learningPathItems.id, id));
  if (!existing) throw new NotFoundError("Learning Path Item");

  await db.delete(learningPathItems).where(eq(learningPathItems.id, id));

  const [path] = await db.select().from(learningPaths).where(eq(learningPaths.id, existing.pathId));
  if (path) {
    await db.update(learningPaths).set({ totalItems: Math.max(0, path.totalItems - 1), updatedAt: new Date() }).where(eq(learningPaths.id, existing.pathId));
  }
}

// ─── Remediation Plans ───────────────────────────────────────────────────────

export async function listRemediationPlans(query: { courseId?: string; studentId?: string; status?: string; page: number; limit: number }) {
  const { courseId, studentId, status, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (courseId) conditions.push(eq(remediationPlans.courseId, courseId));
  if (studentId) conditions.push(eq(remediationPlans.studentId, studentId));
  if (status) conditions.push(eq(remediationPlans.status, status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(remediationPlans).where(where);

  const items = await db.select().from(remediationPlans).where(where).orderBy(desc(remediationPlans.createdAt)).limit(limit).offset(offset);
  return {
    items,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getRemediationPlanById(id: string) {
  const [item] = await db.select().from(remediationPlans).where(eq(remediationPlans.id, id));
  if (!item) throw new NotFoundError("Remediation Plan");

  const items = await db.select().from(remediationItems).where(eq(remediationItems.planId, id)).orderBy(remediationItems.order);
  return { ...item, items };
}

export async function createRemediationPlan(data: {
  courseId: string;
  studentId: string;
  title: string;
  reason?: string;
  targetCompetency?: string;
}, createdBy?: string) {
  const [item] = await db
    .insert(remediationPlans)
    .values({
      courseId: data.courseId,
      studentId: data.studentId,
      title: data.title,
      reason: data.reason ?? null,
      targetCompetency: data.targetCompetency ?? null,
      createdBy: createdBy ?? null,
    })
    .returning();

  await logAudit({ userId: createdBy, action: "CREATE_REMEDIATION_PLAN", resource: "REMEDIATION_PLAN", resourceId: item.id });
  return item;
}

export async function updateRemediationPlan(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(remediationPlans).where(eq(remediationPlans.id, id));
  if (!existing) throw new NotFoundError("Remediation Plan");

  const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (data.status === "COMPLETED") updateData.completedAt = new Date();

  const [item] = await db.update(remediationPlans).set(updateData).where(eq(remediationPlans.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_REMEDIATION_PLAN", resource: "REMEDIATION_PLAN", resourceId: id });
  return item;
}

export async function deleteRemediationPlan(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(remediationPlans).where(eq(remediationPlans.id, id));
  if (!existing) throw new NotFoundError("Remediation Plan");

  await db.delete(remediationPlans).where(eq(remediationPlans.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_REMEDIATION_PLAN", resource: "REMEDIATION_PLAN", resourceId: id });
}

// ─── Remediation Items ───────────────────────────────────────────────────────

export async function addRemediationItem(planId: string, data: { title: string; description?: string; itemType: string; itemId?: string; order?: number }) {
  const [existing] = await db.select().from(remediationPlans).where(eq(remediationPlans.id, planId));
  if (!existing) throw new NotFoundError("Remediation Plan");

  const [item] = await db
    .insert(remediationItems)
    .values({
      planId,
      title: data.title,
      description: data.description ?? null,
      itemType: data.itemType,
      itemId: data.itemId ?? null,
      order: data.order ?? 0,
    })
    .returning();

  return item;
}

export async function completeRemediationItem(id: string, notes?: string) {
  const [existing] = await db.select().from(remediationItems).where(eq(remediationItems.id, id));
  if (!existing) throw new NotFoundError("Remediation Item");

  const [item] = await db.update(remediationItems).set({ isCompleted: true, completedAt: new Date(), notes: notes ?? null }).where(eq(remediationItems.id, id)).returning();
  return item;
}

export async function removeRemediationItem(id: string) {
  const [existing] = await db.select().from(remediationItems).where(eq(remediationItems.id, id));
  if (!existing) throw new NotFoundError("Remediation Item");

  await db.delete(remediationItems).where(eq(remediationItems.id, id));
}

// ─── Prerequisites ───────────────────────────────────────────────────────────

export async function listPrerequisites(courseId: string) {
  const items = await db.select().from(prerequisiteRules).where(eq(prerequisiteRules.courseId, courseId));
  return items;
}

export async function addPrerequisite(data: { courseId: string; prerequisiteCourseId: string; isRequired?: boolean; minimumGrade?: string }) {
  const [item] = await db
    .insert(prerequisiteRules)
    .values({
      courseId: data.courseId,
      prerequisiteCourseId: data.prerequisiteCourseId,
      isRequired: data.isRequired ?? true,
      minimumGrade: data.minimumGrade ?? null,
    })
    .returning();

  return item;
}

export async function removePrerequisite(id: string) {
  const [existing] = await db.select().from(prerequisiteRules).where(eq(prerequisiteRules.id, id));
  if (!existing) throw new NotFoundError("Prerequisite Rule");

  await db.delete(prerequisiteRules).where(eq(prerequisiteRules.id, id));
}

export async function checkPrerequisites(studentId: string, courseId: string) {
  const prerequisites = await db.select().from(prerequisiteRules).where(eq(prerequisiteRules.courseId, courseId));
  if (prerequisites.length === 0) return { met: true, prerequisites: [] };

  const results = await Promise.all(
    prerequisites.map(async (prereq) => {
      const [enrollment] = await db.select().from(courseEnrollments).where(
        and(
          eq(courseEnrollments.studentId, studentId),
          eq(courseEnrollments.courseId, prereq.prerequisiteCourseId)
        )
      );
      return {
        prerequisite: prereq,
        isMet: !!enrollment,
      };
    })
  );

  const allMet = results.every((r) => r.isMet);
  return { met: allMet, prerequisites: results };
}
