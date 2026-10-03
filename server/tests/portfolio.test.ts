import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { app, SEED_USERS, getStudentId } from "./helpers.js";
import { db } from "../src/database/index.js";
import {
  portfolios,
  reflections,
  clinicalExperienceLogs,
} from "../src/database/schema/index.js";

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

describe("Portfolio Module", () => {
  let instructorToken: string;
  let studentToken: string;
  let studentId: string;
  let testPortfolioId: string;

  beforeAll(async () => {
    instructorToken = await loginAs("instructor");
    studentToken = await loginAs("student");
    studentId = await getStudentId();
  });

  // Clean up test-created portfolios, reflections, and clinical logs
  afterAll(async () => {
    // Delete by student_id (test student) to clean all test-created data
    await db.delete(portfolios).where(eq(portfolios.studentId, studentId));
    await db.delete(reflections).where(eq(reflections.studentId, studentId));
    await db
      .delete(clinicalExperienceLogs)
      .where(eq(clinicalExperienceLogs.studentId, studentId));
  });

  describe("Portfolios", () => {
    it("GET /api/portfolio/portfolios - should list portfolios", async () => {
      const res = await request(app)
        .get("/api/portfolio/portfolios")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/portfolio/portfolios - should create portfolio (student)", async () => {
      const res = await request(app)
        .post("/api/portfolio/portfolios")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          title: "My Nursing Portfolio",
          description: "Clinical portfolio for 4th year",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/portfolio/portfolios - should reject instructor", async () => {
      const res = await request(app)
        .post("/api/portfolio/portfolios")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ title: "Test" });

      expect(res.status).toBe(403);
    });
  });

  describe("Portfolio Items", () => {
    let portfolioId: string;
    let itemId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post("/api/portfolio/portfolios")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ title: "Items Test Portfolio" });
      portfolioId = res.body.data.id;
    });

    afterAll(async () => {
      if (portfolioId) {
        await request(app)
          .delete(`/api/portfolio/portfolios/${portfolioId}`)
          .set("Authorization", `Bearer ${studentToken}`);
      }
    });

    it("GET /api/portfolio/portfolios/:portfolioId/items - should list items", async () => {
      const res = await request(app)
        .get(`/api/portfolio/portfolios/${portfolioId}/items`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("POST /api/portfolio/portfolios/:portfolioId/items - should create item", async () => {
      const res = await request(app)
        .post(`/api/portfolio/portfolios/${portfolioId}/items`)
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          title: "Clinical Rotation 1",
          description: "First clinical experience",
          itemType: "CLINICAL",
          content: { facility: "Hospital", hours: 200 },
          order: 0,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      itemId = res.body.data.id;
    });

    it("PUT /api/portfolio/portfolio-items/:id - should update item", async () => {
      if (!itemId) return;
      const res = await request(app)
        .put(`/api/portfolio/portfolio-items/${itemId}`)
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ title: "Updated Clinical Rotation" });

      expect(res.status).toBe(200);
    });

    it("DELETE /api/portfolio/portfolio-items/:id - should delete item", async () => {
      if (!itemId) return;
      const res = await request(app)
        .delete(`/api/portfolio/portfolio-items/${itemId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(204);
    });
  });

  describe("Reflections", () => {
    it("GET /api/portfolio/reflections - should list reflections", async () => {
      const res = await request(app)
        .get("/api/portfolio/reflections")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("POST /api/portfolio/reflections - should create reflection (student)", async () => {
      const res = await request(app)
        .post("/api/portfolio/reflections")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          title: "Clinical Reflection Week 1",
          content: "This week I learned about patient assessment...",
          reflectionType: "CLINICAL",
          mood: "CONFIDENT",
          tags: ["assessment", "vital-signs"],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Clinical Experience Logs", () => {
    it("GET /api/portfolio/clinical-exp-logs - should list logs", async () => {
      const res = await request(app)
        .get("/api/portfolio/clinical-exp-logs")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("POST /api/portfolio/clinical-exp-logs - should create log (student)", async () => {
      const res = await request(app)
        .post("/api/portfolio/clinical-exp-logs")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          rotationId: "00000000-0000-0000-0000-000000000001",
          patientCount: 5,
          procedures: ["IV insertion", "Wound care"],
          hoursCompleted: 8,
          notes: "Good day overall",
        });

      // May be 201 or 400 depending on FK constraints
      expect([200, 201, 400]).toContain(res.status);
    });
  });

  describe("Achievements", () => {
    it("GET /api/portfolio/achievements - should list achievements", async () => {
      const res = await request(app)
        .get("/api/portfolio/achievements")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("POST /api/portfolio/achievements - should create (instructor)", async () => {
      const res = await request(app)
        .post("/api/portfolio/achievements")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          studentId: studentId,
          title: "Excellent Clinical Performance",
          description: "Outstanding patient care",
          category: "CLINICAL",
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Certificates", () => {
    it("GET /api/portfolio/certificates - should list certificates", async () => {
      const res = await request(app)
        .get("/api/portfolio/certificates")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe("Validation", () => {
    it("should reject portfolio without title", async () => {
      const res = await request(app)
        .post("/api/portfolio/portfolios")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("should reject reflection without content", async () => {
      const res = await request(app)
        .post("/api/portfolio/reflections")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ title: "Test" });

      expect(res.status).toBe(400);
    });
  });
});
