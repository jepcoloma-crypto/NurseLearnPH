import request from "supertest";
import { and, eq } from "drizzle-orm";
import { app, SEED_USERS } from "./helpers.js";
import { db } from "../src/database/index.js";
import { users, auditLogs, refreshTokens, notifications } from "../src/database/schema/index.js";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

// Unique suffix keeps re-runs from colliding with leftover rows.
const SFX = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
const USERNAME = `tuser${SFX}`;
const EMAIL = `${USERNAME}@test.local`;
const INITIAL_PASSWORD = "OrigPass123";
const CONTACT = "+63 917 555 0101";

let adminToken: string;
let coordToken: string;
let createdId: string;
// Self-signup fixtures created by the approval tests (cleaned in afterAll).
const fixtureIds: string[] = [];

beforeAll(async () => {
  // Two logins only — loginLimiter allows five per minute across the file.
  const a = await request(app).post("/api/auth/login").send(SEED_USERS.admin);
  expect(a.status).toBe(200);
  adminToken = a.body.data.accessToken as string;

  const c = await request(app).post("/api/auth/login").send(SEED_USERS.coordinator);
  expect(c.status).toBe(200);
  coordToken = c.body.data.accessToken as string;
});

async function removeFixture(userId: string) {
  await db.delete(auditLogs).where(eq(auditLogs.resourceId, userId));
  await db.delete(auditLogs).where(eq(auditLogs.userId, userId));
  await db.delete(notifications).where(eq(notifications.userId, userId));
  await db.delete(notifications).where(eq(notifications.relatedId, userId));
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

/** A verified-but-inactive self-signup, exactly what the pending queue holds. */
async function createPendingFixture() {
  const sfx = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [row] = await db
    .insert(users)
    .values({
      username: `pend-${sfx}`,
      email: `pend-${sfx}@example.com`,
      passwordHash: "x",
      firstName: "Pending",
      lastName: "Applicant",
      role: "STUDENT",
      isActive: false,
      emailVerifiedAt: new Date(),
    })
    .returning();
  fixtureIds.push(row.id);
  return row;
}

afterAll(async () => {
  for (const id of fixtureIds) {
    await removeFixture(id);
  }
  if (createdId) {
    // Login actions also write audit rows with user_id = the created user.
    await db.delete(auditLogs).where(eq(auditLogs.resourceId, createdId));
    await db.delete(auditLogs).where(eq(auditLogs.userId, createdId));
    // The announcements suite runs in parallel and may have fanned a bell
    // notification out to this transient student — clear it before the FK.
    await db.delete(notifications).where(eq(notifications.userId, createdId));
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, createdId));
    await db.delete(users).where(eq(users.id, createdId));
  }
});

describe("Users: contact number field", () => {
  it("admin creates a user with a contact number", async () => {
    const res = await request(app)
      .post("/api/users")
      .set(auth(adminToken))
      .send({
        username: USERNAME,
        email: EMAIL,
        password: INITIAL_PASSWORD,
        firstName: "Test",
        lastName: "User",
        contactNumber: CONTACT,
        role: "STUDENT",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.contactNumber).toBe(CONTACT);
    createdId = res.body.data.id as string;
    expect(createdId).toBeTruthy();
  });

  it("contact number is returned by get-by-id and by the list", async () => {
    const byId = await request(app)
      .get(`/api/users/${createdId}`)
      .set(auth(adminToken));
    expect(byId.status).toBe(200);
    expect(byId.body.data.contactNumber).toBe(CONTACT);

    const list = await request(app)
      .get("/api/users?limit=100")
      .set(auth(adminToken));
    expect(list.status).toBe(200);
    const found = (
      list.body.data.items as Array<{ id: string; contactNumber?: string | null }>
    ).find((u) => u.id === createdId);
    expect(found).toBeDefined();
    expect(found!.contactNumber).toBe(CONTACT);
  });

  it("rejects an invalid contact number", async () => {
    const res = await request(app)
      .post("/api/users")
      .set(auth(adminToken))
      .send({
        username: `bad${SFX}`,
        email: `bad${SFX}@test.local`,
        password: INITIAL_PASSWORD,
        firstName: "Bad",
        lastName: "Contact",
        contactNumber: "call-me-maybe",
      });
    expect(res.status).toBe(400);
  });

  it("admin updates the contact number and can clear it with an empty string", async () => {
    const upd = await request(app)
      .put(`/api/users/${createdId}`)
      .set(auth(adminToken))
      .send({ contactNumber: "0918 123 4567" });
    expect(upd.status).toBe(200);
    expect(upd.body.data.contactNumber).toBe("0918 123 4567");

    const clear = await request(app)
      .put(`/api/users/${createdId}`)
      .set(auth(adminToken))
      .send({ contactNumber: "" });
    expect(clear.status).toBe(200);
    expect(clear.body.data.contactNumber).toBeNull();
  });
});

describe("Users: password reset is ADMIN-only", () => {
  it("rejects passwords shorter than 8 characters", async () => {
    const res = await request(app)
      .put(`/api/users/${createdId}/password`)
      .set(auth(adminToken))
      .send({ password: "short" });
    expect(res.status).toBe(400);
  });

  it("coordinator can still view users but cannot edit or reset passwords", async () => {
    const view = await request(app)
      .get("/api/users?limit=5")
      .set(auth(coordToken));
    expect(view.status).toBe(200);

    const edit = await request(app)
      .put(`/api/users/${createdId}`)
      .set(auth(coordToken))
      .send({ firstName: "Hacked" });
    expect(edit.status).toBe(403);

    const pw = await request(app)
      .put(`/api/users/${createdId}/password`)
      .set(auth(coordToken))
      .send({ password: "takenover1" });
    expect(pw.status).toBe(403);
  });

  it("anonymous password reset is rejected", async () => {
    const res = await request(app)
      .put(`/api/users/${createdId}/password`)
      .send({ password: "whatever12" });
    expect(res.status).toBe(401);
  });

  it("admin reset: old login fails, new login works, sessions are revoked", async () => {
    const reset = await request(app)
      .put(`/api/users/${createdId}/password`)
      .set(auth(adminToken))
      .send({ password: "newpass456" });
    expect(reset.status).toBe(200);
    expect(String(reset.body.data.message)).toMatch(/password updated/i);

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: USERNAME, password: INITIAL_PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: USERNAME, password: "newpass456" });
    expect(newLogin.status).toBe(200);
    const refreshToken = newLogin.body.data.refreshToken as string;
    expect(refreshToken).toBeTruthy();

    // A second reset must revoke the refresh token issued above (session logged out).
    const reset2 = await request(app)
      .put(`/api/users/${createdId}/password`)
      .set(auth(adminToken))
      .send({ password: "another123" });
    expect(reset2.status).toBe(200);

    const refreshed = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });
    expect(refreshed.status).toBe(401);
  });
});

