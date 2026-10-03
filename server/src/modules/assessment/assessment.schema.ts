import { z } from "zod";

// ─── Questions ───────────────────────────────────────────────────────────────

export const questionTypeEnum = z.enum(["MC", "TF", "ESSAY", "FILL_BLANK", "SCENARIO"]);
export const difficultyEnum = z.enum(["EASY", "MEDIUM", "HARD"]);

export const createQuestionSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  topicId: z.string().uuid().optional(),
  type: questionTypeEnum,
  difficulty: difficultyEnum.default("MEDIUM"),
  stem: z.string().min(1, "Question stem is required"),
  explanation: z.string().optional(),
  points: z.coerce.number().int().min(1).default(1),
  options: z
    .array(
      z.object({
        text: z.string().min(1),
        isCorrect: z.boolean(),
        order: z.coerce.number().int().min(0).default(0),
      })
    )
    .min(2, "At least 2 options required for MC questions")
    .optional(),
});

export const updateQuestionSchema = z.object({
  topicId: z.string().uuid().nullable().optional(),
  type: questionTypeEnum.optional(),
  difficulty: difficultyEnum.optional(),
  stem: z.string().min(1).optional(),
  explanation: z.string().optional(),
  points: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

// ─── Assessments ─────────────────────────────────────────────────────────────

export const assessmentTypeEnum = z.enum(["QUIZ", "EXAM", "ASSIGNMENT"]);

export const createAssessmentSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  type: assessmentTypeEnum.default("QUIZ"),
  timeLimitMinutes: z.coerce.number().int().min(1).nullable().optional(),
  passingScore: z.coerce.number().int().min(0).max(100).default(75),
  maxAttempts: z.coerce.number().int().min(1).default(1),
  questionIds: z.array(z.string().uuid()).optional(),
});

export const updateAssessmentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  type: assessmentTypeEnum.optional(),
  timeLimitMinutes: z.coerce.number().int().min(1).nullable().optional(),
  passingScore: z.coerce.number().int().min(0).max(100).optional(),
  maxAttempts: z.coerce.number().int().min(1).optional(),
  isPublished: z.boolean().optional(),
});

// ─── Attempts ────────────────────────────────────────────────────────────────

export const submitAnswerSchema = z.object({
  questionId: z.string().uuid("Invalid question ID"),
  selectedOptionId: z.string().uuid().nullable().optional(),
  textAnswer: z.string().nullable().optional(),
});

export const submitAttemptSchema = z.object({
  answers: z.array(submitAnswerSchema),
});

export const gradeAttemptSchema = z.object({
  answers: z.array(z.object({
    answerId: z.string().uuid(),
    pointsAwarded: z.coerce.number().min(0),
    feedback: z.string().optional(),
  })),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  search: z.string().optional(),
  courseId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
  instructorId: z.string().uuid().optional(),
  type: questionTypeEnum.optional(),
  difficulty: difficultyEnum.optional(),
  isActive: z.coerce.boolean().optional(),
});

export const listAttemptsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  assessmentId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
});

export const gradebookQuerySchema = z.object({
  courseId: z.string().uuid("Course ID is required"),
});
