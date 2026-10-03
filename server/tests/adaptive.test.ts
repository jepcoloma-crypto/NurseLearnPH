import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app, SEED_USERS, SEED_IDS, getStudentId } from "./helpers.js";

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

describe("Adaptive Learning Module", () => {
  let instructorToken: string;
  let studentToken: string;
  let coordinatorToken: string;
  let adminToken: string;
  let studentId: string;

  beforeAll(async () => {
    instructorToken = await loginAs("instructor");
    studentToken = await loginAs("student");
    coordinatorToken = await loginAs("coordinator");
    adminToken = await loginAs("admin");
    studentId = await getStudentId();
  });

  describe("Learning Paths", () => {
    let pathId: string;

    it("GET /api/adaptive/learning-paths - should list learning paths", async () => {
      const res = await request(app)
        .get("/api/adaptive/learning-paths")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/adaptive/learning-paths - should create a learning path (student)", async () => {
      const res = await request(app)
        .post("/api/adaptive/learning-paths")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          courseId: SEED_IDS.courseId,
          title: "Fundamentals Review Path",
          description: "Review path for fundamentals",
          isAdaptive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      pathId = res.body.data.id;
    });

    it("GET /api/adaptive/learning-paths/:id - should get a learning path", async () => {
      const res = await request(app)
        .get(`/api/adaptive/learning-paths/${pathId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("PUT /api/adaptive/learning-paths/:id - should update a learning path", async () => {
      const res = await request(app)
        .put(`/api/adaptive/learning-paths/${pathId}`)
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ title: "Updated Path" });

      expect(res.status).toBe(200);
    });

    it("DELETE /api/adaptive/learning-paths/:id - should delete a learning path", async () => {
      const res = await request(app)
        .delete(`/api/adaptive/learning-paths/${pathId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(204);
    });

    it("POST /api/adaptive/learning-paths - should reject instructor", async () => {
      const res = await request(app)
        .post("/api/adaptive/learning-paths")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ courseId: SEED_IDS.courseId, title: "Test" });

      expect(res.status).toBe(403);
    });
  });

  describe("Remediation Plans", () => {
    let planId: string;

    it("GET /api/adaptive/remediation-plans - should list remediation plans", async () => {
      const res = await request(app)
        .get("/api/adaptive/remediation-plans")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/adaptive/remediation-plans - should create a plan (coordinator)", async () => {
      const res = await request(app)
        .post("/api/adaptive/remediation-plans")
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({
          studentId: studentId,
          courseId: SEED_IDS.courseId,
          title: "Remediation for Pharmacology",
          reason: "Low assessment scores",
          targetCompetency: "Pharmacology",
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      planId = res.body.data.id;
    });

    it("GET /api/adaptive/remediation-plans/:id - should get a plan", async () => {
      if (!planId) return;
      const res = await request(app)
        .get(`/api/adaptive/remediation-plans/${planId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("PUT /api/adaptive/remediation-plans/:id - should update a plan", async () => {
      if (!planId) return;
      const res = await request(app)
        .put(`/api/adaptive/remediation-plans/${planId}`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ title: "Updated Remediation" });

      expect(res.status).toBe(200);
    });

    it("DELETE /api/adaptive/remediation-plans/:id - should delete a plan", async () => {
      if (!planId) return;
      const res = await request(app)
        .delete(`/api/adaptive/remediation-plans/${planId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(204);
    });
  });

  describe("Prerequisites", () => {
    it("GET /api/adaptive/courses/:courseId/prerequisites - should list prerequisites", async () => {
      const res = await request(app)
        .get(`/api/adaptive/courses/${SEED_IDS.courseId}/prerequisites`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/adaptive/prerequisites - should reject student", async () => {
      const res = await request(app)
        .post("/api/adaptive/prerequisites")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          courseId: SEED_IDS.courseId,
          prerequisiteCourseId: SEED_IDS.courseId,
        });

      expect(res.status).toBe(403);
    });
  });
});
