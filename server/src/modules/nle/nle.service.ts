import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  nleCategories,
  nleQuestionBank,
  nleQuestionOptions,
  nleExams,
  nleExamAttempts,
  nleAttemptAnswers,
  nlePerformanceAnalytics,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { NotFoundError, ForbiddenError, ConflictError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";

const logger = createChildLogger("nle-service");

// ─── Categories ──────────────────────────────────────────────────────────────

export async function listCategories() {
  const items = await db.select().from(nleCategories).orderBy(nleCategories.sortOrder);
  return items;
}

export async function getCategoryById(id: string) {
  const [item] = await db.select().from(nleCategories).where(eq(nleCategories.id, id));
  if (!item) throw new NotFoundError("NLE Category");
  return item;
}

export async function createCategory(data: { name: string; description?: string; code: string; parentId?: string; sortOrder?: number }) {
  const [item] = await db.insert(nleCategories).values({
    name: data.name,
    description: data.description ?? null,
    code: data.code,
    parentId: data.parentId ?? null,
    sortOrder: data.sortOrder ?? 0,
  }).returning();

  await logAudit({ action: "CREATE", resource: "nle_category", resourceId: item.id, metadata: { name: data.name, code: data.code } });

  return item;
}

export async function updateCategory(id: string, data: Record<string, unknown>) {
  const [existing] = await db.select().from(nleCategories).where(eq(nleCategories.id, id));
  if (!existing) throw new NotFoundError("NLE Category");
  const [item] = await db.update(nleCategories).set(data).where(eq(nleCategories.id, id)).returning();

  await logAudit({ action: "UPDATE", resource: "nle_category", resourceId: item.id });

  return item;
}

export async function deleteCategory(id: string) {
  const [existing] = await db.select().from(nleCategories).where(eq(nleCategories.id, id));
  if (!existing) throw new NotFoundError("NLE Category");
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(nleQuestionBank)
    .where(eq(nleQuestionBank.categoryId, id));
  if (countRow.count > 0) {
    throw new ConflictError(`Category still has ${countRow.count} question(s) — deactivate it instead of deleting`);
  }
  await db.delete(nleCategories).where(eq(nleCategories.id, id));

  await logAudit({ action: "DELETE", resource: "nle_category", resourceId: id });
}

// ─── Questions ───────────────────────────────────────────────────────────────

export async function listQuestions(query: { categoryId?: string; difficulty?: string; page: number; limit: number }, includeExplanation = true) {
  const { categoryId, difficulty, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (categoryId) conditions.push(eq(nleQuestionBank.categoryId, categoryId));
  if (difficulty) conditions.push(eq(nleQuestionBank.difficulty, difficulty));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(nleQuestionBank).where(where);
  const rows = await db.select().from(nleQuestionBank).where(where).orderBy(desc(nleQuestionBank.createdAt)).limit(limit).offset(offset);
  // Non-staff (students) must not receive explanations — they often contain the answer
  const items = includeExplanation ? rows : rows.map((q) => {
    const clone = { ...q };
    delete (clone as { explanation?: string | null }).explanation;
    return clone;
  });
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getQuestionById(id: string) {
  const [item] = await db.select().from(nleQuestionBank).where(eq(nleQuestionBank.id, id));
  if (!item) throw new NotFoundError("NLE Question");
  const options = await db.select().from(nleQuestionOptions).where(eq(nleQuestionOptions.questionId, id)).orderBy(nleQuestionOptions.order);
  return { ...item, options };
}

export async function createQuestion(data: {
  categoryId: string;
  questionText: string;
  questionType?: string;
  difficulty?: string;
  explanation?: string;
  isHighYield?: boolean;
  tags?: string[];
  options: { optionText: string; isCorrect: boolean }[];
  createdBy?: string;
}) {
  const questionText = data.questionText.trim();
  const [existingStem] = await db
    .select({ id: nleQuestionBank.id })
    .from(nleQuestionBank)
    .where(sql`lower(${nleQuestionBank.questionText}) = lower(${questionText})`)
    .limit(1);
  if (existingStem) throw new ConflictError("A question with this text already exists in the bank");

  const [question] = await db.insert(nleQuestionBank).values({
    categoryId: data.categoryId,
    questionText,
    questionType: data.questionType ?? "MC",
    difficulty: data.difficulty ?? "MEDIUM",
    explanation: data.explanation ?? null,
    isHighYield: data.isHighYield ?? false,
    tags: data.tags ?? null,
    createdBy: data.createdBy ?? null,
  }).returning();

  const optionsWithQuestionId = data.options.map((opt, idx) => ({
    questionId: question.id,
    optionText: opt.optionText,
    isCorrect: opt.isCorrect,
    order: idx,
  }));

  await db.insert(nleQuestionOptions).values(optionsWithQuestionId);

  await logAudit({ action: "CREATE", resource: "nle_question", resourceId: question.id, metadata: { categoryId: data.categoryId } });

  return { ...question, options: optionsWithQuestionId };
}

export async function updateQuestion(id: string, data: Record<string, unknown>) {
  const [existing] = await db.select().from(nleQuestionBank).where(eq(nleQuestionBank.id, id));
  if (!existing) throw new NotFoundError("NLE Question");

  // Prevent renaming to text used by another question (case-insensitive)
  if (typeof data.questionText === "string") {
    const questionText = data.questionText.trim();
    if (questionText.toLowerCase() !== existing.questionText.toLowerCase()) {
      const [conflict] = await db
        .select({ id: nleQuestionBank.id })
        .from(nleQuestionBank)
        .where(sql`lower(${nleQuestionBank.questionText}) = lower(${questionText}) and ${nleQuestionBank.id} != ${id}`)
        .limit(1);
      if (conflict) throw new ConflictError("A question with this text already exists in the bank");
    }
    data.questionText = questionText;
  }

  const { options, ...questionFields } = data;
  const [item] = await db.update(nleQuestionBank).set({ ...questionFields, updatedAt: new Date() }).where(eq(nleQuestionBank.id, id)).returning();

  // Replace options wholesale when provided (schema guarantees ≥2 and one correct)
  if (Array.isArray(options)) {
    await db.delete(nleQuestionOptions).where(eq(nleQuestionOptions.questionId, id));
    await db.insert(nleQuestionOptions).values(
      options.map((o: { optionText: string; isCorrect?: boolean }, idx: number) => ({
        questionId: id,
        optionText: o.optionText,
        isCorrect: o.isCorrect ?? false,
        order: idx,
      }))
    );
  }

  await logAudit({ action: "UPDATE", resource: "nle_question", resourceId: item.id, metadata: { optionsReplaced: Array.isArray(options) } });

  return item;
}

export async function deleteQuestion(id: string, user: { userId: string; role: string }) {
  const [existing] = await db.select().from(nleQuestionBank).where(eq(nleQuestionBank.id, id));
  if (!existing) throw new NotFoundError("NLE Question");
  // Admins can delete anything; other managers only questions they created
  if (user.role !== "ADMIN" && existing.createdBy !== user.userId) {
    throw new ForbiddenError("You can only delete questions you created");
  }
  await db.delete(nleQuestionBank).where(eq(nleQuestionBank.id, id));

  await logAudit({ action: "DELETE", resource: "nle_question", resourceId: id, metadata: { deletedBy: user.userId } });
}

// ─── Bulk Import ───────────────────────────────────────────────────────────

export async function bulkImportQuestions(questions: Array<{
  categoryId: string;
  questionText: string;
  questionType?: string;
  difficulty?: string;
  explanation?: string;
  isHighYield?: boolean;
  tags?: string[];
  options: { optionText: string; isCorrect: boolean }[];
}>, createdBy?: string) {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const q of questions) {
    try {
      // Validate category exists
      const [cat] = await db.select().from(nleCategories).where(eq(nleCategories.id, q.categoryId));
      if (!cat) {
        errors.push(`Category not found: ${q.categoryId}`);
        skipped++;
        continue;
      }

      // Check for duplicate question text anywhere in the bank (case-insensitive)
      const [existing] = await db.select({ id: nleQuestionBank.id }).from(nleQuestionBank).where(
        sql`lower(${nleQuestionBank.questionText}) = lower(${q.questionText})`
      ).limit(1);
      if (existing) {
        skipped++;
        continue;
      }

      const [question] = await db.insert(nleQuestionBank).values({
        categoryId: q.categoryId,
        questionText: q.questionText,
        questionType: q.questionType ?? "MC",
        difficulty: q.difficulty ?? "MEDIUM",
        explanation: q.explanation ?? null,
        isHighYield: q.isHighYield ?? false,
        tags: q.tags ?? null,
        isActive: true,
        createdBy: createdBy ?? null,
      }).returning();

      const optionsWithQuestionId = q.options.map((opt, idx) => ({
        questionId: question.id,
        optionText: opt.optionText,
        isCorrect: opt.isCorrect,
        order: idx,
      }));

      await db.insert(nleQuestionOptions).values(optionsWithQuestionId);
      imported++;
    } catch (err) {
      errors.push(`Failed to import question: ${(err as Error).message}`);
      skipped++;
    }
  }

  await logAudit({ action: "BULK_IMPORT", resource: "nle_question", metadata: { imported, skipped, totalErrors: errors.length } });

  return { imported, skipped, errors: errors.slice(0, 50) }; // Limit error messages
}

// ─── AI Question Generation from Content ───────────────────────────────────

import { generateQuestions as geminiGenerateQuestions, analyzeDocument } from "../../services/gemini.service.js";

export async function generateQuestionsFromContent(
  content: string,
  options: {
    categoryId: string;
    count: number;
    difficulty?: "EASY" | "MEDIUM" | "HARD";
    highYieldPercent?: number;
  },
  createdBy?: string
) {
  const { categoryId, count, difficulty, highYieldPercent = 20 } = options;

  // Validate category
  const [cat] = await db.select().from(nleCategories).where(eq(nleCategories.id, categoryId));
  if (!cat) throw new NotFoundError("NLE Category");

  // Generate questions using Gemini
  const generated = await geminiGenerateQuestions(content, {
    count,
    difficulty,
    types: ["MULTIPLE_CHOICE"],
  });

  let imported = 0;
  const errors: string[] = [];

  for (const g of generated) {
    try {
      const isHighYield = Math.random() * 100 < highYieldPercent;

      // Skip generated questions that already exist in the bank
      const [existingStem] = await db
        .select({ id: nleQuestionBank.id })
        .from(nleQuestionBank)
        .where(sql`lower(${nleQuestionBank.questionText}) = lower(${g.stem})`)
        .limit(1);
      if (existingStem) {
        continue;
      }

      const [question] = await db.insert(nleQuestionBank).values({
        categoryId,
        questionText: g.stem,
        questionType: g.type === "TRUE_FALSE" ? "TF" : "MC",
        difficulty: g.difficulty ?? difficulty ?? "MEDIUM",
        explanation: g.explanation || g.rationale || null,
        isHighYield,
        tags: g.category ? [g.category] : null,
        isActive: true,
        createdBy: createdBy ?? null,
      }).returning();

      await db.insert(nleQuestionOptions).values(
        g.options.map((opt, idx) => ({
          questionId: question.id,
          optionText: opt.optionText,
          isCorrect: opt.isCorrect,
          order: idx,
        }))
      );

      imported++;
    } catch (err) {
      errors.push(`Failed to save generated question: ${(err as Error).message}`);
    }
  }

  await logAudit({
    action: "AI_GENERATE",
    resource: "nle_question",
    metadata: { categoryId, count, imported, errors: errors.length },
  });

  return { imported, total: generated.length, errors: errors.slice(0, 20) };
}

export async function generateQuestionsFromFile(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
  options: {
    categoryId: string;
    count: number;
    difficulty?: "EASY" | "MEDIUM" | "HARD";
    highYieldPercent?: number;
  },
  createdBy?: string
) {
  // First analyze the document to extract content
  const analysis = await analyzeDocument(fileBuffer, mimeType, fileName);

  // Use extracted content to generate questions
  return generateQuestionsFromContent(
    analysis.rawContent || analysis.summary,
    options,
    createdBy
  );
}

// ─── Question Stats ────────────────────────────────────────────────────────

export async function getQuestionStats() {
  const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(nleQuestionBank);
  const [active] = await db.select({ count: sql<number>`count(*)::int` }).from(nleQuestionBank).where(eq(nleQuestionBank.isActive, true));
  const [highYield] = await db.select({ count: sql<number>`count(*)::int` }).from(nleQuestionBank).where(eq(nleQuestionBank.isHighYield, true));

  const byDifficulty = await db
    .select({ difficulty: nleQuestionBank.difficulty, count: sql<number>`count(*)::int` })
    .from(nleQuestionBank)
    .groupBy(nleQuestionBank.difficulty);

  const byCategory = await db
    .select({ categoryId: nleQuestionBank.categoryId, count: sql<number>`count(*)::int` })
    .from(nleQuestionBank)
    .groupBy(nleQuestionBank.categoryId);

  return {
    total: total.count,
    active: active.count,
    highYield: highYield.count,
    byDifficulty,
    byCategory,
  };
}

// ─── AI Question Suggestion (single random question) ───────────────────────

export async function suggestQuestion(categoryId: string) {
  const [cat] = await db.select().from(nleCategories).where(eq(nleCategories.id, categoryId));
  if (!cat) throw new NotFoundError("NLE Category");

  const content = `NLE board exam review category: ${cat.name} (code: ${cat.code}).${cat.description ? ` Description: ${cat.description}` : ""}`;

  const generated = await geminiGenerateQuestions(content, {
    count: 1,
    types: ["MULTIPLE_CHOICE"],
  });

  const g = generated[0];
  if (!g) throw new Error("AI returned no question. Please try again.");

  return {
    categoryId,
    questionText: g.stem,
    questionType: g.type === "TRUE_FALSE" ? "TF" : "MC",
    difficulty: g.difficulty ?? "MEDIUM",
    explanation: g.explanation || g.rationale || "",
    isHighYield: false,
    options: g.options.map((o) => ({ optionText: o.optionText, isCorrect: o.isCorrect })),
  };
}

// ─── Practice ────────────────────────────────────────────────────────────────

export async function getPracticeQuestions(query: { categoryId?: string; difficulty?: string; count: number; highYieldOnly: boolean }) {
  const { categoryId, difficulty, count, highYieldOnly } = query;
  const conditions: ReturnType<typeof sql>[] = [eq(nleQuestionBank.isActive, true)];
  if (categoryId) conditions.push(eq(nleQuestionBank.categoryId, categoryId));
  if (difficulty) conditions.push(eq(nleQuestionBank.difficulty, difficulty));
  if (highYieldOnly) conditions.push(eq(nleQuestionBank.isHighYield, true));
  const where = and(...conditions);
  const questions = await db.select().from(nleQuestionBank).where(where).orderBy(sql`random()`).limit(count);
  const questionsWithOptions = await Promise.all(
    questions.map(async (q) => {
      const options = await db.select().from(nleQuestionOptions).where(eq(nleQuestionOptions.questionId, q.id)).orderBy(nleQuestionOptions.order);
      // Strip the answer-bearing fields — grading happens via POST /practice/check
      const clone = { ...q };
      delete (clone as { explanation?: string | null }).explanation;
      return {
        ...clone,
        options: options.map((o) => ({ id: o.id, optionText: o.optionText, order: o.order })),
      };
    })
  );
  return questionsWithOptions;
}

// ─── Practice grading ────────────────────────────────────────────────────────

export async function checkPracticeAnswers(answers: { questionId: string; selectedOptionId?: string }[]) {
  const results: {
    questionId: string; isCorrect: boolean;
    correctOptionId: string | null; correctOptionText: string | null; explanation: string | null;
  }[] = [];
  let correctCount = 0;

  for (const answer of answers) {
    const [question] = await db.select().from(nleQuestionBank).where(eq(nleQuestionBank.id, answer.questionId));
    const options = await db.select().from(nleQuestionOptions).where(eq(nleQuestionOptions.questionId, answer.questionId)).orderBy(nleQuestionOptions.order);
    const correct = options.find((o) => o.isCorrect) ?? null;
    const isCorrect = !!(answer.selectedOptionId && correct && correct.id === answer.selectedOptionId);
    if (isCorrect) correctCount++;
    results.push({
      questionId: answer.questionId,
      isCorrect,
      correctOptionId: correct?.id ?? null,
      correctOptionText: correct?.optionText ?? null,
      explanation: question?.explanation ?? null,
    });
  }

  const total = answers.length;
  return {
    total,
    correctCount,
    score: total > 0 ? Math.round((correctCount / total) * 100) : 0,
    results,
  };
}

// ─── Exams ───────────────────────────────────────────────────────────────────

export async function listExams(query: { examType?: string; page: number; limit: number }) {
  const { examType, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (examType) conditions.push(eq(nleExams.examType, examType));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(nleExams).where(where);
  const items = await db.select().from(nleExams).where(where).orderBy(desc(nleExams.createdAt)).limit(limit).offset(offset);
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getExamById(id: string) {
  const [item] = await db.select().from(nleExams).where(eq(nleExams.id, id));
  if (!item) throw new NotFoundError("NLE Exam");
  return item;
}

export async function createExam(data: {
  title: string;
  description?: string;
  examType?: string;
  categoryFilter?: string[];
  questionCount?: number;
  timeLimitMinutes?: number;
  passingScore?: number;
  isRandomized?: boolean;
  showExplanations?: boolean;
  createdBy?: string;
}) {
  const [item] = await db.insert(nleExams).values({
    title: data.title,
    description: data.description ?? null,
    examType: data.examType ?? "PRACTICE",
    categoryFilter: data.categoryFilter ?? null,
    questionCount: data.questionCount ?? 50,
    timeLimitMinutes: data.timeLimitMinutes ?? 90,
    passingScore: data.passingScore ?? 75,
    isRandomized: data.isRandomized ?? true,
    showExplanations: data.showExplanations ?? true,
    createdBy: data.createdBy ?? null,
  }).returning();

  await logAudit({ action: "CREATE", resource: "nle_exam", resourceId: item.id, metadata: { title: data.title, examType: data.examType } });

  return item;
}

export async function updateExam(id: string, data: Record<string, unknown>) {
  const [existing] = await db.select().from(nleExams).where(eq(nleExams.id, id));
  if (!existing) throw new NotFoundError("NLE Exam");
  const [item] = await db.update(nleExams).set({ ...data, updatedAt: new Date() }).where(eq(nleExams.id, id)).returning();

  await logAudit({ action: "UPDATE", resource: "nle_exam", resourceId: item.id });

  return item;
}

// ─── Exam Attempts ───────────────────────────────────────────────────────────

export async function startExam(studentId: string, examId: string) {
  const [exam] = await db.select().from(nleExams).where(eq(nleExams.id, examId));
  if (!exam) throw new NotFoundError("NLE Exam");

  const existingAttempt = await db.select().from(nleExamAttempts).where(
    and(eq(nleExamAttempts.examId, examId), eq(nleExamAttempts.studentId, studentId), eq(nleExamAttempts.status, "IN_PROGRESS"))
  );
  if (existingAttempt.length > 0) throw new ForbiddenError("Exam already in progress");

  const conditions: ReturnType<typeof sql>[] = [eq(nleQuestionBank.isActive, true)];
  if (exam.categoryFilter && Array.isArray(exam.categoryFilter)) {
    conditions.push(inArray(nleQuestionBank.categoryId, exam.categoryFilter as string[]));
  }

  const questions = await db.select().from(nleQuestionBank).where(and(...conditions)).orderBy(sql`random()`).limit(exam.questionCount);
  if (questions.length === 0) throw new ConflictError("Exam has no questions available");

  const [attempt] = await db.insert(nleExamAttempts).values({
    examId,
    studentId,
    totalQuestions: questions.length,
    status: "IN_PROGRESS",
    questionIds: questions.map((q) => q.id),
  }).returning();

  await logAudit({ action: "CREATE", resource: "nle_exam_attempt", resourceId: attempt.id, metadata: { examId, studentId } });

  const questionsWithOptions = await Promise.all(
    questions.map(async (q) => {
      const options = await db.select().from(nleQuestionOptions).where(eq(nleQuestionOptions.questionId, q.id)).orderBy(nleQuestionOptions.order);
      // Never send correct flags/explanations during an attempt — server grades on submit
      const clone = { ...q };
      delete (clone as { explanation?: string | null }).explanation;
      return {
        ...clone,
        options: options.map((o) => ({ id: o.id, optionText: o.optionText, order: o.order })),
      };
    })
  );

  return { attempt, questions: questionsWithOptions };
}

export async function submitExamAttempt(studentId: string, attemptId: string, answers: { questionId: string; selectedOptionId?: string; timeSpentSeconds?: number }[]) {
  const [attempt] = await db.select().from(nleExamAttempts).where(eq(nleExamAttempts.id, attemptId));
  if (!attempt) throw new NotFoundError("Exam Attempt");
  if (attempt.studentId !== studentId) throw new ForbiddenError("Not your attempt");
  if (attempt.status !== "IN_PROGRESS") throw new ForbiddenError("Attempt already submitted");

  let correctCount = 0;
  for (const answer of answers) {
    let isCorrect = false;
    if (answer.selectedOptionId) {
      const [option] = await db.select().from(nleQuestionOptions).where(eq(nleQuestionOptions.id, answer.selectedOptionId));
      if (option?.isCorrect) {
        isCorrect = true;
        correctCount++;
      }
    }
    await db.insert(nleAttemptAnswers).values({
      attemptId,
      questionId: answer.questionId,
      selectedOptionId: answer.selectedOptionId ?? null,
      isCorrect,
      timeSpentSeconds: answer.timeSpentSeconds ?? null,
    });
  }

  const score = attempt.totalQuestions > 0 ? Math.round((correctCount / attempt.totalQuestions) * 100) : 0;
  const now = new Date();
  const timeSpentSeconds = attempt.startedAt ? Math.floor((now.getTime() - attempt.startedAt.getTime()) / 1000) : null;

  const [updated] = await db.update(nleExamAttempts).set({
    score,
    correctAnswers: correctCount,
    timeSpentSeconds,
    completedAt: now,
    status: "COMPLETED",
  }).where(eq(nleExamAttempts.id, attemptId)).returning();

  await updatePerformanceAnalytics(studentId, answers);

  await logAudit({ action: "UPDATE", resource: "nle_exam_attempt", resourceId: updated.id, metadata: { studentId, score, correctAnswers: correctCount } });

  return updated;
}

export async function getAttemptById(id: string) {
  const [attempt] = await db.select().from(nleExamAttempts).where(eq(nleExamAttempts.id, id));
  if (!attempt) throw new NotFoundError("Exam Attempt");

  const answers = await db.select().from(nleAttemptAnswers).where(eq(nleAttemptAnswers.attemptId, id));
  const inProgress = attempt.status === "IN_PROGRESS";

  // Question set: stored at start (resume path) or derived from graded answers (legacy attempts)
  const storedIds = Array.isArray(attempt.questionIds) ? attempt.questionIds : [];
  const questionIds = [...new Set(storedIds.length > 0 ? storedIds : answers.map((a) => a.questionId))];

  // Explanations are only revealed after completion, and only if the exam allows it
  let showExplanations = false;
  if (!inProgress) {
    const [exam] = await db.select().from(nleExams).where(eq(nleExams.id, attempt.examId));
    showExplanations = exam?.showExplanations ?? true;
  }

  const questionRows = questionIds.length > 0
    ? await db.select().from(nleQuestionBank).where(inArray(nleQuestionBank.id, questionIds))
    : [];
  const optionRows = questionIds.length > 0
    ? await db.select().from(nleQuestionOptions).where(inArray(nleQuestionOptions.questionId, questionIds))
    : [];

  const questionById = new Map(questionRows.map((q) => [q.id, q]));
  const optionsByQuestion = new Map<string, typeof optionRows>();
  for (const option of optionRows) {
    const group = optionsByQuestion.get(option.questionId) ?? [];
    group.push(option);
    optionsByQuestion.set(option.questionId, group);
  }

  const questions = questionIds
    .map((qid) => {
      const q = questionById.get(qid);
      if (!q) return null;
      const clone: Record<string, unknown> = { ...q };
      if (inProgress || !showExplanations) delete clone.explanation;
      const options = (optionsByQuestion.get(qid) ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((o) =>
          inProgress
            ? { id: o.id, optionText: o.optionText, order: o.order }
            : { id: o.id, optionText: o.optionText, order: o.order, isCorrect: o.isCorrect }
        );
      return { ...clone, options };
    })
    .filter((q): q is NonNullable<typeof q> => q !== null);

  if (inProgress) {
    // An in-progress attempt must never expose the answer key
    return {
      attempt,
      questions,
      answers: answers.map((a) => ({
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId,
        timeSpentSeconds: a.timeSpentSeconds,
      })),
    };
  }

  return { attempt, questions, answers };
}

export async function listAttempts(studentId: string, examId?: string) {
  const conditions: ReturnType<typeof sql>[] = [eq(nleExamAttempts.studentId, studentId)];
  if (examId) conditions.push(eq(nleExamAttempts.examId, examId));
  const items = await db.select().from(nleExamAttempts).where(and(...conditions)).orderBy(desc(nleExamAttempts.startedAt));
  return items;
}

export async function abandonAttempt(studentId: string, attemptId: string) {
  const [attempt] = await db.select().from(nleExamAttempts).where(eq(nleExamAttempts.id, attemptId));
  if (!attempt) throw new NotFoundError("Exam Attempt");
  if (attempt.studentId !== studentId) throw new ForbiddenError("Not your attempt");
  if (attempt.status !== "IN_PROGRESS") throw new ForbiddenError("Only an in-progress attempt can be discarded");

  // Answers only exist once an attempt is submitted; the FK cascade removes any stragglers
  await db.delete(nleExamAttempts).where(eq(nleExamAttempts.id, attemptId));

  await logAudit({ action: "DELETE", resource: "nle_exam_attempt", resourceId: attemptId, metadata: { examId: attempt.examId } });
}

// ─── Performance Analytics ───────────────────────────────────────────────────

export async function updatePerformanceAnalytics(studentId: string, answers: { questionId: string; selectedOptionId?: string }[]) {
  for (const answer of answers) {
    const [question] = await db.select().from(nleQuestionBank).where(eq(nleQuestionBank.id, answer.questionId));
    if (!question) continue;

    let isCorrect = false;
    if (answer.selectedOptionId) {
      const [option] = await db.select().from(nleQuestionOptions).where(eq(nleQuestionOptions.id, answer.selectedOptionId));
      if (option?.isCorrect) isCorrect = true;
    }

    const [existing] = await db.select().from(nlePerformanceAnalytics).where(
      and(eq(nlePerformanceAnalytics.studentId, studentId), eq(nlePerformanceAnalytics.categoryId, question.categoryId))
    );

    if (existing) {
      const totalAttempts = existing.totalAttempts + 1;
      const correctAnswers = existing.correctAnswers + (isCorrect ? 1 : 0);
      const averageScore = Math.round((correctAnswers / totalAttempts) * 100);
      const strengthLevel = averageScore >= 80 ? "STRONG" : averageScore >= 60 ? "MODERATE" : "WEAK";

      await db.update(nlePerformanceAnalytics).set({
        totalAttempts,
        correctAnswers,
        averageScore,
        bestScore: Math.max(existing.bestScore ?? 0, averageScore),
        lastAttemptAt: new Date(),
        strengthLevel,
        updatedAt: new Date(),
      }).where(eq(nlePerformanceAnalytics.id, existing.id));

      await logAudit({ action: "UPDATE", resource: "nle_performance_analytics", resourceId: existing.id, metadata: { studentId, categoryId: question.categoryId, averageScore } });
    } else {
      const isCorrectVal = isCorrect ? 1 : 0;
      const averageScore = isCorrect ? 100 : 0;
      const strengthLevel = isCorrect ? "STRONG" : "WEAK";
      await db.insert(nlePerformanceAnalytics).values({
        studentId,
        categoryId: question.categoryId,
        totalAttempts: 1,
        correctAnswers: isCorrectVal,
        averageScore,
        bestScore: averageScore,
        lastAttemptAt: new Date(),
        strengthLevel,
      });

      await logAudit({ action: "CREATE", resource: "nle_performance_analytics", metadata: { studentId, categoryId: question.categoryId, averageScore } });
    }
  }
}

export async function getStudentPerformance(studentId: string) {
  const items = await db.select().from(nlePerformanceAnalytics).where(eq(nlePerformanceAnalytics.studentId, studentId)).orderBy(desc(nlePerformanceAnalytics.averageScore));
  return items;
}

export async function getTopicWeaknessAnalysis(studentId: string) {
  const items = await db.select().from(nlePerformanceAnalytics).where(
    and(eq(nlePerformanceAnalytics.studentId, studentId), eq(nlePerformanceAnalytics.strengthLevel, "WEAK"))
  ).orderBy(nlePerformanceAnalytics.averageScore);
  return items;
}
