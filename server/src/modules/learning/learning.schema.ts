import { z } from "zod";

// ─── Topics ──────────────────────────────────────────────────────────────────

export const createTopicSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
});

export const updateTopicSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  order: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// ─── Lessons ─────────────────────────────────────────────────────────────────

export const createLessonSchema = z.object({
  topicId: z.string().uuid("Invalid topic ID"),
  title: z.string().min(1, "Title is required").max(255),
  content: z.string().optional(),
});

export const updateLessonSchema = z.object({
  topicId: z.string().uuid().optional(),
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
  order: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// ─── Learning Materials ──────────────────────────────────────────────────────

export const materialTypeEnum = z.enum(["TEXT", "VIDEO", "DOCUMENT", "LINK", "IMAGE"]);

export const createMaterialSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  type: materialTypeEnum,
  content: z.string().optional(),
  url: z.string().url("Invalid URL").max(1000).optional(),
  filePath: z.string().max(500).optional(),
  isRequired: z.boolean().default(true),
});

export const updateMaterialSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  type: materialTypeEnum.optional(),
  content: z.string().optional(),
  url: z.string().url().max(1000).optional(),
  filePath: z.string().max(500).optional(),
  order: z.coerce.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
});

// ─── Learning Activities ─────────────────────────────────────────────────────

export const activityTypeEnum = z.enum([
  "READING",
  "VIDEO_WATCH",
  "QUIZ",
  "REFLECTION",
  "CASE_STUDY",
  "DISCUSSION",
  "PRACTICE",
  "ASSIGNMENT",
]);

export const createActivitySchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  type: activityTypeEnum,
  description: z.string().optional(),
  instructions: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  points: z.coerce.number().int().min(0).default(0),
  isRequired: z.boolean().default(true),
});

export const updateActivitySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  type: activityTypeEnum.optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  points: z.coerce.number().int().min(0).optional(),
  order: z.coerce.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
});

// ─── Student Progress ────────────────────────────────────────────────────────

export const updateProgressSchema = z.object({
  lessonId: z.string().uuid("Invalid lesson ID"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]),
  timeSpentSeconds: z.coerce.number().int().min(0).optional(),
  score: z.coerce.number().int().min(0).max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  search: z.string().optional(),
  courseId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
  instructorId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
});
