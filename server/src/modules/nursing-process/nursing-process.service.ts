import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  courses,
  nursingDiagnoses,
  carePlans,
  carePlanDiagnoses,
  carePlanOutcomes,
  carePlanInterventions,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { AppError, NotFoundError, ForbiddenError, ConflictError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";

const logger = createChildLogger("nursing-process-service");

// ─── Nursing Diagnoses ───────────────────────────────────────────────────────

export async function listDiagnoses(query: { page: number; limit: number; isActive?: boolean }) {
  const { page, limit, isActive } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (isActive !== undefined) conditions.push(eq(nursingDiagnoses.isActive, isActive));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(nursingDiagnoses).where(where);

  const items = await db.select().from(nursingDiagnoses).where(where).orderBy(nursingDiagnoses.code).limit(limit).offset(offset);
  return {
    items,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getDiagnosisById(id: string) {
  const [item] = await db.select().from(nursingDiagnoses).where(eq(nursingDiagnoses.id, id));
  if (!item) throw new NotFoundError("Nursing Diagnosis");
  return item;
}

export async function createDiagnosis(
  data: {
    code: string;
    name: string;
    category?: string;
    definition?: string;
    riskFactors?: string[];
    relatedFactors?: string[];
  },
  createdBy?: string
) {
  const [existingCode] = await db.select().from(nursingDiagnoses).where(eq(nursingDiagnoses.code, data.code));
  if (existingCode) throw new ConflictError(`Diagnosis with code ${data.code} already exists`);

  const trimmedName = data.name.trim();
  const [existingName] = await db
    .select({ id: nursingDiagnoses.id })
    .from(nursingDiagnoses)
    .where(sql`lower(${nursingDiagnoses.name}) = lower(${trimmedName})`)
    .limit(1);
  if (existingName) throw new ConflictError(`Diagnosis with name "${trimmedName}" already exists`);

  const [item] = await db
    .insert(nursingDiagnoses)
    .values({
      code: data.code,
      name: trimmedName,
      category: data.category ?? null,
      definition: data.definition ?? null,
      riskFactors: data.riskFactors ?? null,
      relatedFactors: data.relatedFactors ?? null,
    })
    .returning();

  await logAudit({ userId: createdBy, action: "CREATE_DIAGNOSIS", resource: "NURSING_DIAGNOSIS", resourceId: item.id });
  return item;
}

export async function updateDiagnosis(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(nursingDiagnoses).where(eq(nursingDiagnoses.id, id));
  if (!existing) throw new NotFoundError("Nursing Diagnosis");

  // Prevent renaming to a name used by another diagnosis (case-insensitive)
  if (typeof data.name === "string") {
    const trimmedName = data.name.trim();
    if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
      const [conflict] = await db
        .select({ id: nursingDiagnoses.id })
        .from(nursingDiagnoses)
        .where(sql`lower(${nursingDiagnoses.name}) = lower(${trimmedName})`)
        .limit(1);
      if (conflict) throw new ConflictError(`Diagnosis with name "${trimmedName}" already exists`);
    }
    data.name = trimmedName;
  }

  const [item] = await db.update(nursingDiagnoses).set(data).where(eq(nursingDiagnoses.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_DIAGNOSIS", resource: "NURSING_DIAGNOSIS", resourceId: id });
  return item;
}

// ─── Care Plans ──────────────────────────────────────────────────────────────

export async function listCarePlans(query: {
  courseId?: string;
  instructorId?: string;
  studentId?: string;
  status?: string;
  page: number;
  limit: number;
}) {
  const { courseId, instructorId, studentId, status, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (courseId) conditions.push(eq(carePlans.courseId, courseId));
  if (instructorId) conditions.push(eq(courses.instructorId, instructorId));
  if (studentId) conditions.push(eq(carePlans.studentId, studentId));
  if (status) conditions.push(eq(carePlans.status, status as "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "RETURNED" | "ACTIVE" | "COMPLETED" | "ARCHIVED"));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const useJoin = !!instructorId;
  const baseQuery = useJoin
    ? db.select({ count: sql<number>`count(*)::int` }).from(carePlans).innerJoin(courses, eq(carePlans.courseId, courses.id))
    : db.select({ count: sql<number>`count(*)::int` }).from(carePlans);
  const [countResult] = await baseQuery.where(where);

  const rawItems = useJoin
    ? await db.select().from(carePlans).innerJoin(courses, eq(carePlans.courseId, courses.id)).where(where).orderBy(desc(carePlans.createdAt)).limit(limit).offset(offset)
    : await db.select().from(carePlans).where(where).orderBy(desc(carePlans.createdAt)).limit(limit).offset(offset);
  const items = useJoin ? (rawItems as any[]).map((row) => row.carePlans ?? Object.values(row)[0]) : rawItems;
  return {
    items,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getCarePlanById(id: string) {
  const [plan] = await db.select().from(carePlans).where(eq(carePlans.id, id));
  if (!plan) throw new NotFoundError("Care Plan");

  const diagnoses = await db.select().from(carePlanDiagnoses).where(eq(carePlanDiagnoses.carePlanId, id)).orderBy(carePlanDiagnoses.priority);

  const diagnosesWithDetails = await Promise.all(
    diagnoses.map(async (d) => {
      const [diagnosis] = await db.select().from(nursingDiagnoses).where(eq(nursingDiagnoses.id, d.diagnosisId));
      const outcomes = await db.select().from(carePlanOutcomes).where(eq(carePlanOutcomes.carePlanDiagnosisId, d.id));
      const interventions = await db.select().from(carePlanInterventions).where(eq(carePlanInterventions.carePlanDiagnosisId, d.id));
      return { ...d, diagnosis, outcomes, interventions };
    })
  );

  return { ...plan, diagnoses: diagnosesWithDetails };
}

export async function createCarePlan(
  data: {
    courseId: string;
    studentId: string;
    caseId?: string;
    title: string;
    patientName?: string;
    patientAge?: number;
    patientGender?: string;
    medicalDiagnosis?: string;
    subjectiveData?: string;
    objectiveData?: string;
  },
  createdBy?: string
) {
  const [item] = await db
    .insert(carePlans)
    .values({
      courseId: data.courseId,
      studentId: data.studentId,
      caseId: data.caseId ?? null,
      title: data.title,
      patientName: data.patientName ?? null,
      patientAge: data.patientAge ?? null,
      patientGender: data.patientGender ?? null,
      medicalDiagnosis: data.medicalDiagnosis ?? null,
      subjectiveData: data.subjectiveData ?? null,
      objectiveData: data.objectiveData ?? null,
      createdBy: createdBy ?? null,
    })
    .returning();

  await logAudit({ userId: createdBy, action: "CREATE_CARE_PLAN", resource: "CARE_PLAN", resourceId: item.id });
  return item;
}

export async function updateCarePlan(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(carePlans).where(eq(carePlans.id, id));
  if (!existing) throw new NotFoundError("Care Plan");

  if (!updatedBy || existing.createdBy !== updatedBy) throw new ForbiddenError("You can only edit your own care plan");
  if (existing.status !== "DRAFT" && existing.status !== "RETURNED") {
    throw new ForbiddenError(`A care plan with status "${existing.status}" cannot be edited. Only DRAFT or RETURNED plans can be edited.`);
  }

  const [item] = await db.update(carePlans).set({ ...data, updatedAt: new Date() }).where(eq(carePlans.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_CARE_PLAN", resource: "CARE_PLAN", resourceId: id });
  return item;
}

export async function deleteCarePlan(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(carePlans).where(eq(carePlans.id, id));
  if (!existing) throw new NotFoundError("Care Plan");

  if (!deletedBy || existing.createdBy !== deletedBy) throw new ForbiddenError("You can only delete your own care plan");
  if (existing.status !== "DRAFT") {
    throw new ForbiddenError(`A care plan with status "${existing.status}" cannot be deleted. Only DRAFT care plans can be deleted.`);
  }

  await db.delete(carePlans).where(eq(carePlans.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_CARE_PLAN", resource: "CARE_PLAN", resourceId: id });
}

// ─── Submit / Recall ─────────────────────────────────────────────────────────

export async function submitCarePlan(id: string, status: "SUBMITTED" | "DRAFT", submittedBy?: string) {
  const [existing] = await db.select().from(carePlans).where(eq(carePlans.id, id));
  if (!existing) throw new NotFoundError("Care Plan");

  // Validate transition
  if (status === "SUBMITTED" && existing.status !== "DRAFT" && existing.status !== "RETURNED") {
    throw new ForbiddenError("Care plan can only be submitted from DRAFT or RETURNED status");
  }
  if (status === "DRAFT" && existing.status !== "SUBMITTED") {
    throw new ForbiddenError("Care plan can only be recalled from SUBMITTED status");
  }

  const newStatus = status === "SUBMITTED" ? "SUBMITTED" : "DRAFT";
  const [item] = await db.update(carePlans).set({ status: newStatus, updatedAt: new Date() }).where(eq(carePlans.id, id)).returning();
  await logAudit({ userId: submittedBy, action: status === "SUBMITTED" ? "SUBMIT_CARE_PLAN" : "RECALL_CARE_PLAN", resource: "CARE_PLAN", resourceId: id });
  return item;
}

// ─── Evaluate ────────────────────────────────────────────────────────────────

export async function evaluateCarePlan(id: string, evaluatedBy: string, data: { evaluationNotes: string; status: string }) {
  const [existing] = await db.select().from(carePlans).where(eq(carePlans.id, id));
  if (!existing) throw new NotFoundError("Care Plan");

  // Context-aware transition rules (care plan lifecycle):
  //   SUBMITTED / UNDER_REVIEW -> APPROVED (content accepted) | RETURNED (revise)
  //   APPROVED                -> COMPLETED (implementation + outcome evaluation done) | RETURNED
  //   COMPLETED               -> APPROVED (reopen) | RETURNED
  const allowedTransitions: Record<string, string[]> = {
    SUBMITTED: ["APPROVED", "RETURNED"],
    UNDER_REVIEW: ["APPROVED", "RETURNED"],
    APPROVED: ["COMPLETED", "RETURNED"],
    COMPLETED: ["APPROVED", "RETURNED"],
  };
  const allowed = allowedTransitions[existing.status] ?? [];
  if (!allowed.includes(data.status)) {
    throw new AppError(
      `Cannot change care plan from "${existing.status}" to "${data.status}".` +
        (allowed.length ? ` Allowed transitions: ${allowed.join(", ")}.` : " The student must submit the care plan first."),
      400
    );
  }

  const [item] = await db
    .update(carePlans)
    .set({
      evaluationNotes: data.evaluationNotes,
      status: data.status as "APPROVED" | "RETURNED" | "COMPLETED",
      evaluatedBy,
      evaluatedAt: new Date(),
      reviewedBy: evaluatedBy,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(carePlans.id, id))
    .returning();

  await logAudit({ userId: evaluatedBy, action: "EVALUATE_CARE_PLAN", resource: "CARE_PLAN", resourceId: id });
  return item;
}

// ─── Care Plan Diagnoses ─────────────────────────────────────────────────────

export async function addDiagnosis(carePlanId: string, data: {
  diagnosisId: string;
  priority?: number;
  evidence?: string;
  rationale?: string;
  goalType?: string;
  assessmentData?: string;
}) {
  const [plan] = await db.select().from(carePlans).where(eq(carePlans.id, carePlanId));
  if (!plan) throw new NotFoundError("Care Plan");

  const [item] = await db
    .insert(carePlanDiagnoses)
    .values({
      carePlanId,
      diagnosisId: data.diagnosisId,
      priority: data.priority ?? 1,
      evidence: data.evidence ?? null,
      rationale: data.rationale ?? null,
      goalType: (data.goalType as "SHORT_TERM" | "LONG_TERM" | null) ?? "SHORT_TERM",
      assessmentData: data.assessmentData ?? null,
    })
    .returning();

  return item;
}

export async function updateDiagnosisOnPlan(id: string, data: {
  priority?: number;
  evidence?: string;
  rationale?: string;
  goalType?: string;
  assessmentData?: string;
}) {
  const [existing] = await db.select().from(carePlanDiagnoses).where(eq(carePlanDiagnoses.id, id));
  if (!existing) throw new NotFoundError("Care Plan Diagnosis");

  const updateData: Record<string, unknown> = {};
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.evidence !== undefined) updateData.evidence = data.evidence;
  if (data.rationale !== undefined) updateData.rationale = data.rationale;
  if (data.goalType !== undefined) updateData.goalType = data.goalType;
  if (data.assessmentData !== undefined) updateData.assessmentData = data.assessmentData;

  const [item] = await db.update(carePlanDiagnoses).set(updateData).where(eq(carePlanDiagnoses.id, id)).returning();
  return item;
}

export async function removeDiagnosis(id: string) {
  const [existing] = await db.select().from(carePlanDiagnoses).where(eq(carePlanDiagnoses.id, id));
  if (!existing) throw new NotFoundError("Care Plan Diagnosis");

  await db.delete(carePlanDiagnoses).where(eq(carePlanDiagnoses.id, id));
}

// ─── Care Plan Outcomes ──────────────────────────────────────────────────────

export async function addOutcome(carePlanDiagnosisId: string, data: { description: string; timeframe?: string; criteria?: string }) {
  const [item] = await db
    .insert(carePlanOutcomes)
    .values({
      carePlanDiagnosisId,
      description: data.description,
      timeframe: data.timeframe ?? null,
      criteria: data.criteria ?? null,
    })
    .returning();

  return item;
}

export async function updateOutcome(id: string, data: { isMet?: boolean; evaluationNotes?: string; actualOutcome?: string }) {
  const [existing] = await db.select().from(carePlanOutcomes).where(eq(carePlanOutcomes.id, id));
  if (!existing) throw new NotFoundError("Care Plan Outcome");

  const updateData: Record<string, unknown> = {};
  if (data.isMet !== undefined) updateData.isMet = data.isMet;
  if (data.evaluationNotes !== undefined) updateData.evaluationNotes = data.evaluationNotes;
  if (data.actualOutcome !== undefined) updateData.actualOutcome = data.actualOutcome;
  if (data.isMet !== undefined) updateData.evaluatedAt = new Date();

  const [item] = await db.update(carePlanOutcomes).set(updateData).where(eq(carePlanOutcomes.id, id)).returning();
  return item;
}

export async function removeOutcome(id: string) {
  const [existing] = await db.select().from(carePlanOutcomes).where(eq(carePlanOutcomes.id, id));
  if (!existing) throw new NotFoundError("Care Plan Outcome");

  await db.delete(carePlanOutcomes).where(eq(carePlanOutcomes.id, id));
}

// ─── Care Plan Interventions ─────────────────────────────────────────────────

export async function addIntervention(carePlanDiagnosisId: string, data: {
  category: string;
  description: string;
  rationale?: string;
  frequency?: string;
  expectedTime?: string;
}) {
  const [item] = await db
    .insert(carePlanInterventions)
    .values({
      carePlanDiagnosisId,
      category: data.category as "ASSESSMENT" | "THERAPEUTIC" | "TEACHING" | "COORDINATION" | "COLLABORATIVE" | "PATIENT_CONTROL",
      description: data.description,
      rationale: data.rationale ?? null,
      frequency: data.frequency ?? null,
      expectedTime: data.expectedTime ?? null,
    })
    .returning();

  return item;
}

export async function updateIntervention(id: string, data: { isCompleted?: boolean }) {
  const [existing] = await db.select().from(carePlanInterventions).where(eq(carePlanInterventions.id, id));
  if (!existing) throw new NotFoundError("Care Plan Intervention");

  const [item] = await db.update(carePlanInterventions).set(data).where(eq(carePlanInterventions.id, id)).returning();
  return item;
}

export async function removeIntervention(id: string) {
  const [existing] = await db.select().from(carePlanInterventions).where(eq(carePlanInterventions.id, id));
  if (!existing) throw new NotFoundError("Care Plan Intervention");

  await db.delete(carePlanInterventions).where(eq(carePlanInterventions.id, id));
}

// ─── Review (legacy) ─────────────────────────────────────────────────────────

export async function reviewCarePlan(id: string, reviewedBy: string, data: { feedback: string; status: string }) {
  const [existing] = await db.select().from(carePlans).where(eq(carePlans.id, id));
  if (!existing) throw new NotFoundError("Care Plan");

  const [item] = await db
    .update(carePlans)
    .set({
      feedback: data.feedback,
      status: data.status as "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "RETURNED" | "ACTIVE" | "COMPLETED" | "ARCHIVED",
      reviewedBy,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(carePlans.id, id))
    .returning();

  await logAudit({ userId: reviewedBy, action: "REVIEW_CARE_PLAN", resource: "CARE_PLAN", resourceId: id });
  return item;
}
