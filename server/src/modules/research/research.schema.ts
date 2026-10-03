import { z } from "zod";

export const createProjectSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  researchType: z.string().min(1, "Research type is required"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  fundingSource: z.string().optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1, "Title is required").max(255).optional(),
  description: z.string().optional(),
  researchType: z.string().min(1, "Research type is required").optional(),
  status: z.enum(["PLANNING", "ACTIVE", "COMPLETED", "CLOSED"]).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  fundingSource: z.string().optional(),
  irbNumber: z.string().max(100).nullable().optional(),
  irbApprovalDate: z.string().datetime().nullable().optional(),
});

export const createCohortSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  cohortType: z.string().min(1, "Cohort type is required"),
  targetSize: z.coerce.number().int().min(1).optional(),
  inclusionCriteria: z.record(z.unknown()).optional(),
  exclusionCriteria: z.record(z.unknown()).optional(),
});

export const createStudySchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  cohortId: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  studyDesign: z.string().min(1, "Study design is required"),
  intervention: z.string().optional(),
  controlGroup: z.string().optional(),
  outcomeMeasures: z.array(z.string()).optional(),
});

export const enrollParticipantSchema = z.object({
  cohortId: z.string().uuid().optional(),
  groupAssignment: z.enum(["CONTROL", "EXPERIMENTAL"]).optional(),
});

export const recordPrePostTestSchema = z.object({
  participantId: z.string().uuid("Invalid participant ID"),
  studyId: z.string().uuid("Invalid study ID"),
  testType: z.enum(["PRE", "POST"]),
  testDate: z.string().datetime("Invalid date"),
  score: z.coerce.number().int().min(0),
  maxScore: z.coerce.number().int().min(1),
  testInstrument: z.string().optional(),
  notes: z.string().optional(),
});

export const exportDataSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  exportType: z.enum(["CSV", "JSON", "SPSS"]),
  isAnonymized: z.boolean().default(true),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  projectId: z.string().uuid().optional(),
  instructorId: z.string().uuid().optional(),
  status: z.string().optional(),
});
