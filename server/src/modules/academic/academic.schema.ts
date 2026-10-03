import { z } from "zod";

export const createProgramSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().min(1, "Code is required").max(50),
  description: z.string().optional(),
});

export const updateProgramSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  code: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createAcademicYearSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  programId: z.string().uuid("Invalid program ID"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

export const updateAcademicYearSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createSemesterSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  academicYearId: z.string().uuid("Invalid academic year ID"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

export const updateSemesterSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createYearLevelSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  programId: z.string().uuid("Invalid program ID"),
  order: z.coerce.number().int().min(1),
});

export const createSectionSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  yearLevelId: z.string().uuid("Invalid year level ID"),
  semesterId: z.string().uuid("Invalid semester ID"),
});

export const createCourseSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().min(1, "Code is required").max(50),
  description: z.string().optional(),
  programId: z.string().uuid("Invalid program ID"),
  yearLevelId: z.string().uuid("Invalid year level ID"),
  semesterId: z.string().uuid("Invalid semester ID"),
  instructorId: z.string().uuid("Invalid instructor ID").optional(),
  credits: z.coerce.number().int().min(1).max(120).default(3),
});

export const updateCourseSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  code: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  yearLevelId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  instructorId: z.string().uuid().or(z.literal("")).optional(),
  credits: z.coerce.number().int().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
});

export const enrollStudentSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  courseId: z.string().uuid("Invalid course ID"),
  sectionId: z.string().uuid("Invalid section ID"),
});

export const updateEnrollmentSchema = z.object({
  sectionId: z.string().uuid("Invalid section ID"),
});

export const createLearningOutcomeSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  code: z.string().min(1, "Code is required").max(50),
  description: z.string().min(1, "Description is required"),
});

export const updateLearningOutcomeSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  description: z.string().min(1).optional(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(500).default(15),
  search: z.string().optional(),
  programId: z.string().uuid().optional(),
  instructorId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  // Server-set (from authenticated user, never trusted from client query)
  studentId: z.string().uuid().optional(),
});

export const assignStudentSectionSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  sectionId: z.string().uuid("Invalid section ID"),
  academicYearId: z.string().uuid("Invalid academic year ID"),
});

export const listStudentSectionQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(500).default(15),
  sectionId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
});
