import { eq, ilike, and, desc, sql, isNotNull } from "drizzle-orm";
import bcrypt from "bcrypt";
import { db } from "../../database/index.js";
import { users, refreshTokens, notifications } from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { sendEmail } from "../../services/email.service.js";
import {
  accountApprovedEmail,
  accountRejectedEmail,
} from "../../services/email-templates.js";
import { createNotification } from "../notifications/notifications.service.js";
import { NotFoundError, ConflictError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";
import {
  CreateUserInput,
  UpdateUserInput,
  ListUsersQuery,
} from "./users.schema.js";

const logger = createChildLogger("users-service");
const SALT_ROUNDS = 12;

export async function listUsers(query: ListUsersQuery) {
  const { page, limit, role, search, isActive, pending } = query;
  const offset = (page - 1) * limit;

  const conditions = [sql`${users.deletedAt} IS NULL`];

  if (role) {
    conditions.push(eq(users.role, role));
  }

  if (pending) {
    // Self-signups that verified their email but are not yet activated
    conditions.push(eq(users.isActive, false));
    conditions.push(isNotNull(users.emailVerifiedAt));
  } else if (isActive !== undefined) {
    conditions.push(eq(users.isActive, isActive));
  }

  if (search) {
    conditions.push(
      sql`(${ilike(users.username, `%${search}%`)} OR ${ilike(users.firstName, `%${search}%`)} OR ${ilike(users.lastName, `%${search}%`)} OR ${ilike(users.email, `%${search}%`)})`
    );
  }

  const where = and(...conditions);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(where);

  const userList = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      middleName: users.middleName,
      contactNumber: users.contactNumber,
      role: users.role,
      isActive: users.isActive,
      emailVerifiedAt: users.emailVerifiedAt,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: userList,
    pagination: {
      page,
      limit,
      total: countResult.count,
      totalPages: Math.ceil(countResult.count / limit),
    },
  };
}

export async function getUserById(id: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      middleName: users.middleName,
      contactNumber: users.contactNumber,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, id));

  if (!user) {
    throw new NotFoundError("User");
  }

  return user;
}

export async function createUser(data: CreateUserInput, createdBy?: string) {
  const [existingEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email));

  if (existingEmail) {
    throw new ConflictError("Email already registered");
  }

  const [existingUsername] = await db
    .select()
    .from(users)
    .where(eq(users.username, data.username));

  if (existingUsername) {
    throw new ConflictError("Username already taken");
  }

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  const [newUser] = await db
    .insert(users)
    .values({
      username: data.username,
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName,
      contactNumber: data.contactNumber?.trim() || null,
      role: data.role,
      // Admin-provisioned accounts are implicitly verified — only self-signups
      // need the email verification flow.
      emailVerifiedAt: new Date(),
    })
    .returning();

  await logAudit({
    userId: createdBy,
    action: "CREATE_USER",
    resource: "USER",
    resourceId: newUser.id,
    metadata: { username: newUser.username, email: newUser.email, role: newUser.role },
  });

  logger.info({ userId: newUser.id }, "User created");

  return {
    id: newUser.id,
    email: newUser.email,
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    middleName: newUser.middleName,
    contactNumber: newUser.contactNumber,
    role: newUser.role,
    isActive: newUser.isActive,
    createdAt: newUser.createdAt,
  };
}

export async function updateUser(
  id: string,
  data: UpdateUserInput,
  updatedBy?: string
) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, id));

  if (!existing || existing.deletedAt) {
    throw new NotFoundError("User");
  }

  if (data.email && data.email !== existing.email) {
    const [emailTaken] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email));
    if (emailTaken) {
      throw new ConflictError("Email already in use");
    }
  }

  // An empty contact number clears the column instead of storing "".
  const patch: UpdateUserInput = { ...data };
  if (patch.contactNumber === "") {
    patch.contactNumber = null;
  }

  const [updated] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  if (data.role && data.role !== existing.role) {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, id));
    logger.info({ userId: id }, "Refresh tokens revoked due to role change");
  }

  if (data.isActive === false && existing.isActive) {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, id));
    logger.info(
      { userId: id },
      "Refresh tokens revoked due to account deactivation"
    );
  }

  await logAudit({
    userId: updatedBy,
    action: "UPDATE_USER",
    resource: "USER",
    resourceId: id,
    metadata: { changes: data },
  });

  logger.info({ userId: id }, "User updated");

  return {
    id: updated.id,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
    middleName: updated.middleName,
    contactNumber: updated.contactNumber,
    role: updated.role,
    isActive: updated.isActive,
    updatedAt: updated.updatedAt,
  };
}

