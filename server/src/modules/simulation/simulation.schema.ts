import { z } from "zod";

// ─── Virtual Patients ────────────────────────────────────────────────────────

export const createPatientSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  age: z.coerce.number().int().min(0).max(150),
  gender: z.string().min(1, "Gender is required"),
  medicalHistory: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  currentMedications: z.array(z.string()).optional(),
  chiefComplaint: z.string().optional(),
});

export const updatePatientSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  age: z.coerce.number().int().min(0).max(150).optional(),
  gender: z.string().optional(),
  medicalHistory: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  currentMedications: z.array(z.string()).optional(),
  chiefComplaint: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ─── Patient Scenarios ───────────────────────────────────────────────────────

export const createScenarioSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  category: z.string().min(1, "Category is required"),
  initialVitalSigns: z.record(z.unknown()),
  initialSymptoms: z.array(z.string()),
  initialConsciousness: z.string().default("ALERT"),
  learningObjectives: z.array(z.string()).optional(),
  timeLimitMinutes: z.coerce.number().int().min(1).max(180).default(30),
  maxScore: z.coerce.number().int().min(1).default(100),
});

export const updateScenarioSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  category: z.string().optional(),
  timeLimitMinutes: z.coerce.number().int().min(1).max(180).optional(),
  maxScore: z.coerce.number().int().min(1).optional(),
});

// ─── State Transitions ───────────────────────────────────────────────────────

export const createStateTransitionSchema = z.object({
  triggerAction: z.string().min(1, "Trigger action is required"),
  newVitalSigns: z.record(z.unknown()).optional(),
  newSymptoms: z.array(z.string()).optional(),
  newConsciousness: z.string().optional(),
  deteriorationLevel: z.coerce.number().int().min(0).max(10).default(0),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

// ─── Nursing Actions ─────────────────────────────────────────────────────────

export const createActionSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  points: z.coerce.number().int().min(0).default(10),
  isApplicableTo: z.array(z.string()).optional(),
});

// ─── Patient Responses ───────────────────────────────────────────────────────

export const createResponseSchema = z.object({
  actionId: z.string().uuid("Invalid action ID"),
  responseText: z.string().min(1, "Response text is required"),
  vitalSignsChange: z.record(z.unknown()).optional(),
  symptomChange: z.array(z.string()).optional(),
  pointsAwarded: z.coerce.number().int().min(0).default(0),
  feedback: z.string().optional(),
});

// ─── Simulation Sessions ─────────────────────────────────────────────────────

export const startSessionSchema = z.object({
  scenarioId: z.string().uuid("Invalid scenario ID"),
});

export const performActionSchema = z.object({
  actionId: z.string().uuid("Invalid action ID"),
  notes: z.string().optional(),
});

export const completeSessionSchema = z.object({
  overallRating: z.coerce.number().int().min(1).max(5).optional(),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
  clinicalReasoningScore: z.coerce.number().int().min(0).max(100).optional(),
  technicalSkillsScore: z.coerce.number().int().min(0).max(100).optional(),
  communicationScore: z.coerce.number().int().min(0).max(100).optional(),
  timeManagementScore: z.coerce.number().int().min(0).max(100).optional(),
  notes: z.string().optional(),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  category: z.string().optional(),
  patientId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
});
