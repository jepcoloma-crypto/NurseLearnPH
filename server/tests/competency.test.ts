import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app, SEED_USERS } from "./helpers.js";

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

describe("Competency Module", () => {
  let instructorToken: string;
  let studentToken: string;
  let coordinatorToken: string;
  let adminToken: string;

  beforeAll(async () => {
    instructorToken = await loginAs("instructor");
    studentToken = await loginAs("student");
    coordinatorToken = await loginAs("coordinator");
    adminToken = await loginAs("admin");
  });

  describe("Frameworks", () => {
    let frameworkId: string;

    it("GET /api/competency/frameworks - should list frameworks", async () => {
      const res = await request(app)
        .get("/api/competency/frameworks")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/competency/frameworks - should create a framework (coordinator)", async () => {
      const res = await request(app)
        .post("/api/competency/frameworks")
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({
          name: "BSN Competency Framework 2026",
          description: "Updated competency framework",
          version: "2.0",
          isDefault: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      frameworkId = res.body.data.id;
    });

    it("GET /api/competency/frameworks/:id - should get a framework", async () => {
      const res = await request(app)
        .get(`/api/competency/frameworks/${frameworkId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("PUT /api/competency/frameworks/:id - should update a framework", async () => {
      const res = await request(app)
        .put(`/api/competency/frameworks/${frameworkId}`)
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({ name: "BSN Framework Updated" });

      expect(res.status).toBe(200);
    });

    it("POST /api/competency/frameworks - should reject student", async () => {
      const res = await request(app)
        .post("/api/competency/frameworks")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ name: "Test" });

      expect(res.status).toBe(403);
    });

    it("DELETE /api/competency/frameworks/:id - should delete a framework (admin)", async () => {
      const res = await request(app)
        .delete(`/api/competency/frameworks/${frameworkId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });
  });

  describe("Competencies", () => {
    it("GET /api/competency/competencies - should list competencies", async () => {
      const res = await request(app)
        .get("/api/competency/competencies")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Student Competencies", () => {
    it("GET /api/competency/students/:studentId/competencies - should reject student viewing another student", async () => {
      const res = await request(app)
        .get(`/api/competency/students/00000000-0000-0000-0000-000000000000/competencies`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });
});
