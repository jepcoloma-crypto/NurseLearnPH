import { z } from "zod";

// ─── Learning Paths ──────────────────────────────────────────────────────────

export const createLearningPathSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  isAdaptive: z.boolean().default(false),
});

export const updateLearningPathSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "PAUSED"]).optional(),
});

// ─── Path Items ──────────────────────────────────────────────────────────────

export const addPathItemSchema = z.object({
  itemType: z.string().min(1, "Item type is required"),
  itemId: z.string().uuid("Invalid item ID"),
  order: z.coerce.number().int().min(0).default(0),
  isRequired: z.boolean().default(true),
});

// ─── Remediation Plans ───────────────────────────────────────────────────────

export const createRemediationPlanSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  courseId: z.string().uuid("Invalid course ID"),
  title: z.string().min(1, "Title is required").max(255),
  reason: z.string().optional(),
  targetCompetency: z.string().max(255).optional(),
});

export const updateRemediationPlanSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
});

// ─── Remediation Items ───────────────────────────────────────────────────────

export const addRemediationItemSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  itemType: z.string().min(1, "Item type is required"),
  itemId: z.string().uuid().optional(),
  order: z.coerce.number().int().min(0).default(0),
});

// ─── Prerequisites ───────────────────────────────────────────────────────────

export const addPrerequisiteSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  prerequisiteCourseId: z.string().uuid("Invalid prerequisite course ID"),
  isRequired: z.boolean().default(true),
  minimumGrade: z.string().max(10).optional(),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  courseId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  status: z.string().optional(),
});
