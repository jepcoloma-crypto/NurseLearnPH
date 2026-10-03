import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app, SEED_USERS, SEED_IDS } from "./helpers.js";

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

describe("Assessment Module", () => {
  let instructorToken: string;
  let studentToken: string;

  beforeAll(async () => {
    instructorToken = await loginAs("instructor");
    studentToken = await loginAs("student");
  });

  describe("GET /api/assessment/questions", () => {
    it("should list questions", async () => {
      const res = await request(app)
        .get("/api/assessment/questions")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it("should support pagination", async () => {
      const res = await request(app)
        .get("/api/assessment/questions?page=1&limit=5")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/assessment/assessments", () => {
    it("should list assessments", async () => {
      const res = await request(app)
        .get("/api/assessment/assessments")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Question CRUD (instructor)", () => {
    let questionId: string;

    it("should create a question", async () => {
      const res = await request(app)
        .post("/api/assessment/questions")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          stem: "Test integration question",
          type: "MC",
          courseId: SEED_IDS.courseId,
          difficulty: "EASY",
          options: [
            { text: "Correct", isCorrect: true, order: 0 },
            { text: "Wrong", isCorrect: false, order: 1 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      questionId = res.body.data.id;
    });

    it("should reject duplicate stem in same course (case-insensitive)", async () => {
      const res = await request(app)
        .post("/api/assessment/questions")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          stem: "TEST INTEGRATION QUESTION",
          type: "MC",
          courseId: SEED_IDS.courseId,
          options: [
            { text: "Correct", isCorrect: true, order: 0 },
            { text: "Wrong", isCorrect: false, order: 1 },
          ],
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should reject renaming a question to an existing stem", async () => {
      const helper = await request(app)
        .post("/api/assessment/questions")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          stem: "Rename conflict helper question",
          type: "MC",
          courseId: SEED_IDS.courseId,
          options: [
            { text: "Correct", isCorrect: true, order: 0 },
            { text: "Wrong", isCorrect: false, order: 1 },
          ],
        });
      expect(helper.status).toBe(201);

      const rename = await request(app)
        .put(`/api/assessment/questions/${helper.body.data.id}`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ stem: "Test integration question" });
      expect(rename.status).toBe(409);

      await request(app)
        .delete(`/api/assessment/questions/${helper.body.data.id}`)
        .set("Authorization", `Bearer ${instructorToken}`);
    });

    it("should get a question by id", async () => {
      if (!questionId) return;
      const res = await request(app)
        .get(`/api/assessment/questions/${questionId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("should update a question", async () => {
      if (!questionId) return;
      const res = await request(app)
        .put(`/api/assessment/questions/${questionId}`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ stem: "Updated question" });

      expect(res.status).toBe(200);
    });

    it("should delete a question", async () => {
      if (!questionId) return;
      const res = await request(app)
        .delete(`/api/assessment/questions/${questionId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(204);
    });
  });

  describe("Validation", () => {
    it("should reject question without stem", async () => {
      const res = await request(app)
        .post("/api/assessment/questions")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ type: "MC" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject MC question with < 2 options", async () => {
      const res = await request(app)
        .post("/api/assessment/questions")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          stem: "Test",
          type: "MC",
          courseId: "00000000-0000-0000-0000-000000000001",
          options: [{ text: "Only one", isCorrect: true, order: 0 }],
        });

      expect(res.status).toBe(400);
    });
  });
});
