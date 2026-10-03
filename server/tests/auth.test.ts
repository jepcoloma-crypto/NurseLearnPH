import { describe, it, expect } from "vitest";
import request from "supertest";
import { eq, and } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { app, SEED_USERS } from "./helpers.js";
import { db } from "../src/database/index.js";
import {
  users,
  auditLogs,
  refreshTokens,
  notifications,
  emailVerificationTokens,
} from "../src/database/schema/index.js";
import * as authService from "../src/modules/auth/auth.service.js";

// Captured from the first successful login so the /me and /refresh tests do
// not need extra logins (loginLimiter allows only 5 per minute per app).
let studentSession: { accessToken: string; refreshToken: string } | null = null;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Remove every row a self-signup fixture could have created. */
async function cleanupFixture(userId: string) {
  await db.delete(auditLogs).where(eq(auditLogs.resourceId, userId));
  await db.delete(auditLogs).where(eq(auditLogs.userId, userId));
  await db.delete(notifications).where(eq(notifications.userId, userId));
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

async function createFixtureUser(opts?: {
  emailVerifiedAt?: Date | null;
  isActive?: boolean;
}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [row] = await db
    .insert(users)
    .values({
      username: `signup-${suffix}`,
      email: `signup-${suffix}@example.com`,
      passwordHash: await bcrypt.hash("testpass123", 10),
      firstName: "Signup",
      lastName: "Tester",
      role: "STUDENT",
      isActive: opts?.isActive ?? false,
      emailVerifiedAt:
        opts?.emailVerifiedAt === undefined ? null : opts.emailVerifiedAt,
    })
    .returning();
  return row;
}

async function issueTokenFor(
  userId: string,
  opts?: { expiresInMs?: number; consumed?: boolean }
) {
  const raw = randomBytes(32).toString("hex");
  const [row] = await db
    .insert(emailVerificationTokens)
    .values({
      userId,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + (opts?.expiresInMs ?? 60 * 60 * 1000)),
      consumedAt: opts?.consumed ? new Date() : null,
    })
    .returning();
  return { raw, row };
}

