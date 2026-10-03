import { z } from "zod";

// ─── Questions ───────────────────────────────────────────────────────────────

export const generateQuestionSchema = z.object({
  courseId: z.string().uuid().optional(),
  topic: z.string().min(1, "Topic is required"),
  questionType: z.enum(["MC", "TF", "ESSAY", "FILL_BLANK"]).default("MC"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  count: z.coerce.number().int().min(1).max(10).default(1),
});

export const reviewQuestionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "REVISION_NEEDED"]),
  reviewNotes: z.string().optional(),
});

// ─── Cases ───────────────────────────────────────────────────────────────────

export const generateCaseSchema = z.object({
  courseId: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  focusArea: z.string().optional(),
});

export const reviewCaseSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "REVISION_NEEDED"]),
  reviewNotes: z.string().optional(),
});

// ─── Study Guides ────────────────────────────────────────────────────────────

export const generateStudyGuideSchema = z.object({
  courseId: z.string().uuid().optional(),
  lessonId: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required"),
  topic: z.string().min(1, "Topic is required"),
  includePracticeQuestions: z.boolean().default(true),
});

export const reviewStudyGuideSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "REVISION_NEEDED"]),
  reviewNotes: z.string().optional(),
});

// ─── Updates (revise flow: PENDING / REVISION_NEEDED → back to PENDING) ──────

export const updateQuestionSchema = z.object({
  topic: z.string().min(1).optional(),
  questionText: z.string().min(1).optional(),
  options: z.array(z.string().min(1)).min(2).optional(),
  correctAnswer: z.string().min(1).optional(),
  explanation: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
});

export const updateCaseSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  clinicalPresentation: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  stages: z.array(z.object({ stage: z.number().int().positive(), description: z.string().min(1), actions: z.array(z.unknown()).optional() })).optional(),
  learningObjectives: z.array(z.string().min(1)).optional(),
});

export const updateStudyGuideSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  summary: z.string().optional(),
  keyPoints: z.array(z.string().min(1)).optional(),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  courseId: z.string().uuid().optional(),
  instructorId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "REVISION_NEEDED"]).optional(),
  topic: z.string().optional(),
});

// ─── File Analysis ───────────────────────────────────────────────────────────

export const analyzeFileSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  mimeType: z.string().min(1, "MIME type is required"),
  fileBase64: z.string().min(1, "File data is required"),
});
