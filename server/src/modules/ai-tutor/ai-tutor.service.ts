import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  aiConversations,
  aiMessages,
  aiHints,
  aiSocraticQuestions,
  aiContextCache,
  lessons,
  learningMaterials,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { NotFoundError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";
import { isGeminiConfigured, generateTutorResponse } from "../../services/gemini.service.js";
import {
  generateAIResponse,
  generateSocraticResponse,
  generateHint,
  generateLessonAssistance,
} from "./mock-ai-engine.js";

const logger = createChildLogger("ai-tutor-service");

// ─── Context Retrieval ───────────────────────────────────────────────────────

async function retrieveContext(query: string, lessonId?: string): Promise<string[]> {
  const sources: string[] = [];

  if (lessonId) {
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId));
    if (lesson) {
      sources.push(`lesson:${lesson.title}`);
      const materials = await db.select().from(learningMaterials).where(eq(learningMaterials.lessonId, lessonId));
      for (const mat of materials) {
        sources.push(`material:${mat.title}`);
      }
    }
  }

  const lowerQuery = query.toLowerCase();
  const keywords = lowerQuery.split(/\s+/).filter(w => w.length > 3);

  for (const keyword of keywords.slice(0, 3)) {
    const [cached] = await db.select().from(aiContextCache).where(sql`${aiContextCache.tags}::text ILIKE ${`%${keyword}%`}`).limit(1);
    if (cached) {
      sources.push(`cache:${cached.title}`);
    }
  }

  return sources;
}

// ─── Conversations ───────────────────────────────────────────────────────────

export async function listConversations(query: { studentId?: string; courseId?: string; page: number; limit: number }) {
  const { studentId, courseId, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (studentId) conditions.push(eq(aiConversations.studentId, studentId));
  if (courseId) conditions.push(eq(aiConversations.courseId, courseId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(aiConversations).where(where);
  const items = await db.select().from(aiConversations).where(where).orderBy(desc(aiConversations.updatedAt)).limit(limit).offset(offset);
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getConversationById(id: string) {
  const [conversation] = await db.select().from(aiConversations).where(eq(aiConversations.id, id));
  if (!conversation) throw new NotFoundError("AI Conversation");
  const messages = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, id)).orderBy(aiMessages.createdAt);
  return { ...conversation, messages };
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export async function chat(data: {
  studentId: string;
  conversationId?: string;
  courseId?: string;
  lessonId?: string;
  message: string;
  mode?: string;
}) {
  let conversation;

  if (data.conversationId) {
    const [existing] = await db.select().from(aiConversations).where(eq(aiConversations.id, data.conversationId));
    if (!existing) throw new NotFoundError("AI Conversation");
    conversation = existing;
  } else {
    const [newConv] = await db.insert(aiConversations).values({
      studentId: data.studentId,
      courseId: data.courseId ?? null,
      lessonId: data.lessonId ?? null,
      title: data.message.substring(0, 100),
      mode: data.mode ?? "STANDARD",
    }).returning();
    conversation = newConv;
  }

  await db.insert(aiMessages).values({
    conversationId: conversation.id,
    role: "USER",
    content: data.message,
    messageType: "TEXT",
  });

  const history = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, conversation.id)).orderBy(aiMessages.createdAt);
  const conversationHistory = history.map(m => m.content);

  const contextSources = await retrieveContext(data.message, data.lessonId);

  let aiResponse;
  if (isGeminiConfigured()) {
    try {
      let lessonContext: string | undefined;
      if (data.lessonId) {
        const [lesson] = await db.select().from(lessons).where(eq(lessons.id, data.lessonId));
        if (lesson) lessonContext = `Lesson: ${lesson.title}`;
      }
      const content = await generateTutorResponse(data.message, conversationHistory, lessonContext);
      aiResponse = { content, messageType: data.mode === "SOCRATIC" ? "SOCRATIC" : "TEXT", confidence: 0.9 };
    } catch (err) {
      logger.warn({ err }, "Gemini failed, falling back to mock engine");
      if (data.mode === "SOCRATIC") {
        const lastAiMessage = history.filter(m => m.role === "ASSISTANT").pop();
        aiResponse = generateSocraticResponse({ topic: data.message, studentAnswer: lastAiMessage ? data.message : undefined, conversationHistory });
      } else if (data.mode === "HINT_MODE") {
        aiResponse = generateHint({ topic: data.message, currentLevel: history.length });
      } else {
        aiResponse = generateAIResponse(data.message, conversationHistory);
      }
    }
  } else {
    if (data.mode === "SOCRATIC") {
      const lastAiMessage = history.filter(m => m.role === "ASSISTANT").pop();
      aiResponse = generateSocraticResponse({ topic: data.message, studentAnswer: lastAiMessage ? data.message : undefined, conversationHistory });
    } else if (data.mode === "HINT_MODE") {
      aiResponse = generateHint({ topic: data.message, currentLevel: history.length });
    } else {
      aiResponse = generateAIResponse(data.message, conversationHistory);
    }
  }

  await db.insert(aiMessages).values({
    conversationId: conversation.id,
    role: "ASSISTANT",
    content: aiResponse.content,
    messageType: aiResponse.messageType,
    contextSources: contextSources.length > 0 ? contextSources : null,
    metadata: { confidence: aiResponse.confidence },
  });

  await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, conversation.id));

  await logAudit({ userId: data.studentId, action: "AI_TUTOR_CHAT", resource: "AI_CONVERSATION", resourceId: conversation.id });

  return {
    conversationId: conversation.id,
    response: aiResponse.content,
    messageType: aiResponse.messageType,
    confidence: aiResponse.confidence,
    sources: contextSources,
  };
}

