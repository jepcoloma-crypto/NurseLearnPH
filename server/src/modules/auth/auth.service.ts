import { createHash, randomBytes } from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import bcrypt from "bcrypt";
import { db } from "../../database/index.js";
import {
  users,
  refreshTokens,
  emailVerificationTokens,
} from "../../database/schema/index.js";
import { config } from "../../config/index.js";
import {
  generateTokenPair,
  verifyRefreshToken,
  getRefreshTokenExpiry,
  JwtPayload,
} from "../../services/jwt.service.js";
import { logAudit } from "../../services/audit.service.js";
import { sendEmail } from "../../services/email.service.js";
import { verificationEmail } from "../../services/email-templates.js";
import { createNotification } from "../notifications/notifications.service.js";
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  NotFoundError,
} from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";
import {
  LoginInput,
  RegisterInput,
  ChangePasswordInput,
  VerifyEmailInput,
  ResendVerificationInput,
} from "./auth.schema.js";

const logger = createChildLogger("auth-service");
const SALT_ROUNDS = 12;
const VERIFICATION_TTL_HOURS = 24;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function login(data: LoginInput, ipAddress?: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, data.username));

  if (!user || user.deletedAt) {
    await logAudit({
      userId: user?.id,
      action: "LOGIN_FAILED",
      resource: "AUTH",
      metadata: {
        username: data.username,
        reason: user?.deletedAt ? "user_deleted" : "user_not_found",
      },
      ipAddress,
    });
    throw new UnauthorizedError("Invalid username or password");
  }

  const validPassword = await bcrypt.compare(data.password, user.passwordHash);
  if (!validPassword) {
    await logAudit({
      userId: user.id,
      action: "LOGIN_FAILED",
      resource: "AUTH",
      metadata: { username: data.username, reason: "invalid_password" },
      ipAddress,
    });
    throw new UnauthorizedError("Invalid username or password");
  }

  // Reached only with correct credentials, so these messages never leak
  // account state to unauthenticated attackers — while still telling a
  // legitimate user what is blocking them.
  if (!user.emailVerifiedAt) {
    await logAudit({
      userId: user.id,
      action: "LOGIN_FAILED",
      resource: "AUTH",
      metadata: { username: data.username, reason: "email_unverified" },
      ipAddress,
    });
    throw new ForbiddenError(
      "Please verify your email address first. Check your inbox for the verification link."
    );
  }

  if (!user.isActive) {
    await logAudit({
      userId: user.id,
      action: "LOGIN_FAILED",
      resource: "AUTH",
      metadata: { username: data.username, reason: "account_inactive" },
      ipAddress,
    });
    throw new ForbiddenError(
      "Your account is awaiting activation. Please contact the administrator."
    );
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  };

  const tokens = generateTokenPair(payload);

  await db.insert(refreshTokens).values({
    userId: user.id,
    token: hashToken(tokens.refreshToken),
    expiresAt: getRefreshTokenExpiry(),
  });

  await logAudit({
    userId: user.id,
    action: "LOGIN",
    resource: "AUTH",
    metadata: { username: user.username },
    ipAddress,
  });

  logger.info({ userId: user.id }, "User logged in");

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
    ...tokens,
  };
}

/**
 * Create a single-use verification token (stored hashed) and email the link.
 * Returns the raw URL so callers can surface it in dry-run mode.
 */
async function issueVerificationEmail(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}): Promise<{ url: string; dryRun: boolean }> {
  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_HOURS * 60 * 60 * 1000);

  // Only the newest link stays valid — issuing a new one invalidates the old.
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, user.id));

  await db.insert(emailVerificationTokens).values({
    userId: user.id,
    tokenHash: hashToken(rawToken),
    expiresAt,
  });

  const url = `${config.CLIENT_URL}/verify-email?token=${rawToken}`;
  const result = await sendEmail(
    user.email,
    "Verify your email — NurseLearn PH",
    verificationEmail(user, url, VERIFICATION_TTL_HOURS)
  );

  if (result.dryRun) {
    logger.info({ userId: user.id, verificationUrl: url }, "Verification link (dry run)");
  }

  return { url, dryRun: !!result.dryRun };
}

export function getSignupConfig() {
  return {
    enabled: config.SIGNUP_MODE !== "off",
    requireApproval: config.SIGNUP_MODE === "approval",
  };
}

export async function register(data: RegisterInput, ipAddress?: string) {
  if (config.SIGNUP_MODE === "off") {
    throw new ForbiddenError(
      "Registration is disabled. Please contact the administrator for an account."
    );
  }

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

  // Self-signups always start inactive and unverified; activation happens
  // on email verification (SIGNUP_MODE=auto) or by admin approval (default).
  const [newUser] = await db
    .insert(users)
    .values({
      username: data.username,
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName,
      role: "STUDENT",
      isActive: false,
      emailVerifiedAt: null,
    })
    .returning();

  await logAudit({
    userId: newUser.id,
    action: "REGISTER",
    resource: "USER",
    resourceId: newUser.id,
    metadata: {
      username: newUser.username,
      email: newUser.email,
      signupMode: config.SIGNUP_MODE,
    },
    ipAddress,
  });

  logger.info(
    { userId: newUser.id, signupMode: config.SIGNUP_MODE },
    "User registered (pending verification)"
  );

  // Registration survives email delivery failures — the account exists and
  // the user (or an admin) can request a new link later.
  let verificationUrl: string | undefined;
  try {
    const issued = await issueVerificationEmail(newUser);
    verificationUrl = issued.dryRun ? issued.url : undefined;
  } catch (err) {
    logger.error({ err, userId: newUser.id }, "Failed to send verification email");
  }

  return {
    message:
      "Registration successful. Check your email to verify your account.",
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      role: newUser.role,
    },
    ...(verificationUrl ? { verificationUrl } : {}),
  };
}

