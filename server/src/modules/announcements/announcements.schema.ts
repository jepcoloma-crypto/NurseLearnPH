import { z } from "zod";

export const createAnnouncementSchema = z
  .object({
    // Omit or null = institution-wide ("page") announcement.
    courseId: z.string().uuid("Invalid course ID").nullish(),
    title: z.string().min(1, "Title is required").max(255),
    content: z.string().min(1, "Content is required"),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
    audienceStudents: z.boolean().default(true),
    audienceInstructors: z.boolean().default(false),
    // Workflow entry point. Falls back to legacy isPublished when omitted.
    status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
    isPublished: z.boolean().optional(),
    publishAt: z.coerce.date().nullish(),
    expiresAt: z.coerce.date().nullish(),
  })
  .refine((d) => d.audienceStudents || d.audienceInstructors, {
    message: "Select at least one audience",
    path: ["audienceStudents"],
  })
  .refine(
    (d) =>
      !d.publishAt ||
      !d.expiresAt ||
      d.publishAt.getTime() < d.expiresAt.getTime(),
    {
      message: "Publish date must be before the expiry date",
      path: ["publishAt"],
    }
  );

export const updateAnnouncementSchema = z.object({
  courseId: z.string().uuid().nullish(),
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  audienceStudents: z.boolean().optional(),
  audienceInstructors: z.boolean().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  isPublished: z.boolean().optional(),
  publishAt: z.coerce.date().nullish(),
  expiresAt: z.coerce.date().nullish(),
});

export const listAnnouncementQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  courseId: z.string().uuid().optional(),
  instructorId: z.string().uuid().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  // Dashboard feed: force the effective-visibility window regardless of role.
  publishedOnly: z.enum(["true", "false"]).optional(),
  // Dashboard feed: only announcements the caller has not read yet.
  unreadOnly: z.enum(["true", "false"]).optional(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type ListAnnouncementQuery = z.infer<typeof listAnnouncementQuerySchema>;
