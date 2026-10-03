import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq, and } from "drizzle-orm";
import { app, SEED_USERS, SEED_IDS } from "./helpers.js";
import { db } from "../src/database/index.js";
import { caseAttempts } from "../src/database/schema/index.js";

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

// Resolved dynamically in beforeAll — seeded case IDs change across rebuilds
const SEED_CLINICAL: { caseId: string } = { caseId: "" };

describe("Clinical Cases Module", () => {
  let instructorToken: string;
  let studentToken: string;

  beforeAll(async () => {
    instructorToken = await loginAs("instructor");
    studentToken = await loginAs("student");

    const list = await request(app)
      .get("/api/clinical/cases")
      .set("Authorization", `Bearer ${studentToken}`);
    const data = list.body.data;
    const items = Array.isArray(data) ? data : (data?.items ?? data?.cases ?? []);
    SEED_CLINICAL.caseId = items[0]?.id ?? "";
    expect(SEED_CLINICAL.caseId).not.toBe("");
  });

  describe("GET /api/clinical/cases", () => {
    it("should list clinical cases", async () => {
      const res = await request(app)
        .get("/api/clinical/cases")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it("should support pagination", async () => {
      const res = await request(app)
        .get("/api/clinical/cases?page=1&limit=5")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/clinical/cases/:id", () => {
    it("should get a case by id", async () => {
      const res = await request(app)
        .get(`/api/clinical/cases/${SEED_CLINICAL.caseId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 404 for nonexistent case", async () => {
      const res = await request(app)
        .get("/api/clinical/cases/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("Case CRUD (instructor)", () => {
    let caseId: string;

    it("should create a clinical case", async () => {
      const res = await request(app)
        .post("/api/clinical/cases")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          courseId: SEED_IDS.courseId,
          title: "Test Clinical Case",
          description: "Integration test case",
          difficulty: "BEGINNER",
          patientName: "Test Patient",
          patientAge: 45,
          patientGender: "Male",
          chiefComplaint: "Chest pain",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      caseId = res.body.data.id;
    });

    it("should update a clinical case", async () => {
      if (!caseId) return;
      const res = await request(app)
        .put(`/api/clinical/cases/${caseId}`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ title: "Updated Clinical Case" });

      expect(res.status).toBe(200);
    });

    it("should delete a clinical case", async () => {
      if (!caseId) return;
      const res = await request(app)
        .delete(`/api/clinical/cases/${caseId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(204);
    });
  });

  describe("Case Stages (instructor)", () => {
    let caseId: string;
    let stageId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post("/api/clinical/cases")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          courseId: SEED_IDS.courseId,
          title: "Stage Test Case",
          difficulty: "BEGINNER",
        });
      caseId = res.body.data.id;
    });

    afterAll(async () => {
      if (caseId) {
        await request(app)
          .delete(`/api/clinical/cases/${caseId}`)
          .set("Authorization", `Bearer ${instructorToken}`);
      }
    });

    it("should create a stage", async () => {
      const res = await request(app)
        .post(`/api/clinical/cases/${caseId}/stages`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          title: "Assessment Stage",
          description: "Initial assessment",
          order: 0,
          points: 10,
          options: [
            { text: "Option A", isCorrect: true, order: 0 },
            { text: "Option B", isCorrect: false, order: 1 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      stageId = res.body.data.id;
    });

    it("should update a stage", async () => {
      if (!stageId) return;
      const res = await request(app)
        .put(`/api/clinical/stages/${stageId}`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ title: "Updated Stage" });

      expect(res.status).toBe(200);
    });

    it("should delete a stage", async () => {
      if (!stageId) return;
      const res = await request(app)
        .delete(`/api/clinical/stages/${stageId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(204);
    });
  });

  describe("Student Case Attempts", () => {
    let studentUserId: string;

    beforeAll(() => {
      const payload = JSON.parse(Buffer.from(studentToken.split(".")[1], "base64").toString());
      studentUserId = payload.userId;
    });

    it("should start a case attempt", async () => {
      const res = await request(app)
        .post(`/api/clinical/cases/${SEED_CLINICAL.caseId}/start`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    afterAll(async () => {
      // Attempts cannot be removed through the API — clean them directly so
      // test runs don't accumulate phantom IN_PROGRESS rows in the
      // student's attempt list (also discards leftovers from crashed runs).
      if (!SEED_CLINICAL.caseId || !studentUserId) return;
      await db
        .delete(caseAttempts)
        .where(
          and(
            eq(caseAttempts.caseId, SEED_CLINICAL.caseId),
            eq(caseAttempts.studentId, studentUserId)
          )
        );
    });
  });

  describe("Validation", () => {
    it("should reject case without title", async () => {
      const res = await request(app)
        .post("/api/clinical/cases")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ courseId: SEED_IDS.courseId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject stage without options", async () => {
      const res = await request(app)
        .post(`/api/clinical/cases/${SEED_CLINICAL.caseId}/stages`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ title: "Stage" });

      expect(res.status).toBe(400);
    });
  });
});
