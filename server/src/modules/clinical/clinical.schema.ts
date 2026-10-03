import { z } from "zod";

// ─── Clinical Cases ──────────────────────────────────────────────────────────

export const caseDifficultyEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);

export const createCaseSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  department: z.string().max(100).optional(),
  patientName: z.string().max(100).optional(),
  patientAge: z.coerce.number().int().min(0).max(150).optional(),
  patientGender: z.string().max(20).optional(),
  chiefComplaint: z.string().optional(),
  difficulty: caseDifficultyEnum.default("BEGINNER"),
  tags: z.array(z.string()).optional(),
  maxAttempts: z.coerce.number().int().min(1).max(100).default(3),
});

export const updateCaseSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  department: z.string().max(100).optional(),
  patientName: z.string().max(100).optional(),
  patientAge: z.coerce.number().int().min(0).max(150).optional(),
  patientGender: z.string().max(20).optional(),
  chiefComplaint: z.string().optional(),
  difficulty: caseDifficultyEnum.optional(),
  tags: z.array(z.string()).optional(),
  maxAttempts: z.coerce.number().int().min(1).max(100).optional(),
  isPublished: z.boolean().optional(),
});

// ─── Case Stages ─────────────────────────────────────────────────────────────

export const createStageSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  patientData: z.record(z.unknown()).optional(),
  order: z.coerce.number().int().min(0).default(0),
  points: z.coerce.number().int().min(1).default(1),
  options: z
    .array(
      z.object({
        text: z.string().min(1),
        isCorrect: z.boolean(),
        rationale: z.string().optional(),
        order: z.coerce.number().int().min(0).default(0),
      })
    )
    .min(2, "At least 2 options required"),
});

export const updateStageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  patientData: z.record(z.unknown()).optional(),
  order: z.coerce.number().int().min(0).optional(),
  points: z.coerce.number().int().min(1).optional(),
});

// ─── Attempts ────────────────────────────────────────────────────────────────

export const submitCaseResponseSchema = z.object({
  stageId: z.string().uuid("Invalid stage ID"),
  selectedOptionId: z.string().uuid("Invalid option ID"),
});

export const submitCaseAttemptSchema = z.object({
  responses: z.array(submitCaseResponseSchema),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  search: z.string().optional(),
  courseId: z.string().uuid().optional(),
  instructorId: z.string().uuid().optional(),
  difficulty: caseDifficultyEnum.optional(),
  isPublished: z.coerce.boolean().optional(),
  showAll: z.coerce.boolean().optional(),
});
