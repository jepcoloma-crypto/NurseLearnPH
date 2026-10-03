import { z } from "zod";

// ─── Chat ────────────────────────────────────────────────────────────────────

export const chatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  lessonId: z.string().uuid().optional(),
  message: z.string().min(1, "Message is required").max(5000),
  mode: z.enum(["STANDARD", "SOCRATIC", "HINT_MODE"]).default("STANDARD"),
});

// ─── Hints ───────────────────────────────────────────────────────────────────

export const hintSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  subtopic: z.string().optional(),
  currentLevel: z.coerce.number().int().min(1).max(5).default(1),
});

// ─── Socratic ────────────────────────────────────────────────────────────────

export const socraticSchema = z.object({
  conversationId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  topic: z.string().min(1, "Topic is required"),
  studentAnswer: z.string().optional(),
});

// ─── Lesson Assistance ───────────────────────────────────────────────────────

export const lessonAssistSchema = z.object({
  lessonId: z.string().uuid("Invalid lesson ID"),
  question: z.string().min(1, "Question is required").max(2000),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  courseId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
});
