import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq, or } from "drizzle-orm";
import { app, SEED_USERS, SEED_IDS } from "./helpers.js";
import { db } from "../src/database/index.js";
import { nursingDiagnoses, carePlans } from "../src/database/schema/index.js";

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

describe("Nursing Process Module", () => {
  let instructorToken: string;
  let studentToken: string;
  let coordinatorToken: string;

  beforeAll(async () => {
    instructorToken = await loginAs("instructor");
    studentToken = await loginAs("student");
    coordinatorToken = await loginAs("coordinator");
  });

  // Clean up test-created diagnoses so they never accumulate
  afterAll(async () => {
    await db
      .delete(nursingDiagnoses)
      .where(
        or(
          eq(nursingDiagnoses.code, "TEST-NANDA-001"),
          eq(nursingDiagnoses.code, "TEST-NANDA-002")
        )
      );
  });

  describe("Nursing Diagnoses", () => {
    let diagnosisId: string;

    it("GET /api/nursing-process/diagnoses - should list diagnoses", async () => {
      const res = await request(app)
        .get("/api/nursing-process/diagnoses")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/nursing-process/diagnoses - should create a diagnosis (instructor)", async () => {
      const res = await request(app)
        .post("/api/nursing-process/diagnoses")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          code: "TEST-NANDA-001",
          name: "Test Diagnosis Unique",
          category: "PHYSIOLOGICAL",
          definition: "Insufficient oxygenation and ventilation",
          riskFactors: ["pulmonary disease", "chest trauma"],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      diagnosisId = res.body.data.id;
    });

    it("POST /api/nursing-process/diagnoses - should reject duplicate name (case-insensitive)", async () => {
      const res = await request(app)
        .post("/api/nursing-process/diagnoses")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          code: "TEST-NANDA-002",
          name: "test diagnosis unique",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("POST /api/nursing-process/diagnoses - should reject duplicate code", async () => {
      const res = await request(app)
        .post("/api/nursing-process/diagnoses")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          code: "TEST-NANDA-001",
          name: "Test Diagnosis Different Name",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("GET /api/nursing-process/diagnoses/:id - should get a diagnosis", async () => {
      const res = await request(app)
        .get(`/api/nursing-process/diagnoses/${diagnosisId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("PUT /api/nursing-process/diagnoses/:id - should update a diagnosis", async () => {
      const res = await request(app)
        .put(`/api/nursing-process/diagnoses/${diagnosisId}`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ name: "Test Diagnosis Renamed" });

      expect(res.status).toBe(200);
    });

    it("PUT /api/nursing-process/diagnoses/:id - should reject rename to existing name", async () => {
      const res = await request(app)
        .put(`/api/nursing-process/diagnoses/${diagnosisId}`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ name: "Acute Pain" });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("POST /api/nursing-process/diagnoses - should reject student", async () => {
      const res = await request(app)
        .post("/api/nursing-process/diagnoses")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ code: "TEST", name: "Test" });

      expect(res.status).toBe(403);
    });
  });

  describe("Care Plans", () => {
    let carePlanId: string;

    // The reviewed plan cannot be deleted via API (403) — clean it up directly
    afterAll(async () => {
      if (carePlanId) {
        await db.delete(carePlans).where(eq(carePlans.id, carePlanId));
      }
    });

    it("POST /api/nursing-process/care-plans - should create a care plan (student)", async () => {
      const res = await request(app)
        .post("/api/nursing-process/care-plans")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          courseId: SEED_IDS.courseId,
          title: "Post-Op Care Plan",
          patientName: "Juan Dela Cruz",
          patientAge: 65,
          patientGender: "Male",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      carePlanId = res.body.data.id;
    });

    it("GET /api/nursing-process/care-plans - should list care plans", async () => {
      const res = await request(app)
        .get("/api/nursing-process/care-plans")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/nursing-process/care-plans/:id - should get a care plan", async () => {
      const res = await request(app)
        .get(`/api/nursing-process/care-plans/${carePlanId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("PUT /api/nursing-process/care-plans/:id - should update a care plan", async () => {
      const res = await request(app)
        .put(`/api/nursing-process/care-plans/${carePlanId}`)
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ title: "Post-Op Care Plan Updated" });

      expect(res.status).toBe(200);
    });

    it("POST /api/nursing-process/care-plans/:id/review - should review (instructor)", async () => {
      const res = await request(app)
        .post(`/api/nursing-process/care-plans/${carePlanId}/review`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          feedback: "Good care plan overall",
          status: "ACTIVE",
        });

      expect([200, 201]).toContain(res.status);
    });

    it("DELETE /api/nursing-process/care-plans/:id - should delete own DRAFT care plan", async () => {
      const created = await request(app)
        .post("/api/nursing-process/care-plans")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          courseId: SEED_IDS.courseId,
          title: "Temp Draft Plan",
          patientName: "Test Patient",
          patientAge: 30,
          patientGender: "Female",
        });

      expect(created.status).toBe(201);

      const res = await request(app)
        .delete(`/api/nursing-process/care-plans/${created.body.data.id}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(204);
    });

    it("DELETE /api/nursing-process/care-plans/:id - should reject deleting a reviewed care plan", async () => {
      const res = await request(app)
        .delete(`/api/nursing-process/care-plans/${carePlanId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    it("POST /api/nursing-process/care-plans - should reject instructor creating care plan", async () => {
      const res = await request(app)
        .post("/api/nursing-process/care-plans")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ courseId: SEED_IDS.courseId, title: "Test" });

      expect(res.status).toBe(403);
    });
  });
});