export async function verifyEmail(
  input: VerifyEmailInput,
  ipAddress?: string
) {
  const tokenHash = hashToken(input.token);

  const [tokenRow] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, tokenHash));

  if (!tokenRow) {
    throw new NotFoundError("Verification link");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, tokenRow.userId));

  if (!user || user.deletedAt) {
    throw new NotFoundError("Verification link");
  }

  // Idempotent re-click: the account is already verified, report its state.
  if (user.emailVerifiedAt) {
    if (!tokenRow.consumedAt) {
      await db
        .update(emailVerificationTokens)
        .set({ consumedAt: new Date() })
        .where(eq(emailVerificationTokens.id, tokenRow.id));
    }
    return {
      status: (user.isActive ? "active" : "pending") as "active" | "pending",
      message: user.isActive
        ? "Your email is verified and your account is active. You can now sign in."
        : "Your email is verified. Your account is awaiting administrator approval.",
    };
  }

  if (
    tokenRow.consumedAt ||
    new Date(tokenRow.expiresAt) < new Date()
  ) {
    throw new NotFoundError("Verification link");
  }

  const activateNow = config.SIGNUP_MODE === "auto";

  await db
    .update(emailVerificationTokens)
    .set({ consumedAt: new Date() })
    .where(eq(emailVerificationTokens.id, tokenRow.id));

  await db
    .update(users)
    .set({
      emailVerifiedAt: new Date(),
      ...(activateNow ? { isActive: true } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await logAudit({
    userId: user.id,
    action: "EMAIL_VERIFIED",
    resource: "USER",
    resourceId: user.id,
    metadata: { email: user.email, activated: activateNow },
    ipAddress,
  });

  if (activateNow) {
    logger.info({ userId: user.id }, "Email verified; account auto-activated");
    return {
      status: "active" as const,
      message: "Your email is verified and your account is active. You can now sign in.",
    };
  }

  // Approval mode: the account now sits in the admin approval queue.
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.role, "ADMIN"),
        eq(users.isActive, true),
        isNull(users.deletedAt)
      )
    );

  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: "ACCOUNT_PENDING",
      title: "New signup awaiting approval",
      content: `${user.firstName} ${user.lastName} (${user.email}) verified their email and is awaiting account activation.`,
      relatedId: user.id,
    });
  }

  logger.info({ userId: user.id }, "Email verified; awaiting admin approval");

  return {
    status: "pending" as const,
    message:
      "Your email is verified. Your account is awaiting administrator approval — you will be notified once it is activated.",
  };
}

export async function resendVerification(
  input: ResendVerificationInput,
  ipAddress?: string
) {
  const generic = {
    message:
      "If that email address is awaiting verification, a new link has been sent.",
  };

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email));

  // Generic response for unknown/already-verified/deleted accounts so this
  // endpoint cannot be used to probe which emails are registered.
  if (!user || user.deletedAt || user.emailVerifiedAt) {
    return generic;
  }

  let issued: { url: string; dryRun: boolean };
  try {
    issued = await issueVerificationEmail(user);
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to resend verification email");
    throw new AppError(
      "Failed to send the verification email. Please try again later.",
      500
    );
  }

  await logAudit({
    userId: user.id,
    action: "RESEND_VERIFICATION",
    resource: "USER",
    resourceId: user.id,
    metadata: { email: user.email },
    ipAddress,
  });

  return issued.dryRun ? { ...generic, verificationUrl: issued.url } : generic;
}

export async function refreshToken(token: string, ipAddress?: string) {
  const payload = verifyRefreshToken(token);
  const tokenHash = hashToken(token);

  const [storedToken] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, tokenHash));

  if (!storedToken) {
    throw new UnauthorizedError("Refresh token not found");
  }

  if (new Date(storedToken.expiresAt) < new Date()) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));
    throw new UnauthorizedError("Refresh token expired");
  }

  await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.userId));

  if (!user || !user.isActive || user.deletedAt) {
    throw new UnauthorizedError("User not found or inactive");
  }

  const newPayload: JwtPayload = {
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  };

  const tokens = generateTokenPair(newPayload);

  await db.insert(refreshTokens).values({
    userId: user.id,
    token: hashToken(tokens.refreshToken),
    expiresAt: getRefreshTokenExpiry(),
  });

  await logAudit({
    userId: user.id,
    action: "REFRESH_TOKEN",
    resource: "AUTH",
    ipAddress,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
    ...tokens,
  };
}

export async function logout(userId: string, token?: string, ipAddress?: string) {
  if (token) {
    const tokenHash = hashToken(token);
    await db.delete(refreshTokens).where(eq(refreshTokens.token, tokenHash));
  } else {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  }

  await logAudit({
    userId,
    action: "LOGOUT",
    resource: "AUTH",
    ipAddress,
  });

  logger.info({ userId }, "User logged out");
}

export async function getMe(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      middleName: users.middleName,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    throw new NotFoundError("User");
  }

  return user;
}

export async function changePassword(
  userId: string,
  data: ChangePasswordInput
) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    throw new NotFoundError("User");
  }

  const validPassword = await bcrypt.compare(
    data.currentPassword,
    user.passwordHash
  );
  if (!validPassword) {
    throw new UnauthorizedError("Current password is incorrect");
  }

  const newHash = await bcrypt.hash(data.newPassword, SALT_ROUNDS);
  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

  await logAudit({
    userId,
    action: "CHANGE_PASSWORD",
    resource: "USER",
    resourceId: userId,
  });

  logger.info({ userId }, "Password changed");
}
