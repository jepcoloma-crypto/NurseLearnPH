import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { like } from "drizzle-orm";
import { app, SEED_USERS, SEED_IDS } from "./helpers.js";
import { db } from "../src/database/index.js";
import { topics, questions, questionOptions } from "../src/database/schema/index.js";

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

describe("RBAC Enforcement", () => {
  let studentToken: string;
  let instructorToken: string;
  let coordinatorToken: string;
  let adminToken: string;

  beforeAll(async () => {
    studentToken = await loginAs("student");
    instructorToken = await loginAs("instructor");
    coordinatorToken = await loginAs("coordinator");
    adminToken = await loginAs("admin");
  });

  // Clean up test-created questions and topics
  afterAll(async () => {
    await db.delete(questionOptions).where(like(questionOptions.text, "Option %"));
    await db.delete(questions).where(like(questions.stem, "Test RBAC question%"));
    await db.delete(topics).where(like(topics.name, "Test RBAC topic%"));
  });

  describe("Student blocked from content management", () => {
    const protectedEndpoints = [
      { method: "post", path: "/api/assessment/questions", body: { stem: "test", type: "MC", courseId: SEED_IDS.courseId, options: [{ text: "A", isCorrect: true, order: 0 }] } },
      { method: "put", path: "/api/assessment/questions/00000000-0000-0000-0000-000000000001", body: { stem: "updated" } },
      { method: "delete", path: "/api/assessment/questions/00000000-0000-0000-0000-000000000001" },
      { method: "post", path: "/api/assessment/assessments", body: { title: "test", courseId: SEED_IDS.courseId, type: "QUIZ", totalPoints: 100 } },
      { method: "put", path: "/api/assessment/assessments/00000000-0000-0000-0000-000000000001", body: { title: "updated" } },
      { method: "delete", path: "/api/assessment/assessments/00000000-0000-0000-0000-000000000001" },
      { method: "post", path: "/api/learning/topics", body: { name: "test", courseId: SEED_IDS.courseId } },
      { method: "put", path: "/api/learning/topics/00000000-0000-0000-0000-000000000001", body: { name: "updated" } },
      { method: "delete", path: "/api/learning/topics/00000000-0000-0000-0000-000000000001" },
      { method: "post", path: "/api/learning/lessons", body: { title: "test", topicId: "00000000-0000-0000-0000-000000000001" } },
      { method: "put", path: "/api/learning/lessons/00000000-0000-0000-0000-000000000001", body: { title: "updated" } },
      { method: "delete", path: "/api/learning/lessons/00000000-0000-0000-0000-000000000001" },
    ];

    for (const ep of protectedEndpoints) {
      it(`should block student from ${ep.method.toUpperCase()} ${ep.path}`, async () => {
        let req = request(app)[ep.method](ep.path).set("Authorization", `Bearer ${studentToken}`);
        if (ep.body) req = req.send(ep.body);
        const res = await req;
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
      });
    }
  });

  describe("Instructor CAN write content", () => {
    it("instructor can POST to /api/assessment/questions (passes RBAC)", async () => {
      const res = await request(app)
        .post("/api/assessment/questions")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          stem: "Test RBAC question",
          type: "MC",
          courseId: SEED_IDS.courseId,
          options: [
            { text: "Option A", isCorrect: true, order: 0 },
            { text: "Option B", isCorrect: false, order: 1 },
          ],
        });

      // Should NOT be 403 - might be 201 or 400/500 depending on FK constraints
      expect(res.status).not.toBe(403);
    });

    it("instructor can POST to /api/learning/topics (passes RBAC)", async () => {
      const res = await request(app)
        .post("/api/learning/topics")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ name: "Test RBAC topic", courseId: SEED_IDS.courseId });

      expect(res.status).not.toBe(403);
    });
  });

  describe("Student CAN access permitted routes", () => {
    it("student can GET /api/assessment/questions", async () => {
      const res = await request(app)
        .get("/api/assessment/questions")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("student can GET /api/learning/topics", async () => {
      const res = await request(app)
        .get("/api/learning/topics")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("student can POST to own progress", async () => {
      const res = await request(app)
        .post("/api/learning/progress/me")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ lessonId: "00000000-0000-0000-0000-000000000001", status: "IN_PROGRESS" });

      // Should not be 403
      expect(res.status).not.toBe(403);
    });
  });

  describe("Unauthenticated access blocked", () => {
    it("should reject requests without token on protected routes", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("should reject requests without token on write routes", async () => {
      const res = await request(app)
        .post("/api/assessment/questions")
        .send({ stem: "test" });

      expect(res.status).toBe(401);
    });
  });
});
