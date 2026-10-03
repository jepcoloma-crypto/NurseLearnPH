import { z } from "zod";

// ─── Frameworks ──────────────────────────────────────────────────────────────

export const createFrameworkSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  version: z.string().max(50).optional(),
  programId: z.string().uuid().optional(),
  isDefault: z.boolean().default(false),
});

export const updateFrameworkSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  version: z.string().max(50).optional(),
  isDefault: z.boolean().optional(),
});

// ─── Competencies ────────────────────────────────────────────────────────────

export const competencyLevelEnum = z.enum(["BEGINNER", "DEVELOPING", "COMPETENT", "PROFICIENT", "EXPERT"]);

export const createCompetencySchema = z.object({
  frameworkId: z.string().uuid("Invalid framework ID"),
  parentId: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  targetLevel: competencyLevelEnum.default("COMPETENT"),
});

export const updateCompetencySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  targetLevel: competencyLevelEnum.optional(),
  isActive: z.boolean().optional(),
});

// ─── Indicators ──────────────────────────────────────────────────────────────

export const createIndicatorSchema = z.object({
  description: z.string().min(1, "Description is required"),
  measurementMethod: z.string().max(100).optional(),
});

// ─── Assessments ─────────────────────────────────────────────────────────────

export const assessCompetencySchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  competencyId: z.string().uuid("Invalid competency ID"),
  levelAchieved: competencyLevelEnum,
  score: z.coerce.number().int().min(0).max(100).optional(),
  evidence: z.record(z.unknown()).optional(),
  comments: z.string().optional(),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  frameworkId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  category: z.string().optional(),
  level: competencyLevelEnum.optional(),
});
