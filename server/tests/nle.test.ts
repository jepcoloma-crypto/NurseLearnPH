import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq, and } from "drizzle-orm";
import { app, SEED_USERS } from "./helpers.js";
import { db } from "../src/database/index.js";
import { nleExamAttempts, nlePerformanceAnalytics } from "../src/database/schema/index.js";

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

// Deterministic seed IDs (stable across seed rebuilds): a1000000-… categories, b000000x questions
const SEED_NLE = {
  categoryId: "a1000000-0000-0000-0000-000000000001",
  questionId: "b0000007-0000-0000-0000-000000000001",
  examId: "0d9e911f-8a60-4ce6-977d-6049461293d3",
};

describe("NLE Prep Module", () => {
  let instructorToken: string;
  let studentToken: string;
  let adminToken: string;

  beforeAll(async () => {
    instructorToken = await loginAs("instructor");
    studentToken = await loginAs("student");
    adminToken = await loginAs("admin");
  });

  // Attempts are discarded in-scenario; drop the analytics rows they
  // aggregated so a run leaves no student performance residue behind.
  afterAll(async () => {
    await db.delete(nlePerformanceAnalytics);
  });

  describe("Categories", () => {
    it("GET /api/nle/categories - should list categories", async () => {
      const res = await request(app)
        .get("/api/nle/categories")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("GET /api/nle/categories/:id - should get category", async () => {
      const res = await request(app)
        .get(`/api/nle/categories/${SEED_NLE.categoryId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/nle/categories - should create category (admin)", async () => {
      const res = await request(app)
        .post("/api/nle/categories")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: `Test Category ${Date.now()}`,
          code: `TEST_${Date.now()}`,
          description: "Test description",
        });

      expect([200, 201]).toContain(res.status);

      // Cleanup so the seeded category count stays stable across runs
      const del = await request(app)
        .delete(`/api/nle/categories/${res.body.data.id}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(del.status).toBe(204);
    });

    it("POST /api/nle/categories - should reject student", async () => {
      const res = await request(app)
        .post("/api/nle/categories")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ name: "Test", code: "T" });

      expect(res.status).toBe(403);
    });
  });

  describe("Questions", () => {
    it("GET /api/nle/questions - should list questions", async () => {
      const res = await request(app)
        .get("/api/nle/questions")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/nle/questions/:id - should reject student (detail is staff-only)", async () => {
      const res = await request(app)
        .get(`/api/nle/questions/${SEED_NLE.questionId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    it("GET /api/nle/questions/:id - should get question (instructor)", async () => {
      const res = await request(app)
        .get(`/api/nle/questions/${SEED_NLE.questionId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/nle/questions - should create question (instructor)", async () => {
      const res = await request(app)
        .post("/api/nle/questions")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          categoryId: SEED_NLE.categoryId,
          questionText: "What is the normal body temperature?",
          questionType: "MC",
          difficulty: "EASY",
          options: [
            { optionText: "36.5°C", isCorrect: true },
            { optionText: "38.0°C", isCorrect: false },
            { optionText: "35.0°C", isCorrect: false },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Cleanup: the creator may delete their own question
      const del = await request(app)
        .delete(`/api/nle/questions/${res.body.data.id}`)
        .set("Authorization", `Bearer ${instructorToken}`);
      expect(del.status).toBe(204);
    });

    it("POST /api/nle/questions - should reject duplicate question text (case-insensitive)", async () => {
      const created = await request(app)
        .post("/api/nle/questions")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          categoryId: SEED_NLE.categoryId,
          questionText: "Duplicate guard test question",
          questionType: "MC",
          difficulty: "EASY",
          options: [
            { optionText: "Yes", isCorrect: true },
            { optionText: "No", isCorrect: false },
          ],
        });
      expect(created.status).toBe(201);

      const dup = await request(app)
        .post("/api/nle/questions")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          categoryId: SEED_NLE.categoryId,
          questionText: "duplicate guard test question",
          questionType: "MC",
          difficulty: "EASY",
          options: [
            { optionText: "Yes", isCorrect: true },
            { optionText: "No", isCorrect: false },
          ],
        });
      expect(dup.status).toBe(409);
      expect(dup.body.success).toBe(false);

      // Cleanup
      const del = await request(app)
        .delete(`/api/nle/questions/${created.body.data.id}`)
        .set("Authorization", `Bearer ${instructorToken}`);
      expect(del.status).toBe(204);
    });

    it("POST /api/nle/questions - should reject student", async () => {
      const res = await request(app)
        .post("/api/nle/questions")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          categoryId: SEED_NLE.categoryId,
          questionText: "Test",
          options: [{ optionText: "A", isCorrect: true }],
        });

      expect(res.status).toBe(403);
    });
  });

  describe("Practice (sanitized, authenticate-only)", () => {
    it("GET /api/nle/practice - should get practice questions", async () => {
      const res = await request(app)
        .get("/api/nle/practice?count=3")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/nle/practice - should allow staff but never expose the answer key", async () => {
      const res = await request(app)
        .get("/api/nle/practice?count=3")
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(200);
      const json = JSON.stringify(res.body);
      expect(json).not.toContain("isCorrect");
      expect(json).not.toContain("explanation");
    });
  });

  describe("Exams", () => {
    it("GET /api/nle/exams - should list exams", async () => {
      const res = await request(app)
        .get("/api/nle/exams")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    describe("Attempt lifecycle (student)", () => {
      let seedExam: Record<string, unknown>;
      let otherToken: string;
      let attemptId: string;
      let studentUserId: string;
      let startedQuestions: { id: string; options: { id: string }[] }[];

      it("GET /api/nle/exams/attempts - lists attempts (not shadowed by /exams/:id)", async () => {
        const res = await request(app)
          .get("/api/nle/exams/attempts")
          .set("Authorization", `Bearer ${studentToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      // Rerun safety: discard any attempt left behind by a failed run
      beforeAll(async () => {
        otherToken = await loginAs("student2");
        studentUserId = JSON.parse(Buffer.from(studentToken.split(".")[1], "base64").toString()).userId;
        const res = await request(app)
          .get("/api/nle/exams")
          .set("Authorization", `Bearer ${studentToken}`);
        const items = res.body.data?.items ?? [];
        seedExam = items.find((e: Record<string, unknown>) => e.id === SEED_NLE.examId) ?? items[0];
        expect(seedExam).toBeTruthy();

        const attempts = await request(app)
          .get("/api/nle/exams/attempts")
          .set("Authorization", `Bearer ${studentToken}`);
        for (const a of attempts.body.data ?? []) {
          if (a.status === "IN_PROGRESS") {
            await request(app)
              .delete(`/api/nle/exams/attempts/${a.id}`)
              .set("Authorization", `Bearer ${studentToken}`);
          }
        }

        // Completed attempts cannot be discarded via the API — remove any
        // leftovers (including from crashed runs) directly so they don't
        // accumulate in the student's attempt history.
        await db
          .delete(nleExamAttempts)
          .where(
            and(
              eq(nleExamAttempts.studentId, studentUserId),
              eq(nleExamAttempts.examId, String(seedExam.id))
            )
          );
      });

      afterAll(async () => {
        // This run's completed attempt is rejected by the API (403 by design),
        // so clean it up directly to leave no trace.
        if (!studentUserId || !seedExam?.id) return;
        await db
          .delete(nleExamAttempts)
          .where(
            and(
              eq(nleExamAttempts.studentId, studentUserId),
              eq(nleExamAttempts.examId, String(seedExam.id))
            )
          );
      });

      it("POST /api/nle/exams/start - starts an attempt with sanitized questions", async () => {
        const res = await request(app)
          .post("/api/nle/exams/start")
          .set("Authorization", `Bearer ${studentToken}`)
          .send({ examId: seedExam.id });

        expect(res.status).toBe(201);
        const { attempt, questions } = res.body.data;
        expect(attempt.status).toBe("IN_PROGRESS");
        expect(questions.length).toBeGreaterThan(0);
        expect(questions.length).toBe(attempt.totalQuestions);
        for (const q of questions) {
          expect(q.explanation).toBeUndefined();
          for (const o of q.options) expect(o.isCorrect).toBeUndefined();
        }
        attemptId = attempt.id;
        startedQuestions = questions;
      });

      it("POST /api/nle/exams/start - rejects a second concurrent attempt", async () => {
        const res = await request(app)
          .post("/api/nle/exams/start")
          .set("Authorization", `Bearer ${studentToken}`)
          .send({ examId: seedExam.id });

        expect(res.status).toBe(403);
      });

      it("GET /api/nle/exams/attempts/:id - resumes the persisted question set without the answer key", async () => {
        const res = await request(app)
          .get(`/api/nle/exams/attempts/${attemptId}`)
          .set("Authorization", `Bearer ${studentToken}`);

        expect(res.status).toBe(200);
        const { attempt, questions, answers } = res.body.data;
        expect(attempt.status).toBe("IN_PROGRESS");
        // Same order and full set — question_ids is persisted at start, not derived from answers
        expect(questions.map((q: { id: string }) => q.id)).toEqual(startedQuestions.map((q) => q.id));
        expect(answers).toEqual([]);
        for (const q of questions) {
          expect(q.explanation).toBeUndefined();
          for (const o of q.options) expect(o.isCorrect).toBeUndefined();
        }
      });

      it("GET /api/nle/exams/attempts/:id - rejects another student", async () => {
        const res = await request(app)
          .get(`/api/nle/exams/attempts/${attemptId}`)
          .set("Authorization", `Bearer ${otherToken}`);

        expect(res.status).toBe(403);
      });

      it("POST /api/nle/exams/:attemptId/submit - grades the attempt", async () => {
        const answers = startedQuestions.map((q) => ({
          questionId: q.id,
          selectedOptionId: q.options[0]?.id,
        }));
        const res = await request(app)
          .post(`/api/nle/exams/${attemptId}/submit`)
          .set("Authorization", `Bearer ${studentToken}`)
          .send({ answers });

        expect(res.status).toBe(200);
        const attempt = res.body.data;
        expect(attempt.status).toBe("COMPLETED");
        expect(attempt.score).not.toBeNull();
        expect(attempt.score).toBeGreaterThanOrEqual(0);
        expect(attempt.score).toBeLessThanOrEqual(100);
        expect(attempt.correctAnswers).toBeGreaterThanOrEqual(0);
        expect(attempt.correctAnswers).toBeLessThanOrEqual(startedQuestions.length);
        expect(attempt.timeSpentSeconds).not.toBeNull();
      });

      it("GET /api/nle/exams/attempts/:id - completed attempt exposes the full review", async () => {
        const res = await request(app)
          .get(`/api/nle/exams/attempts/${attemptId}`)
          .set("Authorization", `Bearer ${studentToken}`);

        expect(res.status).toBe(200);
        const { attempt, questions, answers } = res.body.data;
        expect(attempt.status).toBe("COMPLETED");
        expect(questions.map((q: { id: string }) => q.id)).toEqual(startedQuestions.map((q) => q.id));
        expect(answers.length).toBe(startedQuestions.length);
        for (const q of questions) {
          expect(q.options.some((o: { isCorrect?: boolean }) => o.isCorrect === true)).toBe(true);
          if (seedExam.showExplanations) {
            expect(q.explanation).toBeDefined();
          } else {
            expect(q.explanation).toBeUndefined();
          }
        }
        for (const a of answers) expect(typeof a.isCorrect).toBe("boolean");
      });

      it("DELETE /api/nle/exams/attempts/:id - completed attempts cannot be discarded", async () => {
        const res = await request(app)
          .delete(`/api/nle/exams/attempts/${attemptId}`)
          .set("Authorization", `Bearer ${studentToken}`);

        expect(res.status).toBe(403);
      });

      it("DELETE /api/nle/exams/attempts/:id - owner discards an in-progress attempt and can restart", async () => {
        const start1 = await request(app)
          .post("/api/nle/exams/start")
          .set("Authorization", `Bearer ${studentToken}`)
          .send({ examId: seedExam.id });
        expect(start1.status).toBe(201);

        const foreign = await request(app)
          .delete(`/api/nle/exams/attempts/${start1.body.data.attempt.id}`)
          .set("Authorization", `Bearer ${otherToken}`);
        expect(foreign.status).toBe(403);

        const discard = await request(app)
          .delete(`/api/nle/exams/attempts/${start1.body.data.attempt.id}`)
          .set("Authorization", `Bearer ${studentToken}`);
        expect(discard.status).toBe(204);

        // The block is lifted: a fresh start succeeds, then clean up so reruns stay green
        const start2 = await request(app)
          .post("/api/nle/exams/start")
          .set("Authorization", `Bearer ${studentToken}`)
          .send({ examId: seedExam.id });
        expect(start2.status).toBe(201);

        const cleanup = await request(app)
          .delete(`/api/nle/exams/attempts/${start2.body.data.attempt.id}`)
          .set("Authorization", `Bearer ${studentToken}`);
        expect(cleanup.status).toBe(204);
      });
    });
  });

  describe("Performance Analytics (student)", () => {
    it("GET /api/nle/performance - should get performance", async () => {
      const res = await request(app)
        .get("/api/nle/performance")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("GET /api/nle/performance/weaknesses - should get weaknesses", async () => {
      const res = await request(app)
        .get("/api/nle/performance/weaknesses")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe("Validation", () => {
    it("should reject question without category", async () => {
      const res = await request(app)
        .post("/api/nle/questions")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          questionText: "Test",
          options: [{ optionText: "A", isCorrect: true }],
        });

      expect(res.status).toBe(400);
    });
  });
});
