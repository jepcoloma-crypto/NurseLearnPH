import { z } from "zod";

// ─── Rotations ───────────────────────────────────────────────────────────────

export const createRotationSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  instructorId: z.string().uuid("Invalid instructor ID"),
  sectionId: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  facility: z.string().max(255).optional(),
  department: z.string().max(100).optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  requiredHours: z.coerce.number().int().min(1).default(120),
  maxStudents: z.coerce.number().int().min(1).default(20),
});

export const updateRotationSchema = z.object({
  instructorId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  facility: z.string().max(255).optional(),
  department: z.string().max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  requiredHours: z.coerce.number().int().min(1).optional(),
  maxStudents: z.coerce.number().int().min(1).optional(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
});

// ─── Patient Assignments ─────────────────────────────────────────────────────

export const createPatientAssignmentSchema = z.object({
  rotationId: z.string().uuid("Invalid rotation ID"),
  studentId: z.string().uuid("Invalid student ID"),
  patientName: z.string().min(1, "Patient name is required").max(100),
  patientAge: z.coerce.number().int().min(0).max(150).optional(),
  patientGender: z.string().max(20).optional(),
  diagnosis: z.string().optional(),
});

// ─── Attendance ──────────────────────────────────────────────────────────────

export const markAttendanceSchema = z.object({
  rotationId: z.string().uuid("Invalid rotation ID"),
  studentId: z.string().uuid("Invalid student ID"),
  date: z.string().min(1, "Date is required"),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  hoursLogged: z.coerce.number().int().min(0).default(8),
  notes: z.string().optional(),
});

export const completeRotationSchema = z
  .object({
    studentIds: z.array(z.string().uuid()).optional(),
  })
  .default({});

export const updateCompletionSchema = z.object({
  studentIds: z.array(z.string().uuid()),
});

// ─── Clinical Logs ───────────────────────────────────────────────────────────

export const createClinicalLogSchema = z.object({
  rotationId: z.string().uuid("Invalid rotation ID"),
  date: z.string().datetime(),
  patientCount: z.coerce.number().int().min(0).default(0),
  procedures: z.array(z.string()).optional(),
  reflections: z.string().optional(),
  challenges: z.string().optional(),
  learningOutcomes: z.string().optional(),
});

export const updateClinicalLogSchema = z.object({
  date: z.string().datetime().optional(),
  patientCount: z.coerce.number().int().min(0).optional(),
  procedures: z.array(z.string()).optional(),
  reflections: z.string().min(1, "Reflections are required").optional(),
  challenges: z.string().optional(),
  learningOutcomes: z.string().optional(),
});

export const reviewClinicalLogSchema = z.object({
  feedback: z.string().min(1, "Feedback is required").max(5000),
});

// ─── Evaluations ─────────────────────────────────────────────────────────────

export const createEvaluationSchema = z.object({
  rotationId: z.string().uuid("Invalid rotation ID"),
  studentId: z.string().uuid("Invalid student ID"),
  type: z.enum(["FORMATIVE", "SUMMATIVE", "MIDTERM", "FINAL"]).default("FORMATIVE"),
  clinicalPerformance: z.coerce.number().int().min(0).max(100).optional(),
  professionalBehavior: z.coerce.number().int().min(0).max(100).optional(),
  communicationSkills: z.coerce.number().int().min(0).max(100).optional(),
  criticalThinking: z.coerce.number().int().min(0).max(100).optional(),
  strengths: z.string().optional(),
  areasForImprovement: z.string().optional(),
  comments: z.string().optional(),
});

export const updateEvaluationSchema = z.object({
  type: z.enum(["FORMATIVE", "SUMMATIVE", "MIDTERM", "FINAL"]).optional(),
  clinicalPerformance: z.coerce.number().int().min(0).max(100).optional(),
  professionalBehavior: z.coerce.number().int().min(0).max(100).optional(),
  communicationSkills: z.coerce.number().int().min(0).max(100).optional(),
  criticalThinking: z.coerce.number().int().min(0).max(100).optional(),
  strengths: z.string().optional(),
  areasForImprovement: z.string().optional(),
  comments: z.string().optional(),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  courseId: z.string().uuid().optional(),
  instructorId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  status: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
