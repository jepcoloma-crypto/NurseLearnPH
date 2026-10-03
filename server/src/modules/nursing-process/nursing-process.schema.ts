import { z } from "zod";

// ─── Nursing Diagnoses ───────────────────────────────────────────────────────

export const createDiagnosisSchema = z.object({
  code: z.string().min(1, "Code is required").max(50),
  name: z.string().min(1, "Name is required").max(255),
  category: z.string().max(100).optional(),
  definition: z.string().optional(),
  riskFactors: z.array(z.string()).optional(),
  relatedFactors: z.array(z.string()).optional(),
});

export const updateDiagnosisSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.string().max(100).optional(),
  definition: z.string().optional(),
  riskFactors: z.array(z.string()).optional(),
  relatedFactors: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ─── Care Plans ──────────────────────────────────────────────────────────────

export const carePlanStatusEnum = z.enum([
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "RETURNED",
  "ACTIVE",
  "COMPLETED",
  "ARCHIVED",
]);

export const goalTypeEnum = z.enum(["SHORT_TERM", "LONG_TERM"]);

export const createCarePlanSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  caseId: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required").max(255),
  patientName: z.string().max(100).optional(),
  patientAge: z.coerce.number().int().min(0).max(150).optional(),
  patientGender: z.string().max(20).optional(),
  medicalDiagnosis: z.string().optional(),
  subjectiveData: z.string().optional(),
  objectiveData: z.string().optional(),
});

export const updateCarePlanSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  patientName: z.string().max(100).optional(),
  patientAge: z.coerce.number().int().min(0).max(150).optional(),
  patientGender: z.string().max(20).optional(),
  medicalDiagnosis: z.string().optional(),
  subjectiveData: z.string().optional(),
  objectiveData: z.string().optional(),
  // NOTE: status is intentionally NOT editable here — status transitions only go
  // through submit/evaluate endpoints (DRAFT -> SUBMITTED -> APPROVED -> COMPLETED).
});

// ─── Care Plan Diagnoses ─────────────────────────────────────────────────────

export const addDiagnosisToPlanSchema = z.object({
  diagnosisId: z.string().uuid("Invalid diagnosis ID"),
  priority: z.coerce.number().int().min(1).default(1),
  evidence: z.string().optional(),
  rationale: z.string().optional(),
  goalType: goalTypeEnum.default("SHORT_TERM"),
  assessmentData: z.string().optional(),
});

// ─── Care Plan Outcomes ──────────────────────────────────────────────────────

export const createOutcomeSchema = z.object({
  description: z.string().min(1, "Description is required"),
  timeframe: z.string().max(100).optional(),
  criteria: z.string().optional(),
});

export const updateOutcomeSchema = z.object({
  isMet: z.boolean().optional(),
  evaluationNotes: z.string().optional(),
  actualOutcome: z.string().optional(),
});

// ─── Care Plan Interventions ─────────────────────────────────────────────────

export const interventionCategoryEnum = z.enum([
  "ASSESSMENT",
  "THERAPEUTIC",
  "TEACHING",
  "COORDINATION",
  "COLLABORATIVE",
  "PATIENT_CONTROL",
]);

export const createInterventionSchema = z.object({
  category: interventionCategoryEnum,
  description: z.string().min(1, "Description is required"),
  rationale: z.string().optional(),
  frequency: z.string().max(100).optional(),
  expectedTime: z.string().max(100).optional(),
});

// ─── Review ──────────────────────────────────────────────────────────────────

export const reviewCarePlanSchema = z.object({
  feedback: z.string().min(1, "Feedback is required"),
  status: carePlanStatusEnum,
});

// ─── Submit for Review ───────────────────────────────────────────────────────

export const submitCarePlanSchema = z.object({
  status: z.enum(["SUBMITTED", "DRAFT"]),
});

// ─── Evaluate ────────────────────────────────────────────────────────────────

export const evaluateCarePlanSchema = z.object({
  evaluationNotes: z.string().min(1, "Evaluation notes are required"),
  status: z.enum(["APPROVED", "RETURNED", "COMPLETED"]),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  courseId: z.string().uuid().optional(),
  instructorId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  status: carePlanStatusEnum.optional(),
});
