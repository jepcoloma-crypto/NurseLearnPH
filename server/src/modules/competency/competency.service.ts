import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  competencyFrameworks,
  competencies,
  competencyIndicators,
  studentCompetencies,
  competencyAssessments,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { NotFoundError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";

const logger = createChildLogger("competency-service");

// ─── Frameworks ──────────────────────────────────────────────────────────────

export async function listFrameworks(query: { page: number; limit: number }) {
  const { page, limit } = query;
  const offset = (page - 1) * limit;

  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(competencyFrameworks);
  const items = await db.select().from(competencyFrameworks).orderBy(competencyFrameworks.name).limit(limit).offset(offset);

  return {
    items,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getFrameworkById(id: string) {
  const [item] = await db.select().from(competencyFrameworks).where(eq(competencyFrameworks.id, id));
  if (!item) throw new NotFoundError("Competency Framework");

  const frameworkCompetencies = await db.select().from(competencies).where(eq(competencies.frameworkId, id));
  return { ...item, competencies: frameworkCompetencies };
}

export async function createFramework(data: { name: string; description?: string; version?: string; programId?: string; isDefault?: boolean }, createdBy?: string) {
  const [item] = await db
    .insert(competencyFrameworks)
    .values({
      name: data.name,
      description: data.description ?? null,
      version: data.version ?? null,
      programId: data.programId ?? null,
      isDefault: data.isDefault ?? false,
      createdBy: createdBy ?? null,
    })
    .returning();

  await logAudit({ userId: createdBy, action: "CREATE_FRAMEWORK", resource: "COMPETENCY_FRAMEWORK", resourceId: item.id });
  return item;
}

export async function updateFramework(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(competencyFrameworks).where(eq(competencyFrameworks.id, id));
  if (!existing) throw new NotFoundError("Competency Framework");

  const [item] = await db.update(competencyFrameworks).set({ ...data, updatedAt: new Date() }).where(eq(competencyFrameworks.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_FRAMEWORK", resource: "COMPETENCY_FRAMEWORK", resourceId: id });
  return item;
}

export async function deleteFramework(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(competencyFrameworks).where(eq(competencyFrameworks.id, id));
  if (!existing) throw new NotFoundError("Competency Framework");

  await db.delete(competencyFrameworks).where(eq(competencyFrameworks.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_FRAMEWORK", resource: "COMPETENCY_FRAMEWORK", resourceId: id });
}

// ─── Competencies ────────────────────────────────────────────────────────────

export async function listCompetencies(query: { frameworkId?: string; category?: string; level?: string; page: number; limit: number }) {
  const { frameworkId, category, level, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (frameworkId) conditions.push(eq(competencies.frameworkId, frameworkId));
  if (category) conditions.push(eq(competencies.category, category));
  if (level) conditions.push(eq(competencies.targetLevel, level as "BEGINNER" | "DEVELOPING" | "COMPETENT" | "PROFICIENT" | "EXPERT"));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(competencies).where(where);

  const items = await db.select().from(competencies).where(where).orderBy(competencies.name).limit(limit).offset(offset);
  return {
    items,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getCompetencyById(id: string) {
  const [item] = await db.select().from(competencies).where(eq(competencies.id, id));
  if (!item) throw new NotFoundError("Competency");

  const indicators = await db.select().from(competencyIndicators).where(eq(competencyIndicators.competencyId, id));
  return { ...item, indicators };
}

export async function createCompetency(data: {
  frameworkId: string;
  parentId?: string;
  name: string;
  description?: string;
  category?: string;
  targetLevel?: string;
}, createdBy?: string) {
  const [item] = await db
    .insert(competencies)
    .values({
      frameworkId: data.frameworkId,
      parentId: data.parentId ?? null,
      name: data.name,
      description: data.description ?? null,
      category: data.category ?? null,
      targetLevel: (data.targetLevel as "BEGINNER" | "DEVELOPING" | "COMPETENT" | "PROFICIENT" | "EXPERT") ?? "COMPETENT",
    })
    .returning();

  await logAudit({ userId: createdBy, action: "CREATE_COMPETENCY", resource: "COMPETENCY", resourceId: item.id });
  return item;
}

export async function updateCompetency(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(competencies).where(eq(competencies.id, id));
  if (!existing) throw new NotFoundError("Competency");

  const [item] = await db.update(competencies).set(data).where(eq(competencies.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_COMPETENCY", resource: "COMPETENCY", resourceId: id });
  return item;
}

// ─── Indicators ──────────────────────────────────────────────────────────────

export async function addIndicator(competencyId: string, data: { description: string; measurementMethod?: string }) {
  const [item] = await db
    .insert(competencyIndicators)
    .values({
      competencyId,
      description: data.description,
      measurementMethod: data.measurementMethod ?? null,
    })
    .returning();

  return item;
}

export async function removeIndicator(id: string) {
  const [existing] = await db.select().from(competencyIndicators).where(eq(competencyIndicators.id, id));
  if (!existing) throw new NotFoundError("Competency Indicator");

  await db.delete(competencyIndicators).where(eq(competencyIndicators.id, id));
}

// ─── Student Competencies ────────────────────────────────────────────────────

export async function getStudentCompetencies(studentId: string) {
  const items = await db.select().from(studentCompetencies).where(eq(studentCompetencies.studentId, studentId));
  return items;
}

export async function updateStudentCompetency(data: {
  studentId: string;
  competencyId: string;
  currentLevel: string;
  isAchieved?: boolean;
  evidence?: Record<string, unknown>;
  assessedBy?: string;
  notes?: string;
}) {
  const [existing] = await db
    .select()
    .from(studentCompetencies)
    .where(and(eq(studentCompetencies.studentId, data.studentId), eq(studentCompetencies.competencyId, data.competencyId)));

  if (existing) {
    const [item] = await db
      .update(studentCompetencies)
      .set({
        currentLevel: data.currentLevel as "BEGINNER" | "DEVELOPING" | "COMPETENT" | "PROFICIENT" | "EXPERT",
        isAchieved: data.isAchieved ?? existing.isAchieved,
        achievedAt: data.isAchieved && !existing.achievedAt ? new Date() : existing.achievedAt,
        evidence: data.evidence ?? existing.evidence,
        assessedBy: data.assessedBy ?? existing.assessedBy,
        notes: data.notes ?? existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(studentCompetencies.id, existing.id))
      .returning();
    return item;
  }

  const [item] = await db
    .insert(studentCompetencies)
    .values({
      studentId: data.studentId,
      competencyId: data.competencyId,
      currentLevel: data.currentLevel as "BEGINNER" | "DEVELOPING" | "COMPETENT" | "PROFICIENT" | "EXPERT",
      isAchieved: data.isAchieved ?? false,
      achievedAt: data.isAchieved ? new Date() : null,
      evidence: data.evidence ?? null,
      assessedBy: data.assessedBy ?? null,
      notes: data.notes ?? null,
    })
    .returning();

  return item;
}

// ─── Assessments ─────────────────────────────────────────────────────────────

export async function assessCompetency(data: {
  studentId: string;
  competencyId: string;
  assessedBy: string;
  levelAchieved: string;
  score?: number;
  evidence?: Record<string, unknown>;
  comments?: string;
}) {
  const [assessment] = await db
    .insert(competencyAssessments)
    .values({
      studentId: data.studentId,
      competencyId: data.competencyId,
      assessedBy: data.assessedBy,
      levelAchieved: data.levelAchieved as "BEGINNER" | "DEVELOPING" | "COMPETENT" | "PROFICIENT" | "EXPERT",
      score: data.score ?? null,
      evidence: data.evidence ?? null,
      comments: data.comments ?? null,
    })
    .returning();

  await updateStudentCompetency({
    studentId: data.studentId,
    competencyId: data.competencyId,
    currentLevel: data.levelAchieved,
    isAchieved: ["COMPETENT", "PROFICIENT", "EXPERT"].includes(data.levelAchieved),
    evidence: data.evidence,
    assessedBy: data.assessedBy,
    notes: data.comments,
  });

  return assessment;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export async function getStudentCompetencySummary(studentId: string, frameworkId: string) {
  const frameworkCompetencies = await db.select().from(competencies).where(eq(competencies.frameworkId, frameworkId));

  const studentComps = await db
    .select()
    .from(studentCompetencies)
    .where(and(eq(studentCompetencies.studentId, studentId)));

  const compMap = new Map(studentComps.map((sc) => [sc.competencyId, sc]));

  const summary = frameworkCompetencies.map((comp) => {
    const studentComp = compMap.get(comp.id);
    return {
      competency: comp,
      currentLevel: studentComp?.currentLevel ?? "BEGINNER",
      isAchieved: studentComp?.isAchieved ?? false,
      gap: calculateGap(studentComp?.currentLevel ?? "BEGINNER", comp.targetLevel),
    };
  });

  const total = summary.length;
  const achieved = summary.filter((s) => s.isAchieved).length;
  const avgGap = summary.reduce((sum, s) => sum + s.gap, 0) / total;

  return {
    competencies: summary,
    stats: {
      total,
      achieved,
      percentage: total > 0 ? Math.round((achieved / total) * 100) : 0,
      averageGap: Math.round(avgGap * 10) / 10,
    },
  };
}

function calculateGap(current: string, target: string): number {
  const levels = ["BEGINNER", "DEVELOPING", "COMPETENT", "PROFICIENT", "EXPERT"];
  const currentIdx = levels.indexOf(current);
  const targetIdx = levels.indexOf(target);
  return Math.max(0, targetIdx - currentIdx);
}