describe("Auth Module", () => {
  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send(SEED_USERS.student);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(SEED_USERS.student.email);

      studentSession = {
        accessToken: res.body.data.accessToken,
        refreshToken: res.body.data.refreshToken,
      };
    });

    it("should reject invalid password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: SEED_USERS.student.username, password: "wrongpassword" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject non-existent username", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "nonexistent-user", password: "password123" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject missing fields", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/register", () => {
    it("should register an inactive, unverified user with a verification link", async () => {
      const email = `test-register-${Date.now()}@example.com`;
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: `testreg-${Date.now()}`,
          email,
          password: "testpass123",
          firstName: "Test",
          lastName: "User",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.user.role).toBe("STUDENT");
      // No auto-login from signup: no tokens are issued.
      expect(res.body.data.accessToken).toBeUndefined();
      expect(res.body.data.refreshToken).toBeUndefined();
      // Test env always dry-runs email, so the link is returned directly.
      expect(res.body.data.verificationUrl).toMatch(
        /\/verify-email\?token=/
      );

      const [created] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
      expect(created).toBeDefined();
      expect(created!.isActive).toBe(false);
      expect(created!.emailVerifiedAt).toBeNull();

      // A verification token exists and no refresh token was created.
      const tokenRows = await db
        .select()
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.userId, created!.id));
      expect(tokenRows.length).toBe(1);

      const refreshRows = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.userId, created!.id));
      expect(refreshRows.length).toBe(0);

      // Registration smoke rows must not accumulate in the DB — remove the
      // freshly created user (plus its audit/notification/token rows) right
      // away so every test run leaves no trace.
      await cleanupFixture(created!.id);
    });

    it("should reject duplicate email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: `dup-${Date.now()}`,
          email: SEED_USERS.student.email,
          password: "testpass123",
          firstName: "Dup",
          lastName: "User",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should reject short password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: `shortpw-${Date.now()}`,
          email: `short-pw-${Date.now()}@example.com`,
          password: "short",
          firstName: "Short",
          lastName: "Password",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/auth/signup-config", () => {
    it("should expose the public signup configuration", async () => {
      const res = await request(app).get("/api/auth/signup-config");

      expect(res.status).toBe(200);
      expect(res.body.data.enabled).toBe(true);
      expect(res.body.data.requireApproval).toBe(true);
    });
  });

  describe("POST /api/auth/verify-email", () => {
    it("verifies a valid token and queues the account for approval", async () => {
      const fixture = await createFixtureUser();
      const admin = (
        await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, "admin"))
      )[0];
      // Residue from a previous crashed run must not skew the assertion.
      await db
        .delete(notifications)
        .where(
          and(
            eq(notifications.userId, admin.id),
            eq(notifications.type, "ACCOUNT_PENDING")
          )
        );

      const { raw } = await issueTokenFor(fixture.id);

      const res = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: raw });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("pending");
      expect(res.body.data.message).toBeTruthy();

      const [updated] = await db
        .select()
        .from(users)
        .where(eq(users.id, fixture.id));
      expect(updated.emailVerifiedAt).not.toBeNull();
      // approval mode: verified but still inactive
      expect(updated.isActive).toBe(false);

      const adminNotes = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, admin.id),
            eq(notifications.type, "ACCOUNT_PENDING")
          )
        );
      expect(adminNotes.length).toBe(1);
      // relatedId links the bell notification to the signup so approve/reject
      // can auto-clear it.
      expect(adminNotes[0].relatedId).toBe(fixture.id);

      // Re-clicking the same link is idempotent, not an error.
      const again = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: raw });
      expect(again.status).toBe(200);
      expect(again.body.data.status).toBe("pending");

      await db
        .delete(notifications)
        .where(
          and(
            eq(notifications.userId, admin.id),
            eq(notifications.type, "ACCOUNT_PENDING")
          )
        );
      await cleanupFixture(fixture.id);
    });

    it("rejects an unknown token", async () => {
      const res = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: randomBytes(32).toString("hex") });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("rejects an already-consumed token when the account is still unverified", async () => {
      const fixture = await createFixtureUser();
      const { raw } = await issueTokenFor(fixture.id, { consumed: true });

      const res = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: raw });

      expect(res.status).toBe(404);
      await cleanupFixture(fixture.id);
    });

    it("rejects an expired token", async () => {
      const fixture = await createFixtureUser();
      const { raw } = await issueTokenFor(fixture.id, { expiresInMs: -1000 });

      const res = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: raw });

      expect(res.status).toBe(404);
      await cleanupFixture(fixture.id);
    });
  });

  describe("POST /api/auth/resend-verification", () => {
    it("issues a fresh link for an unverified account (dry run)", async () => {
      const fixture = await createFixtureUser();

      const res = await request(app)
        .post("/api/auth/resend-verification")
        .send({ email: fixture.email });

      expect(res.status).toBe(200);
      expect(res.body.data.verificationUrl).toMatch(
        /\/verify-email\?token=/
      );

      const tokenRows = await db
        .select()
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.userId, fixture.id));
      expect(tokenRows.length).toBe(1);
      expect(tokenRows[0].consumedAt).toBeNull();

      await cleanupFixture(fixture.id);
    });

    it("returns a generic response for unknown emails", async () => {
      const res = await request(app)
        .post("/api/auth/resend-verification")
        .send({ email: `no-such-user-${Date.now()}@example.com` });

      expect(res.status).toBe(200);
      expect(res.body.data.verificationUrl).toBeUndefined();
      expect(res.body.data.message).toBeTruthy();
    });
  });

  describe("login state checks (service level)", () => {
    // Direct service calls: the HTTP login limiter allows only 5 logins/min,
    // so these must never go through the route.
    it("blocks login with a correct password until the email is verified", async () => {
      const fixture = await createFixtureUser({ isActive: false });

      let caught: unknown;
      try {
        await authService.login({
          username: fixture.username,
          password: "testpass123",
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeDefined();
      expect((caught as { statusCode?: number }).statusCode).toBe(403);
      expect(String((caught as Error).message)).toMatch(/verify your email/i);

      await cleanupFixture(fixture.id);
    });

    it("blocks login for a verified but inactive (pending) account", async () => {
      const fixture = await createFixtureUser({
        emailVerifiedAt: new Date(),
        isActive: false,
      });

      let caught: unknown;
      try {
        await authService.login({
          username: fixture.username,
          password: "testpass123",
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeDefined();
      expect((caught as { statusCode?: number }).statusCode).toBe(403);
      expect(String((caught as Error).message)).toMatch(
        /awaiting activation/i
      );

      await cleanupFixture(fixture.id);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return current user with valid token", async () => {
      expect(studentSession).not.toBeNull();

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${studentSession!.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(SEED_USERS.student.email);
    });

    it("should reject request without token", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("should reject invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token-here");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should reject invalid refresh token", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-refresh-token" });

      expect(res.status).toBe(401);
    });

    it("should refresh tokens with valid refresh token", async () => {
      expect(studentSession).not.toBeNull();

      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: studentSession!.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });
  });
});
