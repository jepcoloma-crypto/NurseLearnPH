import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { inArray, eq } from "drizzle-orm";
import { app, SEED_USERS } from "./helpers.js";
import { db } from "../src/database/index.js";
import { aiConversations, aiHints } from "../src/database/schema/index.js";

// Deterministic AI: force the services' built-in mock engines instead of the
// real Gemini API (avoids 429 quota exhaustion and 30s test timeouts).
vi.mock("../src/services/gemini.service.js", () => ({
  isGeminiConfigured: () => false,
  generateText: async () => "{}",
  generateQuestions: async () => [],
  generateLessonFromContent: async () => ({
    title: "Mock Lesson",
    description: "Mock lesson description",
    content: "Mock content",
    objectives: [],
    keyTerms: [],
    practiceQuestions: [],
  }),
  generateTutorResponse: async () => "Mocked tutor response.",
  analyzeDocument: async () => ({
    summary: "Mock summary",
    keyConcepts: [],
    learningObjectives: [],
    suggestedLessonTitle: "Mock Lesson",
    suggestedCategory: "Fundamentals",
    rawContent: "",
  }),
}));

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

describe("AI Tutor Module", () => {
  let instructorToken: string;
  let studentToken: string;
  let adminToken: string;
  const createdConversationIds: string[] = [];

  beforeAll(async () => {
    instructorToken = await loginAs("instructor");
    studentToken = await loginAs("student");
    adminToken = await loginAs("admin");
  });

  afterAll(async () => {
    // Conversations are visible in the student's chat history and have no
    // delete endpoint — remove test-created ones (messages cascade) so
    // every run leaves no trace.
    if (createdConversationIds.length > 0) {
      await db.delete(aiConversations).where(inArray(aiConversations.id, createdConversationIds));
    }
    // The admin "create hint" test uses topic "Wound Care", which the seed
    // never creates — safe fingerprint for test-created hints.
    await db.delete(aiHints).where(eq(aiHints.topic, "Wound Care"));
  });

  describe("Chat", () => {
    it("POST /api/ai-tutor/chat - should send a message (student)", async () => {
      const res = await request(app)
        .post("/api/ai-tutor/chat")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          message: "What are the stages of wound healing?",
          mode: "STANDARD",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      if (res.body.data?.conversationId) createdConversationIds.push(res.body.data.conversationId);
    });

    it("POST /api/ai-tutor/chat - should reject instructor", async () => {
      const res = await request(app)
        .post("/api/ai-tutor/chat")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ message: "Test" });

      expect(res.status).toBe(403);
    });
  });

  describe("Conversations", () => {
    it("GET /api/ai-tutor/conversations - should list conversations", async () => {
      const res = await request(app)
        .get("/api/ai-tutor/conversations")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Hints", () => {
    it("POST /api/ai-tutor/hint - should get a hint (student)", async () => {
      const res = await request(app)
        .post("/api/ai-tutor/hint")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          topic: "Pharmacology",
          subtopic: "Antibiotics",
          currentLevel: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/ai-tutor/hints - should list hints", async () => {
      const res = await request(app)
        .get("/api/ai-tutor/hints")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/ai-tutor/hints - should create a hint (admin)", async () => {
      const res = await request(app)
        .post("/api/ai-tutor/hints")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          topic: "Wound Care",
          hintContent: "Always assess wound dimensions before and after cleaning",
        });

      expect([200, 201]).toContain(res.status);
    });
  });

  describe("Socratic Mode", () => {
    it("POST /api/ai-tutor/socratic/start - should start a session (student)", async () => {
      const res = await request(app)
        .post("/api/ai-tutor/socratic/start")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          topic: "Fluid and Electrolyte Balance",
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      if (res.body.data?.conversationId) createdConversationIds.push(res.body.data.conversationId);
    });

    it("GET /api/ai-tutor/socratic/questions - should list questions", async () => {
      const res = await request(app)
        .get("/api/ai-tutor/socratic/questions")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Lesson Assistance", () => {
    it("POST /api/ai-tutor/lesson-assist - should get lesson help (student)", async () => {
      const res = await request(app)
        .post("/api/ai-tutor/lesson-assist")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          lessonId: "1854732a-26e1-44aa-8694-73392f14f413",
          question: "Can you explain the key concepts from this lesson?",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      if (res.body.data?.conversationId) createdConversationIds.push(res.body.data.conversationId);
    });
  });
});