// ─── Hints ───────────────────────────────────────────────────────────────────

export async function getHint(data: { topic: string; subtopic?: string; currentLevel: number }) {
  const conditions: ReturnType<typeof sql>[] = [eq(aiHints.isActive, true), eq(aiHints.topic, data.topic)];
  if (data.subtopic) conditions.push(eq(aiHints.subtopic, data.subtopic));

  const hints = await db.select().from(aiHints).where(and(...conditions)).orderBy(aiHints.hintLevel);

  const currentHint = hints.find(h => h.hintLevel === data.currentLevel) || hints[0];

  if (currentHint) {
    return {
      hint: currentHint.hintContent,
      level: currentHint.hintLevel,
      maxLevel: hints.length,
      topic: data.topic,
    };
  }

  const aiResponse = generateHint(data);
  return {
    hint: aiResponse.content,
    level: data.currentLevel,
    maxLevel: 3,
    topic: data.topic,
  };
}

// ─── Socratic Mode ───────────────────────────────────────────────────────────

export async function startSocraticSession(data: {
  studentId: string;
  courseId?: string;
  topic: string;
}) {
  const [conversation] = await db.insert(aiConversations).values({
    studentId: data.studentId,
    courseId: data.courseId ?? null,
    title: `Socratic: ${data.topic}`,
    mode: "SOCRATIC",
  }).returning();

  const questions = await db.select().from(aiSocraticQuestions).where(
    and(eq(aiSocraticQuestions.isActive, true), eq(aiSocraticQuestions.topic, data.topic))
  );

  const socraticQuestion = questions[0];

  const initialMessage = socraticQuestion
    ? socraticQuestion.question
    : `Let's explore the topic of ${data.topic} together. What do you already know about this subject?`;

  await db.insert(aiMessages).values({
    conversationId: conversation.id,
    role: "ASSISTANT",
    content: initialMessage,
    messageType: "SOCRATIC",
  });

  return {
    conversationId: conversation.id,
    question: initialMessage,
    topic: data.topic,
  };
}

// ─── Lesson Assistance ───────────────────────────────────────────────────────

export async function getLessonAssistance(data: {
  studentId: string;
  lessonId: string;
  question: string;
}) {
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, data.lessonId));
  if (!lesson) throw new NotFoundError("Lesson");

  const materials = await db.select().from(learningMaterials).where(eq(learningMaterials.lessonId, data.lessonId));
  const lessonContent = materials.map(m => m.title).join(", ");

  const [conversation] = await db.insert(aiConversations).values({
    studentId: data.studentId,
    lessonId: data.lessonId,
    title: `Help: ${lesson.title}`,
    mode: "STANDARD",
  }).returning();

  await db.insert(aiMessages).values({
    conversationId: conversation.id,
    role: "USER",
    content: data.question,
    messageType: "TEXT",
  });

  const aiResponse = generateLessonAssistance(lesson.title, lessonContent, data.question);

  await db.insert(aiMessages).values({
    conversationId: conversation.id,
    role: "ASSISTANT",
    content: aiResponse.content,
    messageType: aiResponse.messageType,
    metadata: { confidence: aiResponse.confidence },
  });

  return {
    conversationId: conversation.id,
    response: aiResponse.content,
    lessonTitle: lesson.title,
  };
}

// ─── Admin: Hints Management ─────────────────────────────────────────────────

export async function listHints(topic?: string) {
  const conditions: ReturnType<typeof sql>[] = [eq(aiHints.isActive, true)];
  if (topic) conditions.push(eq(aiHints.topic, topic));
  const items = await db.select().from(aiHints).where(and(...conditions)).orderBy(aiHints.topic, aiHints.hintLevel);
  return items;
}

export async function createHint(data: { topic: string; subtopic?: string; hintLevel: number; hintContent: string; relatedLessonId?: string; tags?: string[] }) {
  const [item] = await db.insert(aiHints).values({
    topic: data.topic,
    subtopic: data.subtopic ?? null,
    hintLevel: data.hintLevel,
    hintContent: data.hintContent,
    relatedLessonId: data.relatedLessonId ?? null,
    tags: data.tags ?? null,
  }).returning();
  return item;
}

// ─── Admin: Socratic Questions Management ────────────────────────────────────

export async function listSocraticQuestions(topic?: string) {
  const conditions: ReturnType<typeof sql>[] = [eq(aiSocraticQuestions.isActive, true)];
  if (topic) conditions.push(eq(aiSocraticQuestions.topic, topic));
  const items = await db.select().from(aiSocraticQuestions).where(and(...conditions));
  return items;
}

export async function createSocraticQuestion(data: { topic: string; question: string; followUpQuestions?: string[]; expectedReasoning?: string; difficulty?: string }) {
  const [item] = await db.insert(aiSocraticQuestions).values({
    topic: data.topic,
    question: data.question,
    followUpQuestions: data.followUpQuestions ?? null,
    expectedReasoning: data.expectedReasoning ?? null,
    difficulty: data.difficulty ?? "MEDIUM",
  }).returning();
  return item;
}