describe("Users: signup approvals (SIGNUP_MODE=approval)", () => {
  it("lists a verified signup under pending=true and admin can approve it", async () => {
    const fixture = await createPendingFixture();

    const before = await request(app)
      .get("/api/users?pending=true&limit=100")
      .set(auth(adminToken));
    expect(before.status).toBe(200);
    const pendingBefore = before.body.data.items as Array<{ id: string }>;
    expect(pendingBefore.some((u) => u.id === fixture.id)).toBe(true);

    // Mirror the bell notification verifyEmail creates for admins; approving
    // must auto-mark it read (verify → approve relatedId wiring).
    const [adminRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "admin"));
    await db.insert(notifications).values({
      userId: adminRow.id,
      type: "ACCOUNT_PENDING",
      title: "New signup awaiting approval",
      relatedId: fixture.id,
    });

    const approve = await request(app)
      .post(`/api/users/${fixture.id}/approve`)
      .set(auth(adminToken));
    expect(approve.status).toBe(200);
    expect(approve.body.data.isActive).toBe(true);

    // The admin bell notification for this signup is auto-cleared on approve.
    const [note] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.relatedId, fixture.id),
          eq(notifications.type, "ACCOUNT_PENDING")
        )
      );
    expect(note.isRead).toBe(true);

    const [updated] = await db
      .select()
      .from(users)
      .where(eq(users.id, fixture.id));
    expect(updated.isActive).toBe(true);
    expect(updated.emailVerifiedAt).not.toBeNull();

    const after = await request(app)
      .get("/api/users?pending=true&limit=100")
      .set(auth(adminToken));
    expect(after.status).toBe(200);
    const pendingAfter = after.body.data.items as Array<{ id: string }>;
    expect(pendingAfter.some((u) => u.id === fixture.id)).toBe(false);

    // A second approval is a conflict — nothing is pending anymore.
    const again = await request(app)
      .post(`/api/users/${fixture.id}/approve`)
      .set(auth(adminToken));
    expect(again.status).toBe(409);
  });

  it("coordinator cannot approve signups", async () => {
    const fixture = await createPendingFixture();

    const res = await request(app)
      .post(`/api/users/${fixture.id}/approve`)
      .set(auth(coordToken));
    expect(res.status).toBe(403);

    const [still] = await db
      .select()
      .from(users)
      .where(eq(users.id, fixture.id));
    expect(still.isActive).toBe(false);
  });

  it("admin can reject a pending signup (soft delete, stays inactive)", async () => {
    const fixture = await createPendingFixture();

    const res = await request(app)
      .post(`/api/users/${fixture.id}/reject`)
      .set(auth(adminToken));
    expect(res.status).toBe(200);

    const [updated] = await db
      .select()
      .from(users)
      .where(eq(users.id, fixture.id));
    expect(updated.isActive).toBe(false);
    expect(updated.deletedAt).not.toBeNull();

    // Rejected accounts leave the pending queue and cannot be rejected twice.
    const list = await request(app)
      .get("/api/users?pending=true&limit=100")
      .set(auth(adminToken));
    const items = list.body.data.items as Array<{ id: string }>;
    expect(items.some((u) => u.id === fixture.id)).toBe(false);

    const twice = await request(app)
      .post(`/api/users/${fixture.id}/reject`)
      .set(auth(adminToken));
    expect(twice.status).toBe(404);
  });

  it("returns 404 for unknown ids", async () => {
    const res = await request(app)
      .post("/api/users/00000000-0000-4000-8000-000000000000/approve")
      .set(auth(adminToken));
    expect(res.status).toBe(404);
  });
});
