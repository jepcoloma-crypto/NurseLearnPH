import { z } from "zod";

// ─── Portfolios ──────────────────────────────────────────────────────────────

export const createPortfolioSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
});

export const updatePortfolioSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  isPublished: z.boolean().optional(),
});

// ─── Portfolio Items ─────────────────────────────────────────────────────────

export const createPortfolioItemSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  itemType: z.string().min(1, "Item type is required"),
  content: z.record(z.unknown()).optional(),
  order: z.coerce.number().int().min(0).default(0),
  isPublished: z.boolean().default(false),
});

export const updatePortfolioItemSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  content: z.record(z.unknown()).optional(),
  order: z.coerce.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

// ─── Reflections ─────────────────────────────────────────────────────────────

export const createReflectionSchema = z.object({
  courseId: z.string().uuid().optional(),
  clinicalRotationId: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required").max(255),
  content: z.string().min(1, "Content is required"),
  reflectionType: z.string().default("CLINICAL"),
  mood: z.string().max(50).optional(),
  tags: z.array(z.string()).optional(),
  isPublished: z.boolean().default(false),
});

export const updateReflectionSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  mood: z.string().max(50).optional(),
  tags: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
});

// ─── Clinical Experience Logs ────────────────────────────────────────────────

export const createClinicalExpLogSchema = z.object({
  clinicalRotationId: z.string().uuid().optional(),
  patientCount: z.coerce.number().int().min(0).default(0),
  proceduresPerformed: z.array(z.string()).optional(),
  skillsApplied: z.array(z.string()).optional(),
  challenges: z.string().optional(),
  learnings: z.string().optional(),
  supervisorNotes: z.string().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  date: z.string().datetime("Invalid date format"),
});

export const updateClinicalExpLogSchema = z.object({
  patientCount: z.coerce.number().int().min(0).optional(),
  proceduresPerformed: z.array(z.string()).optional(),
  skillsApplied: z.array(z.string()).optional(),
  challenges: z.string().optional(),
  learnings: z.string().optional(),
  supervisorNotes: z.string().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

// ─── Achievements ────────────────────────────────────────────────────────────

export const createAchievementSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  points: z.coerce.number().int().min(0).default(0),
  metadata: z.record(z.unknown()).optional(),
});

// ─── Certificates ────────────────────────────────────────────────────────────

export const createCertificateSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  courseId: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateCertificateSchema = z.object({
  status: z.enum(["ACTIVE", "REVOKED", "EXPIRED"]).optional(),
  expiresAt: z.string().datetime().optional(),
});

// ─── Feedback ────────────────────────────────────────────────────────────────

export const createFeedbackSchema = z.object({
  portfolioItemId: z.string().uuid("Invalid portfolio item ID"),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  comments: z.string().min(1, "Comments are required"),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
});

export const updateFeedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  comments: z.string().min(1).optional(),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  studentId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  isPublished: z.coerce.boolean().optional(),
});
