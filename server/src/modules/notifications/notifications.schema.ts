import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(15),
  isRead: z.coerce.boolean().optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
