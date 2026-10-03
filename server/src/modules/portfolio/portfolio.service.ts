import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  portfolios,
  portfolioItems,
  reflections,
  clinicalExperienceLogs,
  achievements,
  certificates,
  portfolioFeedback,
  users,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { NotFoundError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";

const logger = createChildLogger("portfolio-service");

// ─── Portfolios ──────────────────────────────────────────────────────────────

export async function listPortfolios(query: { studentId?: string; isPublished?: boolean; page: number; limit: number }) {
  const { studentId, isPublished, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (studentId) conditions.push(eq(portfolios.studentId, studentId));
  if (isPublished !== undefined) conditions.push(eq(portfolios.isPublished, isPublished));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(portfolios).where(where);
  const rows = await db
    .select({
      id: portfolios.id,
      studentId: portfolios.studentId,
      title: portfolios.title,
      description: portfolios.description,
      isPublished: portfolios.isPublished,
      createdAt: portfolios.createdAt,
      updatedAt: portfolios.updatedAt,
      studentFirstName: users.firstName,
      studentLastName: users.lastName,
    })
    .from(portfolios)
    .leftJoin(users, eq(portfolios.studentId, users.id))
    .where(where)
    .orderBy(desc(portfolios.createdAt))
    .limit(limit)
    .offset(offset);
  const items = rows;
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getPortfolioById(id: string) {
  const [row] = await db
    .select({
      id: portfolios.id,
      studentId: portfolios.studentId,
      title: portfolios.title,
      description: portfolios.description,
      isPublished: portfolios.isPublished,
      createdAt: portfolios.createdAt,
      updatedAt: portfolios.updatedAt,
      studentFirstName: users.firstName,
      studentLastName: users.lastName,
    })
    .from(portfolios)
    .leftJoin(users, eq(portfolios.studentId, users.id))
    .where(eq(portfolios.id, id));
  if (!row) throw new NotFoundError("Portfolio");
  const items = await db.select().from(portfolioItems).where(eq(portfolioItems.portfolioId, id)).orderBy(portfolioItems.order);
  return { ...row, items };
}

export async function createPortfolio(data: { studentId: string; title: string; description?: string }) {
  const [item] = await db.insert(portfolios).values({
    studentId: data.studentId,
    title: data.title,
    description: data.description ?? null,
  }).returning();
  await logAudit({ userId: data.studentId, action: "CREATE_PORTFOLIO", resource: "PORTFOLIO", resourceId: item.id });
  return item;
}

export async function updatePortfolio(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(portfolios).where(eq(portfolios.id, id));
  if (!existing) throw new NotFoundError("Portfolio");
  const [item] = await db.update(portfolios).set({ ...data, updatedAt: new Date() }).where(eq(portfolios.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_PORTFOLIO", resource: "PORTFOLIO", resourceId: id });
  return item;
}

export async function deletePortfolio(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(portfolios).where(eq(portfolios.id, id));
  if (!existing) throw new NotFoundError("Portfolio");
  await db.delete(portfolios).where(eq(portfolios.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_PORTFOLIO", resource: "PORTFOLIO", resourceId: id });
}

// ─── Portfolio Items ─────────────────────────────────────────────────────────

export async function listPortfolioItems(portfolioId: string) {
  const items = await db.select().from(portfolioItems).where(eq(portfolioItems.portfolioId, portfolioId)).orderBy(portfolioItems.order);
  return items;
}

export async function getPortfolioItemById(id: string) {
  const [item] = await db.select().from(portfolioItems).where(eq(portfolioItems.id, id));
  if (!item) throw new NotFoundError("Portfolio Item");
  const feedback = await db.select().from(portfolioFeedback).where(eq(portfolioFeedback.portfolioItemId, id)).orderBy(desc(portfolioFeedback.createdAt));
  return { ...item, feedback };
}

export async function createPortfolioItem(portfolioId: string, data: { title: string; description?: string; itemType: string; content?: Record<string, unknown>; order?: number; isPublished?: boolean }) {
  const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.id, portfolioId));
  if (!portfolio) throw new NotFoundError("Portfolio");
  const [item] = await db.insert(portfolioItems).values({
    portfolioId,
    title: data.title,
    description: data.description ?? null,
    itemType: data.itemType,
    content: data.content ?? null,
    order: data.order ?? 0,
    isPublished: data.isPublished ?? false,
  }).returning();
  return item;
}

export async function updatePortfolioItem(id: string, data: Record<string, unknown>, userId?: string) {
  const [existing] = await db.select().from(portfolioItems).where(eq(portfolioItems.id, id));
  if (!existing) throw new NotFoundError("Portfolio Item");
  if (userId) {
    const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.id, existing.portfolioId));
    if (!portfolio || portfolio.studentId !== userId) throw new NotFoundError("Portfolio Item");
  }
  const [item] = await db.update(portfolioItems).set({ ...data, updatedAt: new Date() }).where(eq(portfolioItems.id, id)).returning();
  return item;
}

export async function deletePortfolioItem(id: string, userId?: string) {
  const [existing] = await db.select().from(portfolioItems).where(eq(portfolioItems.id, id));
  if (!existing) throw new NotFoundError("Portfolio Item");
  if (userId) {
    const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.id, existing.portfolioId));
    if (!portfolio || portfolio.studentId !== userId) throw new NotFoundError("Portfolio Item");
  }
  await db.delete(portfolioItems).where(eq(portfolioItems.id, id));
}

// ─── Reflections ─────────────────────────────────────────────────────────────

export async function listReflections(query: { studentId?: string; courseId?: string; page: number; limit: number }) {
  const { studentId, courseId, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (studentId) conditions.push(eq(reflections.studentId, studentId));
  if (courseId) conditions.push(eq(reflections.courseId, courseId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(reflections).where(where);
  const items = await db.select().from(reflections).where(where).orderBy(desc(reflections.createdAt)).limit(limit).offset(offset);
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getReflectionById(id: string) {
  const [item] = await db.select().from(reflections).where(eq(reflections.id, id));
  if (!item) throw new NotFoundError("Reflection");
  return item;
}

export async function createReflection(data: {
  studentId: string;
  courseId?: string;
  clinicalRotationId?: string;
  title: string;
  content: string;
  reflectionType?: string;
  mood?: string;
  tags?: string[];
  isPublished?: boolean;
}) {
  const [item] = await db.insert(reflections).values({
    studentId: data.studentId,
    courseId: data.courseId ?? null,
    clinicalRotationId: data.clinicalRotationId ?? null,
    title: data.title,
    content: data.content,
    reflectionType: data.reflectionType ?? "CLINICAL",
    mood: data.mood ?? null,
    tags: data.tags ?? null,
    isPublished: data.isPublished ?? false,
  }).returning();
  await logAudit({ userId: data.studentId, action: "CREATE_REFLECTION", resource: "REFLECTION", resourceId: item.id });
  return item;
}

export async function updateReflection(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(reflections).where(eq(reflections.id, id));
  if (!existing) throw new NotFoundError("Reflection");
  const [item] = await db.update(reflections).set({ ...data, updatedAt: new Date() }).where(eq(reflections.id, id)).returning();
  return item;
}

export async function deleteReflection(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(reflections).where(eq(reflections.id, id));
  if (!existing) throw new NotFoundError("Reflection");
  await db.delete(reflections).where(eq(reflections.id, id));
}

// ─── Clinical Experience Logs ────────────────────────────────────────────────

export async function listClinicalExpLogs(query: { studentId?: string; clinicalRotationId?: string; page: number; limit: number }) {
  const { studentId, clinicalRotationId, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (studentId) conditions.push(eq(clinicalExperienceLogs.studentId, studentId));
  if (clinicalRotationId) conditions.push(eq(clinicalExperienceLogs.clinicalRotationId, clinicalRotationId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(clinicalExperienceLogs).where(where);
  const items = await db.select().from(clinicalExperienceLogs).where(where).orderBy(desc(clinicalExperienceLogs.date)).limit(limit).offset(offset);
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getClinicalExpLogById(id: string) {
  const [item] = await db.select().from(clinicalExperienceLogs).where(eq(clinicalExperienceLogs.id, id));
  if (!item) throw new NotFoundError("Clinical Experience Log");
  return item;
}

export async function createClinicalExpLog(data: {
  studentId: string;
  clinicalRotationId?: string;
  patientCount?: number;
  proceduresPerformed?: string[];
  skillsApplied?: string[];
  challenges?: string;
  learnings?: string;
  supervisorNotes?: string;
  rating?: number;
  date: string;
}) {
  const [item] = await db.insert(clinicalExperienceLogs).values({
    studentId: data.studentId,
    clinicalRotationId: data.clinicalRotationId ?? null,
    patientCount: data.patientCount ?? 0,
    proceduresPerformed: data.proceduresPerformed ?? null,
    skillsApplied: data.skillsApplied ?? null,
    challenges: data.challenges ?? null,
    learnings: data.learnings ?? null,
    supervisorNotes: data.supervisorNotes ?? null,
    rating: data.rating ?? null,
    date: new Date(data.date),
  }).returning();
  return item;
}

export async function updateClinicalExpLog(id: string, data: Record<string, unknown>, userId?: string) {
  const [existing] = await db.select().from(clinicalExperienceLogs).where(eq(clinicalExperienceLogs.id, id));
  if (!existing) throw new NotFoundError("Clinical Experience Log");
  if (userId && existing.studentId !== userId) throw new NotFoundError("Clinical Experience Log");
  const [item] = await db.update(clinicalExperienceLogs).set({ ...data, updatedAt: new Date() }).where(eq(clinicalExperienceLogs.id, id)).returning();
  return item;
}

export async function deleteClinicalExpLog(id: string, userId?: string) {
  const [existing] = await db.select().from(clinicalExperienceLogs).where(eq(clinicalExperienceLogs.id, id));
  if (!existing) throw new NotFoundError("Clinical Experience Log");
  if (userId && existing.studentId !== userId) throw new NotFoundError("Clinical Experience Log");
  await db.delete(clinicalExperienceLogs).where(eq(clinicalExperienceLogs.id, id));
}

// ─── Achievements ────────────────────────────────────────────────────────────

export async function listAchievements(query: { studentId?: string; category?: string; page: number; limit: number }) {
  const { studentId, category, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (studentId) conditions.push(eq(achievements.studentId, studentId));
  if (category) conditions.push(eq(achievements.category, category));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(achievements).where(where);
  const items = await db
    .select({
      id: achievements.id,
      studentId: achievements.studentId,
      title: achievements.title,
      description: achievements.description,
      category: achievements.category,
      points: achievements.points,
      earnedAt: achievements.earnedAt,
      metadata: achievements.metadata,
      createdAt: achievements.createdAt,
      studentFirstName: users.firstName,
      studentLastName: users.lastName,
    })
    .from(achievements)
    .leftJoin(users, eq(achievements.studentId, users.id))
    .where(where)
    .orderBy(desc(achievements.earnedAt))
    .limit(limit)
    .offset(offset);
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function createAchievement(data: { studentId: string; title: string; description?: string; category: string; points?: number; metadata?: Record<string, unknown> }) {
  const [item] = await db.insert(achievements).values({
    studentId: data.studentId,
    title: data.title,
    description: data.description ?? null,
    category: data.category,
    points: data.points ?? 0,
    metadata: data.metadata ?? null,
  }).returning();
  return item;
}

export async function deleteAchievement(id: string) {
  const [existing] = await db.select().from(achievements).where(eq(achievements.id, id));
  if (!existing) throw new NotFoundError("Achievement");
  await db.delete(achievements).where(eq(achievements.id, id));
}

// ─── Certificates ────────────────────────────────────────────────────────────

export async function listCertificates(query: { studentId?: string; courseId?: string; status?: string; page: number; limit: number }) {
  const { studentId, courseId, status, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (studentId) conditions.push(eq(certificates.studentId, studentId));
  if (courseId) conditions.push(eq(certificates.courseId, courseId));
  if (status) conditions.push(eq(certificates.status, status));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(certificates).where(where);
  const items = await db
    .select({
      id: certificates.id,
      studentId: certificates.studentId,
      courseId: certificates.courseId,
      title: certificates.title,
      description: certificates.description,
      issuedBy: certificates.issuedBy,
      issuedAt: certificates.issuedAt,
      expiresAt: certificates.expiresAt,
      certificateNumber: certificates.certificateNumber,
      status: certificates.status,
      metadata: certificates.metadata,
      createdAt: certificates.createdAt,
      studentFirstName: users.firstName,
      studentLastName: users.lastName,
    })
    .from(certificates)
    .leftJoin(users, eq(certificates.studentId, users.id))
    .where(where)
    .orderBy(desc(certificates.issuedAt))
    .limit(limit)
    .offset(offset);
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getCertificateById(id: string) {
  const [item] = await db.select().from(certificates).where(eq(certificates.id, id));
  if (!item) throw new NotFoundError("Certificate");
  return item;
}

export async function createCertificate(data: {
  studentId: string;
  courseId?: string;
  title: string;
  description?: string;
  issuedBy?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}) {
  const certNumber = `CERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const [item] = await db.insert(certificates).values({
    studentId: data.studentId,
    courseId: data.courseId ?? null,
    title: data.title,
    description: data.description ?? null,
    issuedBy: data.issuedBy ?? null,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    certificateNumber: certNumber,
    metadata: data.metadata ?? null,
  }).returning();
  return item;
}

export async function updateCertificate(id: string, data: Record<string, unknown>) {
  const [existing] = await db.select().from(certificates).where(eq(certificates.id, id));
  if (!existing) throw new NotFoundError("Certificate");
  const [item] = await db.update(certificates).set(data).where(eq(certificates.id, id)).returning();
  return item;
}

export async function revokeCertificate(id: string) {
  return updateCertificate(id, { status: "REVOKED" });
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export async function listFeedback(portfolioItemId: string) {
  const items = await db
    .select({
      id: portfolioFeedback.id,
      portfolioItemId: portfolioFeedback.portfolioItemId,
      reviewerId: portfolioFeedback.reviewerId,
      rating: portfolioFeedback.rating,
      comments: portfolioFeedback.comments,
      strengths: portfolioFeedback.strengths,
      improvements: portfolioFeedback.improvements,
      createdAt: portfolioFeedback.createdAt,
      updatedAt: portfolioFeedback.updatedAt,
      reviewerFirstName: users.firstName,
      reviewerLastName: users.lastName,
    })
    .from(portfolioFeedback)
    .leftJoin(users, eq(portfolioFeedback.reviewerId, users.id))
    .where(eq(portfolioFeedback.portfolioItemId, portfolioItemId))
    .orderBy(desc(portfolioFeedback.createdAt));
  return items;
}

export async function createFeedback(data: { portfolioItemId: string; reviewerId: string; rating?: number; comments: string; strengths?: string; improvements?: string }) {
  const [item] = await db.insert(portfolioFeedback).values({
    portfolioItemId: data.portfolioItemId,
    reviewerId: data.reviewerId,
    rating: data.rating ?? null,
    comments: data.comments,
    strengths: data.strengths ?? null,
    improvements: data.improvements ?? null,
  }).returning();
  return item;
}

export async function updateFeedback(id: string, data: Record<string, unknown>) {
  const [existing] = await db.select().from(portfolioFeedback).where(eq(portfolioFeedback.id, id));
  if (!existing) throw new NotFoundError("Feedback");
  const [item] = await db.update(portfolioFeedback).set({ ...data, updatedAt: new Date() }).where(eq(portfolioFeedback.id, id)).returning();
  return item;
}

export async function deleteFeedback(id: string) {
  const [existing] = await db.select().from(portfolioFeedback).where(eq(portfolioFeedback.id, id));
  if (!existing) throw new NotFoundError("Feedback");
  await db.delete(portfolioFeedback).where(eq(portfolioFeedback.id, id));
}
