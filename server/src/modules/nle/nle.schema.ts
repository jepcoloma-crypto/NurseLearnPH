import { z } from "zod";

// ─── Categories ──────────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  code: z.string().min(1, "Code is required").max(50),
  parentId: z.string().uuid().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

// ─── Questions ───────────────────────────────────────────────────────────────

export const createQuestionSchema = z.object({
  categoryId: z.string().uuid("Invalid category ID"),
  questionText: z.string().min(1, "Question text is required"),
  questionType: z.enum(["MC", "TF", "ESSAY", "FILL_BLANK"]).default("MC"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  explanation: z.string().optional(),
  isHighYield: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
  options: z.array(z.object({
    optionText: z.string().min(1),
    isCorrect: z.boolean().default(false),
  })).min(2, "At least 2 options required"),
});

export const updateQuestionSchema = z.object({
  questionText: z.string().min(1).optional(),
  categoryId: z.string().uuid("Invalid category ID").optional(),
  questionType: z.enum(["MC", "TF", "ESSAY", "FILL_BLANK"]).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  explanation: z.string().optional(),
  isHighYield: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  options: z.array(z.object({
    optionText: z.string().min(1),
    isCorrect: z.boolean().default(false),
  })).min(2, "At least 2 options required")
    .refine((opts) => opts.some((o) => o.isCorrect), "At least one correct option")
    .optional(),
});

// ─── Exams ───────────────────────────────────────────────────────────────────

export const createExamSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  examType: z.enum(["PRACTICE", "MOCK", "TIMED"]).default("PRACTICE"),
  categoryFilter: z.array(z.string().uuid()).optional(),
  questionCount: z.coerce.number().int().min(1).max(500).default(50),
  timeLimitMinutes: z.coerce.number().int().min(1).max(480).default(90),
  passingScore: z.coerce.number().int().min(0).max(100).default(75),
  isRandomized: z.boolean().default(true),
  showExplanations: z.boolean().default(true),
});

export const updateExamSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  questionCount: z.coerce.number().int().min(1).max(500).optional(),
  timeLimitMinutes: z.coerce.number().int().min(1).max(480).optional(),
  passingScore: z.coerce.number().int().min(0).max(100).optional(),
});

// ─── Exam Attempts ───────────────────────────────────────────────────────────

export const startExamSchema = z.object({
  examId: z.string().uuid("Invalid exam ID"),
});

export const answerQuestionSchema = z.object({
  questionId: z.string().uuid("Invalid question ID"),
  selectedOptionId: z.string().uuid("Invalid option ID").optional(),
  timeSpentSeconds: z.coerce.number().int().min(0).optional(),
});

export const submitExamSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    selectedOptionId: z.string().uuid().optional(),
    timeSpentSeconds: z.coerce.number().int().min(0).optional(),
  })),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  categoryId: z.string().uuid().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  examType: z.enum(["PRACTICE", "MOCK", "TIMED"]).optional(),
  studentId: z.string().uuid().optional(),
});

export const practiceQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  count: z.coerce.number().int().min(1).max(100).default(10),
  highYieldOnly: z.coerce.boolean().default(false),
});

export const checkPracticeSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid("Invalid question ID"),
    selectedOptionId: z.string().uuid("Invalid option ID").optional(),
  })).min(1, "At least one answer required").max(100),
});
