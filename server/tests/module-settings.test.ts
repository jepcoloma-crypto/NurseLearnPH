import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, SEED_USERS } from "./helpers.js";
import { db } from "../src/database/index.js";
import { moduleSettings } from "../src/database/schema/index.js";

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

describe("Module settings", () => {
  let adminToken: string;
  let coordinatorToken: string;
  let originalRows: (typeof moduleSettings.$inferSelect)[] = [];

  beforeAll(async () => {
    originalRows = await db.select().from(moduleSettings);
    adminToken = await loginAs("admin");
    coordinatorToken = await loginAs("coordinator");
  });

  // Restore the dev database exactly as it was (settings are persistent data)
  afterAll(async () => {
    await db.delete(moduleSettings);
    if (originalRows.length > 0) await db.insert(moduleSettings).values(originalRows);
  });

  it("requires authentication to read", async () => {
    const res = await request(app).get("/api/admin/module-settings");
    expect(res.status).toBe(401);
  });

  it("returns every section with defaults merged in", async () => {
    const res = await request(app)
      .get("/api/admin/module-settings")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.organization.name).toBeTruthy();
    expect(typeof data.organization.logoUrl).toBe("string");
    expect(typeof data.organization.programName).toBe("string");
    expect(typeof data.reports.headerNote).toBe("string");
    expect(typeof data.reports.footerNote).toBe("string");
    expect(typeof data.certificates.title).toBe("string");
    expect(typeof data.certificates.signatoryName).toBe("string");
    expect(typeof data.certificates.signatoryTitle).toBe("string");
    expect(typeof data.certificates.footerNote).toBe("string");
  });

  it("blocks coordinators from updating settings", async () => {
    const res = await request(app)
      .put("/api/admin/module-settings")
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ organization: { name: "Nope" } });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("rejects empty and malformed payloads", async () => {
    const empty = await request(app)
      .put("/api/admin/module-settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(empty.status).toBe(400);

    const unknownOnly = await request(app)
      .put("/api/admin/module-settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ school: { name: "x" } });
    expect(unknownOnly.status).toBe(400);

    const wrongType = await request(app)
      .put("/api/admin/module-settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ organization: { name: 12345 } });
    expect(wrongType.status).toBe(400);

    const tooLong = await request(app)
      .put("/api/admin/module-settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reports: { footerNote: "x".repeat(501) } });
    expect(tooLong.status).toBe(400);
  });

  it("saves updates and merges partial sections without wiping neighbours", async () => {
    const first = await request(app)
      .put("/api/admin/module-settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ organization: { name: "Test School of Nursing", address: "1 Test Street" } });
    expect(first.status).toBe(200);
    expect(first.body.data.organization.name).toBe("Test School of Nursing");

    // Partial save to another section must keep organization intact
    const second = await request(app)
      .put("/api/admin/module-settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reports: { headerNote: "Accreditation copy" } });
    expect(second.status).toBe(200);
    expect(second.body.data.organization.name).toBe("Test School of Nursing");
    expect(second.body.data.organization.address).toBe("1 Test Street");
    expect(second.body.data.reports.headerNote).toBe("Accreditation copy");

    // Partial save inside the same section keeps sibling fields
    const third = await request(app)
      .put("/api/admin/module-settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ organization: { contact: "info@testschool.local" } });
    expect(third.status).toBe(200);
    expect(third.body.data.organization.name).toBe("Test School of Nursing");
    expect(third.body.data.organization.contact).toBe("info@testschool.local");

    // Saved values are visible through GET
    const read = await request(app)
      .get("/api/admin/module-settings")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(read.body.data.reports.headerNote).toBe("Accreditation copy");
  });
});
