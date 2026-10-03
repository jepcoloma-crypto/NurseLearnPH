import { db } from "../database/index.js";
import { auditLogs, users } from "../database/schema/index.js";
import { createChildLogger } from "../utils/logger.js";
import { eq, and, sql, desc } from "drizzle-orm";

const logger = createChildLogger("audit");

export interface AuditLogEntry {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress,
    });
  } catch (err) {
    logger.error({ err, entry }, "Failed to write audit log");
  }
}

export async function listAuditLogs(query: {
  page: number;
  limit: number;
  userId?: string;
  action?: string;
  resource?: string;
}) {
  const { page, limit, userId, action, resource } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (userId) conditions.push(eq(auditLogs.userId, userId));
  if (action) conditions.push(eq(auditLogs.action, action));
  if (resource) conditions.push(eq(auditLogs.resource, resource));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(where);

  const items = await db
    .select({
      id: auditLogs.id,
      userId: auditLogs.userId,
      action: auditLogs.action,
      resource: auditLogs.resource,
      resourceId: auditLogs.resourceId,
      metadata: auditLogs.metadata,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
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
