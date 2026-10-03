import { z } from "zod";

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  courseId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const recordActivitySchema = z.object({
  action: z.string().min(1, "Action is required"),
  resource: z.string().min(1, "Resource is required"),
  resourceId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
