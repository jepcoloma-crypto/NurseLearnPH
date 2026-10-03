import { z } from "zod";

// ─── Skills ──────────────────────────────────────────────────────────────────

export const createSkillSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  difficulty: z.string().max(20).default("BEGINNER"),
  estimatedMinutes: z.coerce.number().int().min(1).default(30),
  equipment: z.array(z.string()).optional(),
});

export const updateSkillSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  difficulty: z.string().max(20).optional(),
  estimatedMinutes: z.coerce.number().int().min(1).optional(),
  equipment: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ─── Checklists ──────────────────────────────────────────────────────────────

export const createChecklistSchema = z.object({
  stepNumber: z.coerce.number().int().min(1),
  description: z.string().min(1, "Description is required"),
  isCritical: z.boolean().default(false),
});

// ─── Stations ────────────────────────────────────────────────────────────────

export const createStationSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  location: z.string().max(255).optional(),
  capacity: z.coerce.number().int().min(1).default(1),
});

export const updateStationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  location: z.string().max(255).optional(),
  capacity: z.coerce.number().int().min(1).optional(),
  isAvailable: z.boolean().optional(),
});

// ─── Assessments ─────────────────────────────────────────────────────────────

export const createAssessmentSchema = z.object({
  skillId: z.string().uuid("Invalid skill ID"),
  stationId: z.string().uuid().optional(),
  studentId: z.string().uuid("Invalid student ID"),
  instructorId: z.string().uuid("Invalid instructor ID"),
  scheduledAt: z.string().datetime().optional(),
});

export const updateAssessmentSchema = z.object({
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  score: z.coerce.number().int().min(0).optional(),
  isCompetent: z.boolean().optional(),
  feedback: z.string().optional(),
  timeSpentSeconds: z.coerce.number().int().min(0).optional(),
});

export const submitChecklistSchema = z.object({
  items: z.array(
    z.object({
      checklistId: z.string().uuid(),
      isCompleted: z.boolean(),
      notes: z.string().optional(),
      pointsAwarded: z.coerce.number().int().min(0).default(0),
    })
  ),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  search: z.string().optional(),
  courseId: z.string().uuid().optional(),
  category: z.string().optional(),
  difficulty: z.string().optional(),
  studentId: z.string().uuid().optional(),
  instructorId: z.string().uuid().optional(),
  status: z.string().optional(),
  showAll: z.coerce.boolean().optional(),
});
