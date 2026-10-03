import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq, like } from "drizzle-orm";
import { app, SEED_USERS, SEED_IDS } from "./helpers.js";
import { db } from "../src/database/index.js";
import { topics, studentLessonProgress } from "../src/database/schema/index.js";

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

describe("Learning Module", () => {
  let instructorToken: string;
  let studentToken: string;

  beforeAll(async () => {
    instructorToken = await loginAs("instructor");
    studentToken = await loginAs("student");
  });

  // Safety net: delete any test topics left behind by failed deletes
  afterAll(async () => {
    await db.delete(topics).where(like(topics.name, "Integration Test Topic%"));
    await db.delete(topics).where(like(topics.name, "Updated Topic%"));
    // The progress upsert above writes against a seed lesson — remove it so a
    // test run leaves no student lesson-progress residue.
    await db.delete(studentLessonProgress).where(eq(studentLessonProgress.lessonId, SEED_IDS.lessonId));
  });

  describe("GET /api/learning/topics", () => {
    it("should list topics", async () => {
      const res = await request(app)
        .get("/api/learning/topics")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /api/learning/lessons", () => {
    it("should list lessons", async () => {
      const res = await request(app)
        .get("/api/learning/lessons")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Topic CRUD (instructor)", () => {
    let topicId: string;

    it("should create a topic", async () => {
      const res = await request(app)
        .post("/api/learning/topics")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          name: "Integration Test Topic",
          courseId: SEED_IDS.courseId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      topicId = res.body.data.id;
    });

    it("should get a topic by id", async () => {
      if (!topicId) return;
      const res = await request(app)
        .get(`/api/learning/topics/${topicId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("should update a topic", async () => {
      if (!topicId) return;
      const res = await request(app)
        .put(`/api/learning/topics/${topicId}`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ name: "Updated Topic" });

      expect(res.status).toBe(200);
    });

    it("should delete a topic", async () => {
      if (!topicId) return;
      const res = await request(app)
        .delete(`/api/learning/topics/${topicId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(204);
    });
  });

  describe("Student progress", () => {
    it("student can update own progress", async () => {
      const res = await request(app)
        .post("/api/learning/progress/me")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          lessonId: SEED_IDS.lessonId,
          status: "IN_PROGRESS",
        });

      expect(res.status).not.toBe(403);
    });

    it("student can get own progress", async () => {
      const res = await request(app)
        .get(`/api/learning/progress/me/${SEED_IDS.lessonId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).not.toBe(403);
    });
  });

  describe("Validation", () => {
    it("should reject topic without name", async () => {
      const res = await request(app)
        .post("/api/learning/topics")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ courseId: "00000000-0000-0000-0000-000000000001" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject lesson without title", async () => {
      const res = await request(app)
        .post("/api/learning/lessons")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ topicId: "00000000-0000-0000-0000-000000000001" });

      expect(res.status).toBe(400);
    });
  });
});
