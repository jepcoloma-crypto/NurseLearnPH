import { eq, and, desc, sql, count, inArray } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  users,
  courses,
  courseEnrollments,
  questions,
  questionOptions,
  assessments,
  assessmentQuestions,
  assessmentAttempts,
  attemptAnswers,
  clinicalCases,
  caseAttempts,
  caseResponses,
  skills,
  studentSkills,
  auditLogs,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";

const logger = createChildLogger("assessment-service");

// ─── Questions ───────────────────────────────────────────────────────────────

export async function listQuestions(query: {
  courseId?: string;
  topicId?: string;
  type?: string;
  difficulty?: string;
  isActive?: boolean;
  instructorId?: string;
  page: number;
  limit: number;
}) {
  const { courseId, topicId, type, difficulty, isActive, instructorId, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (courseId) conditions.push(eq(questions.courseId, courseId));
  if (topicId) conditions.push(eq(questions.topicId, topicId));
  if (type) conditions.push(eq(questions.type, type as "MC" | "TF" | "ESSAY" | "FILL_BLANK" | "SCENARIO"));
  if (difficulty) conditions.push(eq(questions.difficulty, difficulty as "EASY" | "MEDIUM" | "HARD"));
  if (isActive !== undefined) conditions.push(eq(questions.isActive, isActive));
  if (instructorId) conditions.push(eq(courses.instructorId, instructorId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const countQuery = instructorId
    ? db.select({ count: sql<number>`count(*)::int` }).from(questions).innerJoin(courses, eq(questions.courseId, courses.id)).where(where)
    : db.select({ count: sql<number>`count(*)::int` }).from(questions).where(where);
  const [countResult] = await countQuery;

  const itemsQuery = instructorId
    ? db.select().from(questions).innerJoin(courses, eq(questions.courseId, courses.id)).where(where).orderBy(desc(questions.createdAt)).limit(limit).offset(offset)
    : db.select().from(questions).where(where).orderBy(desc(questions.createdAt)).limit(limit).offset(offset);
  const rawItems = await itemsQuery;
  // When joined, rows are { questions: {...}, courses: {...} }; flatten to just questions data
  const items = instructorId ? (rawItems as any[]).map((row) => row.questions) : rawItems;

  const itemsWithOptions = await Promise.all(
    items.map(async (q) => {
      const options = await db.select().from(questionOptions).where(eq(questionOptions.questionId, q.id)).orderBy(questionOptions.order);
      return { ...q, options };
    })
  );

  return {
    items: itemsWithOptions,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getQuestionById(id: string) {
  const [item] = await db.select().from(questions).where(eq(questions.id, id));
  if (!item) throw new NotFoundError("Question");

  const options = await db.select().from(questionOptions).where(eq(questionOptions.questionId, id)).orderBy(questionOptions.order);
  return { ...item, options };
}

export async function createQuestion(
  data: {
    courseId: string;
    topicId?: string;
    type: string;
    difficulty?: string;
    stem: string;
    explanation?: string;
    points?: number;
    options?: Array<{ text: string; isCorrect: boolean; order?: number }>;
  },
  createdBy?: string
) {
  const stem = data.stem.trim();
  const [existingStem] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(sql`lower(${questions.stem}) = lower(${stem}) and ${questions.courseId} = ${data.courseId}`)
    .limit(1);
  if (existingStem) throw new ConflictError(`A question with this stem already exists in this course`);

  const [question] = await db
    .insert(questions)
    .values({
      courseId: data.courseId,
      topicId: data.topicId ?? null,
      type: data.type as "MC" | "TF" | "ESSAY" | "FILL_BLANK" | "SCENARIO",
      difficulty: (data.difficulty as "EASY" | "MEDIUM" | "HARD") ?? "MEDIUM",
      stem,
      explanation: data.explanation ?? null,
      points: data.points ?? 1,
      createdBy: createdBy ?? null,
    })
    .returning();

  if (data.options && data.options.length > 0) {
    await db.insert(questionOptions).values(
      data.options.map((opt, idx) => ({
        questionId: question.id,
        text: opt.text,
        isCorrect: opt.isCorrect,
        order: opt.order ?? idx,
      }))
    );
  }

  await logAudit({ userId: createdBy, action: "CREATE_QUESTION", resource: "QUESTION", resourceId: question.id });
  return getQuestionById(question.id);
}

export async function updateQuestion(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(questions).where(eq(questions.id, id));
  if (!existing) throw new NotFoundError("Question");

  // Prevent renaming to a stem used by another question in the same course
  if (typeof data.stem === "string") {
    const stem = data.stem.trim();
    if (stem.toLowerCase() !== existing.stem.toLowerCase()) {
      const [conflict] = await db
        .select({ id: questions.id })
        .from(questions)
        .where(
          sql`lower(${questions.stem}) = lower(${stem}) and ${questions.courseId} = ${existing.courseId} and ${questions.id} != ${id}`
        )
        .limit(1);
      if (conflict) throw new ConflictError(`A question with this stem already exists in this course`);
    }
    data.stem = stem;
  }

  const [item] = await db.update(questions).set({ ...data, updatedAt: new Date() }).where(eq(questions.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_QUESTION", resource: "QUESTION", resourceId: id });
  return item;
}

export async function deleteQuestion(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(questions).where(eq(questions.id, id));
  if (!existing) throw new NotFoundError("Question");

  await db.delete(questionOptions).where(eq(questionOptions.questionId, id));
  await db.delete(assessmentQuestions).where(eq(assessmentQuestions.questionId, id));
  await db.delete(questions).where(eq(questions.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_QUESTION", resource: "QUESTION", resourceId: id });
}

export async function toggleQuestionStatus(id: string, toggledBy?: string) {
  const [existing] = await db.select().from(questions).where(eq(questions.id, id));
  if (!existing) throw new NotFoundError("Question");

  const newStatus = !existing.isActive;
  await db.update(questions).set({ isActive: newStatus, updatedAt: new Date() }).where(eq(questions.id, id));
  await logAudit({ userId: toggledBy, action: "TOGGLE_QUESTION_STATUS", resource: "QUESTION", resourceId: id });
  return { ...existing, isActive: newStatus };
}

// ─── Assessments ─────────────────────────────────────────────────────────────

export async function listAssessments(query: { courseId?: string; instructorId?: string; publishedOnly?: boolean; studentId?: string; page: number; limit: number }) {
  const { courseId, instructorId, publishedOnly, studentId, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (courseId) conditions.push(eq(assessments.courseId, courseId));
  if (instructorId) conditions.push(eq(courses.instructorId, instructorId));
  if (publishedOnly) conditions.push(eq(assessments.isPublished, true));

  if (studentId) {
    const enrollments = await db
      .select({ courseId: courseEnrollments.courseId })
      .from(courseEnrollments)
      .where(and(eq(courseEnrollments.studentId, studentId), eq(courseEnrollments.isActive, true)));
    const enrolledCourseIds = enrollments.map((e) => e.courseId);
    if (enrolledCourseIds.length === 0) {
      return {
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }
    conditions.push(inArray(assessments.courseId, enrolledCourseIds));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const countQuery = instructorId
    ? db.select({ count: sql<number>`count(*)::int` }).from(assessments).innerJoin(courses, eq(assessments.courseId, courses.id)).where(where)
    : db.select({ count: sql<number>`count(*)::int` }).from(assessments).where(where);
  const [countResult] = await countQuery;

  const itemsQuery = instructorId
    ? db.select({
        id: assessments.id,
        courseId: assessments.courseId,
        title: assessments.title,
        description: assessments.description,
        type: assessments.type,
        timeLimitMinutes: assessments.timeLimitMinutes,
        passingScore: assessments.passingScore,
        maxAttempts: assessments.maxAttempts,
        isPublished: assessments.isPublished,
        createdBy: assessments.createdBy,
        createdAt: assessments.createdAt,
        updatedAt: assessments.updatedAt,
      }).from(assessments).innerJoin(courses, eq(assessments.courseId, courses.id)).where(where).orderBy(desc(assessments.createdAt)).limit(limit).offset(offset)
    : db.select().from(assessments).where(where).orderBy(desc(assessments.createdAt)).limit(limit).offset(offset);
  const items = await itemsQuery;
  return {
    items,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getAssessmentById(id: string, studentId?: string) {
  const [item] = await db.select().from(assessments).where(eq(assessments.id, id));
  if (!item) throw new NotFoundError("Assessment");

  if (studentId) {
    const [enrollment] = await db
      .select()
      .from(courseEnrollments)
      .where(and(
        eq(courseEnrollments.studentId, studentId),
        eq(courseEnrollments.courseId, item.courseId),
        eq(courseEnrollments.isActive, true),
      ));
    if (!enrollment) throw new ForbiddenError("You are not enrolled in this course");
  }

  const questionsList = await db
    .select({ questionId: assessmentQuestions.questionId, order: assessmentQuestions.order, points: assessmentQuestions.points })
    .from(assessmentQuestions)
    .where(eq(assessmentQuestions.assessmentId, id))
    .orderBy(assessmentQuestions.order);

  return { ...item, questions: questionsList };
}

export async function createAssessment(
  data: {
    courseId: string;
    title: string;
    description?: string;
    type?: string;
    timeLimitMinutes?: number | null;
    passingScore?: number;
    maxAttempts?: number;
    questionIds?: string[];
  },
  createdBy?: string
) {
  const [assessment] = await db
    .insert(assessments)
    .values({
      courseId: data.courseId,
      title: data.title,
      description: data.description ?? null,
      type: (data.type as "QUIZ" | "EXAM" | "ASSIGNMENT") ?? "QUIZ",
      timeLimitMinutes: data.timeLimitMinutes ?? null,
      passingScore: data.passingScore ?? 75,
      maxAttempts: data.maxAttempts ?? 1,
      createdBy: createdBy ?? null,
    })
    .returning();

  if (data.questionIds && data.questionIds.length > 0) {
    await db.insert(assessmentQuestions).values(
      data.questionIds.map((qId, idx) => ({
        assessmentId: assessment.id,
        questionId: qId,
        order: idx,
        points: 1,
      }))
    );
  }

  await logAudit({ userId: createdBy, action: "CREATE_ASSESSMENT", resource: "ASSESSMENT", resourceId: assessment.id });
  return assessment;
}

export async function updateAssessment(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(assessments).where(eq(assessments.id, id));
  if (!existing) throw new NotFoundError("Assessment");

  const [item] = await db.update(assessments).set({ ...data, updatedAt: new Date() }).where(eq(assessments.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_ASSESSMENT", resource: "ASSESSMENT", resourceId: id });
  return item;
}

export async function deleteAssessment(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(assessments).where(eq(assessments.id, id));
  if (!existing) throw new NotFoundError("Assessment");

  await db.delete(assessments).where(eq(assessments.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_ASSESSMENT", resource: "ASSESSMENT", resourceId: id });
}

// ─── Attempts ────────────────────────────────────────────────────────────────

export async function startAttempt(assessmentId: string, studentId: string) {
  const [assessment] = await db.select().from(assessments).where(eq(assessments.id, assessmentId));
  if (!assessment) throw new NotFoundError("Assessment");
  if (!assessment.isPublished) throw new ForbiddenError("Assessment is not published");

  const [enrollment] = await db
    .select()
    .from(courseEnrollments)
    .where(and(
      eq(courseEnrollments.studentId, studentId),
      eq(courseEnrollments.courseId, assessment.courseId),
      eq(courseEnrollments.isActive, true),
    ));
  if (!enrollment) throw new ForbiddenError("You are not enrolled in this course");

  const [existingInProgress] = await db
    .select()
    .from(assessmentAttempts)
    .where(and(
      eq(assessmentAttempts.assessmentId, assessmentId),
      eq(assessmentAttempts.studentId, studentId),
      eq(assessmentAttempts.status, "IN_PROGRESS"),
    ));

  if (existingInProgress) {
    if (assessment.timeLimitMinutes && existingInProgress.startedAt) {
      const elapsed = Math.floor((Date.now() - existingInProgress.startedAt.getTime()) / 1000);
      const totalSeconds = assessment.timeLimitMinutes * 60;
      if (elapsed > totalSeconds + 300) {
        await db
          .update(assessmentAttempts)
          .set({ status: "SUBMITTED", submittedAt: new Date(), timeSpentSeconds: Math.min(elapsed, totalSeconds), updatedAt: new Date() })
          .where(eq(assessmentAttempts.id, existingInProgress.id));
        await logAudit({ userId: studentId, action: "AUTO_SUBMIT_EXPIRED", resource: "ASSESSMENT_ATTEMPT", resourceId: existingInProgress.id });
      } else {
        return existingInProgress;
      }
    } else {
      return existingInProgress;
    }
  }

  const [attemptCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assessmentAttempts)
    .where(and(
      eq(assessmentAttempts.assessmentId, assessmentId),
      eq(assessmentAttempts.studentId, studentId),
      sql`status IN ('SUBMITTED', 'GRADED')`,
    ));

  if (attemptCount.count >= assessment.maxAttempts) {
    throw new ForbiddenError("Maximum attempts reached");
  }

  const [attempt] = await db
    .insert(assessmentAttempts)
    .values({ assessmentId, studentId, status: "IN_PROGRESS" })
    .returning();

  await logAudit({ userId: studentId, action: "START_ATTEMPT", resource: "ASSESSMENT_ATTEMPT", resourceId: attempt.id });
  return attempt;
}

export async function getAttemptWithQuestions(attemptId: string, studentId: string) {
  const [attempt] = await db.select().from(assessmentAttempts).where(eq(assessmentAttempts.id, attemptId));
  if (!attempt) throw new NotFoundError("Attempt");
  if (attempt.studentId !== studentId) throw new ForbiddenError("Not your attempt");

  const [assessment] = await db.select().from(assessments).where(eq(assessments.id, attempt.assessmentId));

  const questionLinks = await db
    .select()
    .from(assessmentQuestions)
    .where(eq(assessmentQuestions.assessmentId, attempt.assessmentId))
    .orderBy(assessmentQuestions.order);

  const questionsWithDetails = await Promise.all(
    questionLinks.map(async (ql) => {
      const [question] = await db.select().from(questions).where(eq(questions.id, ql.questionId));
      const options = await db.select().from(questionOptions).where(eq(questionOptions.questionId, ql.questionId)).orderBy(questionOptions.order);
      const safeOptions = options.map(({ isCorrect: _isCorrect, ...rest }) => rest);
      return { ...ql, question: { ...question, options: safeOptions } };
    })
  );

  const seed = attemptId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const shuffled = [...questionsWithDetails].sort((a, b) => {
    const hashA = (a.questionId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) + seed) % 1000;
    const hashB = (b.questionId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) + seed) % 1000;
    return hashA - hashB;
  });

  return { ...attempt, assessment, questions: shuffled };
}

export async function submitAttempt(attemptId: string, studentId: string, answers: Array<{ questionId: string; selectedOptionId?: string | null; textAnswer?: string | null }>) {
  const [attempt] = await db.select().from(assessmentAttempts).where(eq(assessmentAttempts.id, attemptId));
  if (!attempt) throw new NotFoundError("Attempt");
  if (attempt.studentId !== studentId) throw new ForbiddenError("Not your attempt");
  if (attempt.status !== "IN_PROGRESS") throw new ForbiddenError("Attempt already submitted");

  let totalScore = 0;
  let totalPossible = 0;

  for (const answer of answers) {
    const [question] = await db.select().from(questions).where(eq(questions.id, answer.questionId));
    if (!question) continue;

    totalPossible += question.points;

    let isCorrect: boolean | null = false;
    let pointsAwarded = 0;

    if (question.type === "MC" || question.type === "TF") {
      if (answer.selectedOptionId) {
        const [correctOption] = await db
          .select()
          .from(questionOptions)
          .where(and(eq(questionOptions.questionId, answer.questionId), eq(questionOptions.isCorrect, true)));

        if (correctOption && correctOption.id === answer.selectedOptionId) {
          isCorrect = true;
          pointsAwarded = question.points;
        }
      }
    } else {
      isCorrect = null;
      pointsAwarded = 0;
    }

    totalScore += pointsAwarded;

    await db.insert(attemptAnswers).values({
      attemptId,
      questionId: answer.questionId,
      selectedOptionId: answer.selectedOptionId ?? null,
      textAnswer: answer.textAnswer ?? null,
      isCorrect,
      pointsAwarded,
    });
  }

  await db
    .update(assessmentAttempts)
    .set({
      status: "SUBMITTED",
      submittedAt: new Date(),
      score: totalScore,
      timeSpentSeconds: Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000),
      updatedAt: new Date(),
    })
    .where(eq(assessmentAttempts.id, attemptId));

  await logAudit({ userId: studentId, action: "SUBMIT_ATTEMPT", resource: "ASSESSMENT_ATTEMPT", resourceId: attemptId });

  return { attemptId, score: totalScore, totalPossible, percentage: totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0 };
}

export async function getAttemptResult(attemptId: string, studentId: string) {
  const [attempt] = await db.select().from(assessmentAttempts).where(eq(assessmentAttempts.id, attemptId));
  if (!attempt) throw new NotFoundError("Attempt");
  if (attempt.studentId !== studentId) throw new ForbiddenError("Not your attempt");

  const [assessment] = await db.select().from(assessments).where(eq(assessments.id, attempt.assessmentId));

  const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId));

  const answersWithDetails = await Promise.all(
    answers.map(async (answer) => {
      const [question] = await db.select().from(questions).where(eq(questions.id, answer.questionId));
      const options = await db.select().from(questionOptions).where(eq(questionOptions.questionId, answer.questionId)).orderBy(questionOptions.order);
      return { ...answer, question, options };
    })
  );

  const totalPossible = answersWithDetails.reduce((sum, a) => sum + (a.question?.points ?? 0), 0);

  return { ...attempt, assessment, answers: answersWithDetails, totalPossible };
}

export async function getStudentAttempts(studentId: string) {
  const items = await db
    .select({
      id: assessmentAttempts.id,
      assessmentId: assessmentAttempts.assessmentId,
      status: assessmentAttempts.status,
      score: assessmentAttempts.score,
      startedAt: assessmentAttempts.startedAt,
      submittedAt: assessmentAttempts.submittedAt,
      timeSpentSeconds: assessmentAttempts.timeSpentSeconds,
    })
    .from(assessmentAttempts)
    .where(eq(assessmentAttempts.studentId, studentId))
    .orderBy(desc(assessmentAttempts.startedAt));
  return items;
}

// ─── Instructor Grading ─────────────────────────────────────────────────────

export async function gradeAttempt(attemptId: string, gradedBy: string, answers: Array<{ answerId: string; pointsAwarded: number; feedback?: string }>) {
  const [attempt] = await db.select().from(assessmentAttempts).where(eq(assessmentAttempts.id, attemptId));
  if (!attempt) throw new NotFoundError("Attempt");

  let totalScore = 0;

  for (const ans of answers) {
    await db
      .update(attemptAnswers)
      .set({ pointsAwarded: ans.pointsAwarded, feedback: ans.feedback ?? null, updatedAt: new Date() })
      .where(eq(attemptAnswers.id, ans.answerId));

    totalScore += ans.pointsAwarded;
  }

  await db
    .update(assessmentAttempts)
    .set({ status: "GRADED", gradedAt: new Date(), score: totalScore, gradedBy, updatedAt: new Date() })
    .where(eq(assessmentAttempts.id, attemptId));

  await logAudit({ userId: gradedBy, action: "GRADE_ATTEMPT", resource: "ASSESSMENT_ATTEMPT", resourceId: attemptId });

  return { attemptId, score: totalScore };
}

// ─── Gradebook ──────────────────────────────────────────────────────────────

export async function listAttempts(query: {
  assessmentId?: string;
  studentId?: string;
  courseId?: string;
  page: number;
  limit: number;
}) {
  const { assessmentId, studentId, courseId, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (assessmentId) conditions.push(eq(assessmentAttempts.assessmentId, assessmentId));
  if (studentId) conditions.push(eq(assessmentAttempts.studentId, studentId));
  if (courseId) conditions.push(eq(assessments.courseId, courseId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assessmentAttempts)
    .innerJoin(assessments, eq(assessmentAttempts.assessmentId, assessments.id))
    .where(where);

  const items = await db
    .select({
      id: assessmentAttempts.id,
      assessmentId: assessmentAttempts.assessmentId,
      studentId: assessmentAttempts.studentId,
      status: assessmentAttempts.status,
      startedAt: assessmentAttempts.startedAt,
      submittedAt: assessmentAttempts.submittedAt,
      gradedAt: assessmentAttempts.gradedAt,
      score: assessmentAttempts.score,
      timeSpentSeconds: assessmentAttempts.timeSpentSeconds,
      createdAt: assessmentAttempts.createdAt,
      studentFirstName: users.firstName,
      studentLastName: users.lastName,
      studentEmail: users.email,
      assessmentTitle: assessments.title,
      assessmentType: assessments.type,
      assessmentPassingScore: assessments.passingScore,
    })
    .from(assessmentAttempts)
    .innerJoin(assessments, eq(assessmentAttempts.assessmentId, assessments.id))
    .innerJoin(users, eq(assessmentAttempts.studentId, users.id))
    .where(where)
    .orderBy(desc(assessmentAttempts.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getCourseGradebook(courseId: string) {
  const courseAssessments = await db
    .select()
    .from(assessments)
    .where(eq(assessments.courseId, courseId))
    .orderBy(desc(assessments.createdAt));

  const assessmentsWithAttempts = await Promise.all(
    courseAssessments.map(async (assessment) => {
      const attempts = await db
        .select({
          id: assessmentAttempts.id,
          studentId: assessmentAttempts.studentId,
          status: assessmentAttempts.status,
          score: assessmentAttempts.score,
          submittedAt: assessmentAttempts.submittedAt,
          gradedAt: assessmentAttempts.gradedAt,
          studentFirstName: users.firstName,
          studentLastName: users.lastName,
        })
        .from(assessmentAttempts)
        .innerJoin(users, eq(assessmentAttempts.studentId, users.id))
        .where(eq(assessmentAttempts.assessmentId, assessment.id))
        .orderBy(desc(assessmentAttempts.createdAt));

      return { ...assessment, attempts };
    })
  );

  return { courseId, assessments: assessmentsWithAttempts };
}

export async function getFullGradebook(courseId: string) {
  // Get enrolled students
  const enrollments = await db
    .select({
      studentId: courseEnrollments.studentId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(courseEnrollments)
    .innerJoin(users, eq(courseEnrollments.studentId, users.id))
    .where(eq(courseEnrollments.courseId, courseId));

  const studentIds = enrollments.map((e) => e.studentId);

  // 1. Assessment scores
  const courseAssessments = await db.select().from(assessments).where(eq(assessments.courseId, courseId));
  const assessmentData = await Promise.all(
    courseAssessments.map(async (assessment) => {
      const attempts = studentIds.length > 0
        ? await db
            .select({
              studentId: assessmentAttempts.studentId,
              score: assessmentAttempts.score,
              status: assessmentAttempts.status,
              submittedAt: assessmentAttempts.submittedAt,
            })
            .from(assessmentAttempts)
            .where(and(eq(assessmentAttempts.assessmentId, assessment.id), inArray(assessmentAttempts.studentId, studentIds)))
            .orderBy(desc(assessmentAttempts.createdAt))
        : [];
      return { id: assessment.id, title: assessment.title, passingScore: assessment.passingScore, attempts };
    })
  );

  // 2. Clinical case scores
  const courseCases = await db.select().from(clinicalCases).where(eq(clinicalCases.courseId, courseId));
  const caseData = await Promise.all(
    courseCases.map(async (clinicalCase) => {
      const attempts = studentIds.length > 0
        ? await db
            .select({
              studentId: caseAttempts.studentId,
              score: caseAttempts.score,
              totalPoints: caseAttempts.totalPoints,
              status: caseAttempts.status,
              startedAt: caseAttempts.startedAt,
              completedAt: caseAttempts.completedAt,
            })
            .from(caseAttempts)
            .where(and(eq(caseAttempts.caseId, clinicalCase.id), inArray(caseAttempts.studentId, studentIds)))
            .orderBy(desc(caseAttempts.createdAt))
        : [];
      return { id: clinicalCase.id, title: clinicalCase.title, maxAttempts: clinicalCase.maxAttempts, attempts };
    })
  );

  // 3. Skills progress
  const courseSkills = await db.select().from(skills).where(eq(skills.courseId, courseId));
  const skillData = await Promise.all(
    courseSkills.map(async (skill) => {
      const studentSkillsList = studentIds.length > 0
        ? await db
            .select({
              studentId: studentSkills.studentId,
              isCompetent: studentSkills.isCompetent,
              bestScore: studentSkills.bestScore,
              attemptsCount: studentSkills.attemptsCount,
              lastAssessedAt: studentSkills.lastAssessedAt,
            })
            .from(studentSkills)
            .where(and(eq(studentSkills.skillId, skill.id), inArray(studentSkills.studentId, studentIds)))
        : [];
      return { id: skill.id, name: skill.name, category: skill.category, difficulty: skill.difficulty, records: studentSkillsList };
    })
  );

  // 4. Recent activity for this course's students
  const recentActivity = studentIds.length > 0
    ? await db
        .select({
          userId: auditLogs.userId,
          action: auditLogs.action,
          resource: auditLogs.resource,
          createdAt: auditLogs.createdAt,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(auditLogs)
        .innerJoin(users, eq(auditLogs.userId, users.id))
        .where(inArray(auditLogs.userId, studentIds))
        .orderBy(desc(auditLogs.createdAt))
        .limit(50)
    : [];

  // Build student summaries
  const studentSummaries = enrollments.map((student) => {
    // Assessment stats
    const studentAssessments = assessmentData.map((a) => {
      const bestAttempt = a.attempts.find((att) => att.studentId === student.studentId && (att.status === "SUBMITTED" || att.status === "GRADED"));
      return { assessmentId: a.id, title: a.title, score: bestAttempt?.score ?? null, passingScore: a.passingScore };
    });
    const assessmentScores = studentAssessments.filter((a) => a.score !== null).map((a) => a.score as number);
    const avgAssessment = assessmentScores.length > 0 ? Math.round(assessmentScores.reduce((s, v) => s + v, 0) / assessmentScores.length) : null;

    // Case stats
    const studentCases = caseData.map((c) => {
      const completedAttempts = c.attempts.filter((att) => att.studentId === student.studentId && att.status === "COMPLETED");
      const bestScore = completedAttempts.length > 0 ? Math.max(...completedAttempts.map((a) => a.score)) : null;
      const totalPoints = c.attempts.find((a) => a.studentId === student.studentId)?.totalPoints ?? 0;
      return { caseId: c.id, title: c.title, attempts: completedAttempts.length, bestScore, totalPoints };
    });
    const caseScores = studentCases.filter((c) => c.bestScore !== null).map((c) => c.bestScore as number);
    const avgCase = caseScores.length > 0 ? Math.round(caseScores.reduce((s, v) => s + v, 0) / caseScores.length) : null;

    // Skills stats
    const studentSkillRecords = skillData.map((s) => {
      const record = s.records.find((r) => r.studentId === student.studentId);
      return { skillId: s.id, name: s.name, isCompetent: record?.isCompetent ?? false, bestScore: record?.bestScore ?? 0, attemptsCount: record?.attemptsCount ?? 0 };
    });
    const completedSkills = studentSkillRecords.filter((s) => s.isCompetent).length;

    return {
      studentId: student.studentId,
      name: `${student.firstName} ${student.lastName}`,
      email: student.email,
      assessments: studentAssessments,
      avgAssessment,
      cases: studentCases,
      avgCase,
      skills: studentSkillRecords,
      completedSkills,
      totalSkills: courseSkills.length,
    };
  });

  return {
    courseId,
    totals: {
      students: enrollments.length,
      assessments: courseAssessments.length,
      cases: courseCases.length,
      skills: courseSkills.length,
    },
    students: studentSummaries,
    assessments: assessmentData,
    cases: caseData,
    skills: skillData,
    recentActivity: recentActivity.map((a) => ({
      studentName: `${a.firstName} ${a.lastName}`,
      action: a.action,
      resource: a.resource,
      createdAt: a.createdAt,
    })),
  };
}
