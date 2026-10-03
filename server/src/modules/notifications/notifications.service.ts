import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../database/index.js";
import { notifications } from "../../database/schema/index.js";
import { NotFoundError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";
import { ListNotificationsQuery } from "./notifications.schema.js";

const logger = createChildLogger("notifications-service");

export async function listNotifications(
  userId: string,
  query: ListNotificationsQuery
) {
  const { page, limit, isRead } = query;
  const offset = (page - 1) * limit;

  const conditions = [eq(notifications.userId, userId)];
  if (isRead !== undefined) {
    conditions.push(eq(notifications.isRead, isRead));
  }

  const where = and(...conditions);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(where);

  const items = await db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    pagination: {
      page,
      limit,
      total: countResult.count,
      totalPages: Math.ceil(countResult.count / limit),
    },
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return result.count;
}

export async function markAsRead(id: string, userId: string) {
  const [existing] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));

  if (!existing) {
    throw new NotFoundError("Notification");
  }

  const [updated] = await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, id))
    .returning();

  logger.info({ notificationId: id }, "Notification marked as read");

  return updated;
}

export async function markAllAsRead(userId: string) {
  const result = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  logger.info({ userId }, "All notifications marked as read");

  return { updated: true };
}

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  content?: string;
  relatedId?: string;
}) {
  const [item] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      content: input.content ?? null,
      relatedId: input.relatedId ?? null,
    })
    .returning();

  logger.info({ notificationId: item.id, userId: input.userId, type: input.type }, "Notification created");

  return item;
}
