import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  researchProjects,
  researchCohorts,
  researchStudies,
  researchParticipants,
  researchPrePostTests,
  researchDataExports,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { NotFoundError, ForbiddenError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";

const logger = createChildLogger("research-service");

// ─── Projects ────────────────────────────────────────────────────────────────

export async function listProjects(query: { status?: string; instructorId?: string; page: number; limit: number }) {
  const { status, instructorId, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (status) conditions.push(eq(researchProjects.status, status));
  if (instructorId) conditions.push(eq(researchProjects.principalInvestigator, instructorId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(researchProjects).where(where);
  const items = await db.select().from(researchProjects).where(where).orderBy(desc(researchProjects.createdAt)).limit(limit).offset(offset);
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getProjectById(id: string) {
  const [item] = await db.select().from(researchProjects).where(eq(researchProjects.id, id));
  if (!item) throw new NotFoundError("Research Project");
  const cohorts = await db.select().from(researchCohorts).where(eq(researchCohorts.projectId, id));
  const studies = await db.select().from(researchStudies).where(eq(researchStudies.projectId, id));
  return { ...item, cohorts, studies };
}

export async function createProject(data: { title: string; description?: string; researchType: string; principalInvestigator?: string; startDate?: string; endDate?: string; fundingSource?: string }) {
  const [item] = await db.insert(researchProjects).values({
    title: data.title,
    description: data.description ?? null,
    researchType: data.researchType,
    principalInvestigator: data.principalInvestigator ?? null,
    startDate: data.startDate ? new Date(data.startDate) : null,
    endDate: data.endDate ? new Date(data.endDate) : null,
    fundingSource: data.fundingSource ?? null,
  }).returning();

  await logAudit({ action: "CREATE", resource: "research_project", resourceId: item.id, metadata: { title: data.title, researchType: data.researchType } });

  return item;
}

export async function updateProject(id: string, data: Record<string, unknown>, actor?: { userId: string; role: string }) {
  const [existing] = await db.select().from(researchProjects).where(eq(researchProjects.id, id));
  if (!existing) throw new NotFoundError("Research Project");

  // Instructors may edit only their own projects; coordinators/admins may edit any.
  if (actor && (actor.role === "INSTRUCTOR" || actor.role === "CLINICAL_INSTRUCTOR") && existing.principalInvestigator !== actor.userId) {
    throw new ForbiddenError("You can only edit your own research projects");
  }

  const values: Record<string, unknown> = { ...data };
  for (const key of ["startDate", "endDate", "irbApprovalDate"]) {
    if (typeof values[key] === "string") values[key] = new Date(values[key] as string);
  }

  const [item] = await db.update(researchProjects).set({ ...values, updatedAt: new Date() }).where(eq(researchProjects.id, id)).returning();

  await logAudit({ action: "UPDATE", resource: "research_project", resourceId: item.id, metadata: { editedBy: actor?.userId, fields: Object.keys(values) } });

  return item;
}

// ─── Cohorts ─────────────────────────────────────────────────────────────────

export async function listCohorts(projectId: string) {
  const items = await db.select().from(researchCohorts).where(eq(researchCohorts.projectId, projectId));
  return items;
}

export async function createCohort(data: { projectId: string; name: string; description?: string; cohortType: string; targetSize?: number; inclusionCriteria?: Record<string, unknown>; exclusionCriteria?: Record<string, unknown> }) {
  const [item] = await db.insert(researchCohorts).values({
    projectId: data.projectId,
    name: data.name,
    description: data.description ?? null,
    cohortType: data.cohortType,
    targetSize: data.targetSize ?? null,
    inclusionCriteria: data.inclusionCriteria ?? null,
    exclusionCriteria: data.exclusionCriteria ?? null,
  }).returning();

  await logAudit({ action: "CREATE", resource: "research_cohort", resourceId: item.id, metadata: { projectId: data.projectId, name: data.name } });

  return item;
}

// ─── Studies ─────────────────────────────────────────────────────────────────

export async function listStudies(projectId: string) {
  const items = await db.select().from(researchStudies).where(eq(researchStudies.projectId, projectId));
  return items;
}

export async function createStudy(data: { projectId: string; cohortId?: string; title: string; description?: string; studyDesign: string; intervention?: string; controlGroup?: string; outcomeMeasures?: string[] }) {
  const [item] = await db.insert(researchStudies).values({
    projectId: data.projectId,
    cohortId: data.cohortId ?? null,
    title: data.title,
    description: data.description ?? null,
    studyDesign: data.studyDesign,
    intervention: data.intervention ?? null,
    controlGroup: data.controlGroup ?? null,
    outcomeMeasures: data.outcomeMeasures ?? null,
  }).returning();

  await logAudit({ action: "CREATE", resource: "research_study", resourceId: item.id, metadata: { projectId: data.projectId, title: data.title } });

  return item;
}

// ─── Participants ────────────────────────────────────────────────────────────

export async function listParticipants(studyId: string) {
  const items = await db.select().from(researchParticipants).where(eq(researchParticipants.studyId, studyId));
  return items;
}

export async function enrollParticipant(studyId: string, cohortId?: string, groupAssignment?: string) {
  const anonymousId = `P-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const [item] = await db.insert(researchParticipants).values({
    studyId,
    cohortId: cohortId ?? null,
    anonymousId,
    groupAssignment: groupAssignment ?? null,
  }).returning();

  await logAudit({ action: "CREATE", resource: "research_participant", resourceId: item.id, metadata: { studyId, anonymousId } });

  return item;
}

// ─── Pre/Post Tests ──────────────────────────────────────────────────────────

export async function recordPrePostTest(data: { participantId: string; studyId: string; testType: string; testDate: string; score: number; maxScore: number; testInstrument?: string; administeredBy?: string; notes?: string }) {
  const percentage = Math.round((data.score / data.maxScore) * 100);
  const [item] = await db.insert(researchPrePostTests).values({
    participantId: data.participantId,
    studyId: data.studyId,
    testType: data.testType,
    testDate: new Date(data.testDate),
    score: data.score,
    maxScore: data.maxScore,
    percentage,
    testInstrument: data.testInstrument ?? null,
    administeredBy: data.administeredBy ?? null,
    notes: data.notes ?? null,
  }).returning();

  await logAudit({ action: "CREATE", resource: "research_pre_post_test", resourceId: item.id, metadata: { studyId: data.studyId, participantId: data.participantId, testType: data.testType } });

  return item;
}

export async function getStudyPrePostAnalysis(studyId: string) {
  const preTests = await db.select().from(researchPrePostTests).where(
    and(eq(researchPrePostTests.studyId, studyId), eq(researchPrePostTests.testType, "PRE"))
  );
  const postTests = await db.select().from(researchPrePostTests).where(
    and(eq(researchPrePostTests.studyId, studyId), eq(researchPrePostTests.testType, "POST"))
  );

  const preAvg = preTests.length > 0 ? Math.round(preTests.reduce((sum, t) => sum + (t.percentage || 0), 0) / preTests.length) : 0;
  const postAvg = postTests.length > 0 ? Math.round(postTests.reduce((sum, t) => sum + (t.percentage || 0), 0) / postTests.length) : 0;

  return {
    studyId,
    preTest: { count: preTests.length, averageScore: preAvg },
    postTest: { count: postTests.length, averageScore: postAvg },
    improvement: postAvg - preAvg,
    improvementPercentage: preAvg > 0 ? Math.round(((postAvg - preAvg) / preAvg) * 100) : 0,
  };
}

// ─── Data Exports ────────────────────────────────────────────────────────────

export async function exportData(data: { projectId: string; exportedBy: string; exportType: string; isAnonymized: boolean }) {
  const participants = await db.select().from(researchParticipants).innerJoin(
    researchStudies, eq(researchParticipants.studyId, researchStudies.id)
  ).where(eq(researchStudies.projectId, data.projectId));

  const prePostTests = await db.select().from(researchPrePostTests).innerJoin(
    researchParticipants, eq(researchPrePostTests.participantId, researchParticipants.id)
  ).innerJoin(researchStudies, eq(researchParticipants.studyId, researchStudies.id)).where(eq(researchStudies.projectId, data.projectId));

  const exportData = {
    participants: participants.map(p => ({
      anonymousId: data.isAnonymized ? p.research_participants.anonymousId : p.research_participants.id,
      groupAssignment: p.research_participants.groupAssignment,
      status: p.research_participants.status,
    })),
    prePostTests: prePostTests.map(t => ({
      testType: t.research_pre_post_tests.testType,
      score: t.research_pre_post_tests.score,
      maxScore: t.research_pre_post_tests.maxScore,
      percentage: t.research_pre_post_tests.percentage,
    })),
  };

  const [item] = await db.insert(researchDataExports).values({
    projectId: data.projectId,
    exportedBy: data.exportedBy,
    exportType: data.exportType,
    isAnonymized: data.isAnonymized,
    recordCount: participants.length,
    metadata: exportData,
  }).returning();

  await logAudit({ userId: data.exportedBy, action: "CREATE", resource: "research_data_export", resourceId: item.id, metadata: { projectId: data.projectId, exportType: data.exportType, recordCount: participants.length } });

  return { ...item, data: exportData };
}

export async function listExports(projectId: string) {
  const items = await db.select().from(researchDataExports).where(eq(researchDataExports.projectId, projectId)).orderBy(desc(researchDataExports.createdAt));
  return items;
}

// ─── Deletion ────────────────────────────────────────────────────────────────────────────

type Actor = { userId: string; role: string };

async function getManagedProject(projectId: string, actor?: Actor) {
  const [project] = await db.select().from(researchProjects).where(eq(researchProjects.id, projectId));
  if (!project) throw new NotFoundError("Research Project");
  // Instructors may manage only their own projects; coordinators/admins may manage any.
  if (actor && (actor.role === "INSTRUCTOR" || actor.role === "CLINICAL_INSTRUCTOR") && project.principalInvestigator !== actor.userId) {
    throw new ForbiddenError("You can only delete your own research projects");
  }
  return project;
}

export async function deleteProject(id: string, actor?: Actor) {
  const project = await getManagedProject(id, actor);

  // Remove children in FK-safe order (pre/post tests and participants reference studies).
  const studies = await db.select({ id: researchStudies.id }).from(researchStudies).where(eq(researchStudies.projectId, id));
  const studyIds = studies.map((s) => s.id);
  if (studyIds.length > 0) {
    await db.delete(researchPrePostTests).where(inArray(researchPrePostTests.studyId, studyIds));
    await db.delete(researchParticipants).where(inArray(researchParticipants.studyId, studyIds));
  }
  await db.delete(researchStudies).where(eq(researchStudies.projectId, id));
  await db.delete(researchCohorts).where(eq(researchCohorts.projectId, id));
  await db.delete(researchDataExports).where(eq(researchDataExports.projectId, id));
  await db.delete(researchProjects).where(eq(researchProjects.id, id));

  await logAudit({ userId: actor?.userId, action: "DELETE", resource: "research_project", resourceId: id, metadata: { title: project.title, deletedBy: actor?.userId } });
  logger.info({ projectId: id }, "Research project deleted");
  return { id, title: project.title };
}

export async function deleteCohort(id: string, actor?: Actor) {
  const [cohort] = await db.select().from(researchCohorts).where(eq(researchCohorts.id, id));
  if (!cohort) throw new NotFoundError("Cohort");
  await getManagedProject(cohort.projectId, actor);

  // Unlink (don't delete) studies and participants that reference this cohort.
  await db.update(researchParticipants).set({ cohortId: null }).where(eq(researchParticipants.cohortId, id));
  await db.update(researchStudies).set({ cohortId: null }).where(eq(researchStudies.cohortId, id));
  await db.delete(researchCohorts).where(eq(researchCohorts.id, id));

  await logAudit({ userId: actor?.userId, action: "DELETE", resource: "research_cohort", resourceId: id, metadata: { projectId: cohort.projectId, name: cohort.name, deletedBy: actor?.userId } });
  logger.info({ cohortId: id }, "Research cohort deleted");
  return { id, name: cohort.name };
}

export async function deleteStudy(id: string, actor?: Actor) {
  const [study] = await db.select().from(researchStudies).where(eq(researchStudies.id, id));
  if (!study) throw new NotFoundError("Study");
  await getManagedProject(study.projectId, actor);

  // Pre/post tests reference studies without cascade, so remove them first.
  await db.delete(researchPrePostTests).where(eq(researchPrePostTests.studyId, id));
  await db.delete(researchParticipants).where(eq(researchParticipants.studyId, id));
  await db.delete(researchStudies).where(eq(researchStudies.id, id));

  await logAudit({ userId: actor?.userId, action: "DELETE", resource: "research_study", resourceId: id, metadata: { projectId: study.projectId, title: study.title, deletedBy: actor?.userId } });
  logger.info({ studyId: id }, "Research study deleted");
  return { id, title: study.title };
}
