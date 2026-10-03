import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, SEED_USERS, SEED_IDS } from "./helpers.js";

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

describe("Skills Lab Module", () => {
  let instructorToken: string;
  let studentToken: string;
  let adminToken: string;

  beforeAll(async () => {
    instructorToken = await loginAs("instructor");
    studentToken = await loginAs("student");
    adminToken = await loginAs("admin");
  });

  describe("Skills CRUD", () => {
    let skillId: string;

    it("GET /api/skills-lab/skills - should list skills", async () => {
      const res = await request(app)
        .get("/api/skills-lab/skills")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/skills-lab/skills - should create a skill (instructor)", async () => {
      const res = await request(app)
        .post("/api/skills-lab/skills")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          courseId: SEED_IDS.courseId,
          name: "IV Insertion",
          description: "Intravenous catheter insertion",
          category: "PROCEDURAL",
          difficulty: "BEGINNER",
          estimatedMinutes: 30,
          equipment: ["IV catheter", "tourniquet", "alcohol swab"],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      skillId = res.body.data.id;
    });

    it("GET /api/skills-lab/skills/:id - should get a skill", async () => {
      const res = await request(app)
        .get(`/api/skills-lab/skills/${skillId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("PUT /api/skills-lab/skills/:id - should update a skill", async () => {
      const res = await request(app)
        .put(`/api/skills-lab/skills/${skillId}`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ name: "IV Insertion Updated" });

      expect(res.status).toBe(200);
    });

    it("DELETE /api/skills-lab/skills/:id - should delete a skill", async () => {
      const res = await request(app)
        .delete(`/api/skills-lab/skills/${skillId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(204);
    });

    it("POST /api/skills-lab/skills - should reject student", async () => {
      const res = await request(app)
        .post("/api/skills-lab/skills")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courseId: SEED_IDS.courseId, name: "Test" });

      expect(res.status).toBe(403);
    });
  });

  describe("Checklists", () => {
    let skillId: string;
    let checklistId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post("/api/skills-lab/skills")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ courseId: SEED_IDS.courseId, name: "Checklist Skill" });
      skillId = res.body.data.id;
    });

    afterAll(async () => {
      if (skillId) {
        await request(app)
          .delete(`/api/skills-lab/skills/${skillId}`)
          .set("Authorization", `Bearer ${instructorToken}`);
      }
    });

    it("POST /api/skills-lab/skills/:skillId/checklists - should create checklist step", async () => {
      const res = await request(app)
        .post(`/api/skills-lab/skills/${skillId}/checklists`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          stepNumber: 1,
          description: "Wash hands",
          isCritical: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      checklistId = res.body.data.id;
    });

    it("DELETE /api/skills-lab/checklists/:id - should delete checklist step", async () => {
      const res = await request(app)
        .delete(`/api/skills-lab/checklists/${checklistId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(204);
    });
  });

  describe("Stations", () => {
    let stationId: string;

    it("GET /api/skills-lab/stations - should list stations", async () => {
      const res = await request(app)
        .get("/api/skills-lab/stations")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/skills-lab/stations - should create a station (instructor)", async () => {
      const res = await request(app)
        .post("/api/skills-lab/stations")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          name: "Skills Station A",
          description: "General skills station",
          location: "Building 1, Room 101",
          capacity: 4,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      stationId = res.body.data.id;
    });

    it("GET /api/skills-lab/stations/:id - should get a station", async () => {
      const res = await request(app)
        .get(`/api/skills-lab/stations/${stationId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("PUT /api/skills-lab/stations/:id - should update a station", async () => {
      const res = await request(app)
        .put(`/api/skills-lab/stations/${stationId}`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ name: "Updated Station" });

      expect(res.status).toBe(200);
    });

    it("DELETE /api/skills-lab/stations/:id - should delete a station", async () => {
      const res = await request(app)
        .delete(`/api/skills-lab/stations/${stationId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(204);
    });
  });

  describe("Assessments", () => {
    it("GET /api/skills-lab/assessments - should list assessments", async () => {
      const res = await request(app)
        .get("/api/skills-lab/assessments")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