export async function deleteUser(id: string, deletedBy?: string) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, id));

  if (!existing || existing.deletedAt) {
    throw new NotFoundError("User");
  }

  await db
    .update(users)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(eq(users.id, id));

  await db.delete(refreshTokens).where(eq(refreshTokens.userId, id));

  await logAudit({
    userId: deletedBy,
    action: "DELETE_USER",
    resource: "USER",
    resourceId: id,
  });

  logger.info({ userId: id }, "User soft-deleted");
}

/**
 * ADMIN-only password reset from the Users page. Revokes the user's refresh
 * tokens so existing sessions are logged out; the new password is required
 * on next login. Never logs or audits the password itself.
 */
export async function updateUserPassword(
  id: string,
  password: string,
  updatedBy?: string
) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, id));

  if (!existing || existing.deletedAt) {
    throw new NotFoundError("User");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, id));

  await db.delete(refreshTokens).where(eq(refreshTokens.userId, id));

  await logAudit({
    userId: updatedBy,
    action: "UPDATE_USER_PASSWORD",
    resource: "USER",
    resourceId: id,
    metadata: { username: existing.username },
  });

  logger.info({ userId: id }, "User password updated");

  return { id, message: "Password updated successfully" };
}

/**
 * Once a signup is resolved (approved or rejected), auto-mark the admin
 * ACCOUNT_PENDING bell notifications for it as read. Matched by relatedId,
 * which verifyEmail stamps when it creates them.
 */
async function clearPendingNotifications(userId: string) {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.type, "ACCOUNT_PENDING"),
        eq(notifications.relatedId, userId),
        eq(notifications.isRead, false)
      )
    );
}

/**
 * Activate a self-signup account (SIGNUP_MODE=approval queue). The account
 * must be verified, inactive, and not soft-deleted. Notifies the user in-app
 * and by email; email failures never fail the approval itself.
 */
export async function approveUser(id: string, approvedBy?: string) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, id));

  if (!existing || existing.deletedAt) {
    throw new NotFoundError("User");
  }

  if (existing.isActive || !existing.emailVerifiedAt) {
    throw new ConflictError("User is not pending approval");
  }

  const [updated] = await db
    .update(users)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.userId, id));

  await clearPendingNotifications(id);

  await createNotification({
    userId: id,
    type: "ACCOUNT_APPROVED",
    title: "Your account has been activated",
    content:
      "Your NurseLearn PH account has been approved. You can now sign in.",
  });

  try {
    await sendEmail(
      existing.email,
      "Your NurseLearn PH account is active",
      accountApprovedEmail(existing)
    );
  } catch (err) {
    logger.error({ err, userId: id }, "Failed to send approval email");
  }

  await logAudit({
    userId: approvedBy,
    action: "USER_APPROVED",
    resource: "USER",
    resourceId: id,
    metadata: { email: existing.email, username: existing.username },
  });

  logger.info({ userId: id, approvedBy }, "User approved");

  return {
    id: updated.id,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
    role: updated.role,
    isActive: updated.isActive,
  };
}

/**
 * Reject a self-signup application: the account stays inactive and is
 * soft-deleted (kept for audit, hidden from user lists, cannot log in).
 * The applicant is emailed so they are not left waiting.
 */
export async function rejectUser(
  id: string,
  rejectedBy?: string,
  reason?: string
) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, id));

  if (!existing || existing.deletedAt) {
    throw new NotFoundError("User");
  }

  if (existing.isActive || !existing.emailVerifiedAt) {
    throw new ConflictError("User is not pending approval");
  }

  await db
    .update(users)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, id));

  await db.delete(refreshTokens).where(eq(refreshTokens.userId, id));

  await clearPendingNotifications(id);

  try {
    await sendEmail(
      existing.email,
      "Your NurseLearn PH account application",
      accountRejectedEmail(existing, reason)
    );
  } catch (err) {
    logger.error({ err, userId: id }, "Failed to send rejection email");
  }

  await logAudit({
    userId: rejectedBy,
    action: "USER_REJECTED",
    resource: "USER",
    resourceId: id,
    metadata: { email: existing.email, username: existing.username, reason },
  });

  logger.info({ userId: id, rejectedBy }, "User signup rejected");

  return { id, message: "Signup rejected" };
}
