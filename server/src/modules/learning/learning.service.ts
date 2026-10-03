import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  courses,
  topics,
  lessons,
  learningMaterials,
  learningActivities,
  studentLessonProgress,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { NotFoundError, ConflictError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";

const logger = createChildLogger("learning-service");

// ─── Topics ──────────────────────────────────────────────────────────────────

export async function listTopics(query: { courseId?: string; instructorId?: string; page: number; limit: number; isActive?: boolean }) {
  const { courseId, instructorId, page, limit, isActive = true } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (courseId) conditions.push(eq(topics.courseId, courseId));
  if (isActive !== undefined) conditions.push(eq(topics.isActive, isActive));
  if (instructorId) conditions.push(eq(courses.instructorId, instructorId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const countQuery = instructorId
    ? db.select({ count: sql<number>`count(*)::int` }).from(topics).innerJoin(courses, eq(topics.courseId, courses.id)).where(where)
    : db.select({ count: sql<number>`count(*)::int` }).from(topics).where(where);
  const [countResult] = await countQuery;

  const itemsQuery = instructorId
    ? db.select({
        id: topics.id,
        courseId: topics.courseId,
        name: topics.name,
        description: topics.description,
        order: topics.order,
        isActive: topics.isActive,
        createdAt: topics.createdAt,
        updatedAt: topics.updatedAt,
      }).from(topics).innerJoin(courses, eq(topics.courseId, courses.id)).where(where).orderBy(topics.order).limit(limit).offset(offset)
    : db.select().from(topics).where(where).orderBy(topics.order).limit(limit).offset(offset);
  const items = await itemsQuery;
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getTopicById(id: string) {
  const [item] = await db.select().from(topics).where(eq(topics.id, id));
  if (!item) throw new NotFoundError("Topic");
  return item;
}

export async function createTopic(data: { courseId: string; name: string; description?: string }, createdBy?: string) {
  const [maxOrder] = await db.select({ max: sql<number>`coalesce(max(${topics.order}), 0)` }).from(topics).where(eq(topics.courseId, data.courseId));
  const [item] = await db.insert(topics).values({ ...data, order: (maxOrder?.max ?? 0) + 1, isActive: true }).returning();
  await logAudit({ userId: createdBy, action: "CREATE_TOPIC", resource: "TOPIC", resourceId: item.id });
  return item;
}

export async function updateTopic(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(topics).where(eq(topics.id, id));
  if (!existing) throw new NotFoundError("Topic");

  const [item] = await db.update(topics).set({ ...data, updatedAt: new Date() }).where(eq(topics.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_TOPIC", resource: "TOPIC", resourceId: id });
  return item;
}

export async function deleteTopic(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(topics).where(eq(topics.id, id));
  if (!existing) throw new NotFoundError("Topic");

  await db.update(topics).set({ isActive: false, updatedAt: new Date() }).where(eq(topics.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_TOPIC", resource: "TOPIC", resourceId: id });
}

// ─── Lessons ─────────────────────────────────────────────────────────────────

export async function listLessons(query: { topicId?: string; courseId?: string; instructorId?: string; page: number; limit: number; isActive?: boolean }) {
  const { topicId, courseId, instructorId, page, limit, isActive } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (topicId) conditions.push(eq(lessons.topicId, topicId));
  if (isActive !== undefined) conditions.push(eq(lessons.isActive, isActive));
  if (instructorId) conditions.push(eq(courses.instructorId, instructorId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const countQuery = instructorId
    ? db.select({ count: sql<number>`count(*)::int` }).from(lessons).innerJoin(topics, eq(lessons.topicId, topics.id)).innerJoin(courses, eq(topics.courseId, courses.id)).where(where)
    : db.select({ count: sql<number>`count(*)::int` }).from(lessons).where(where);
  const [countResult] = await countQuery;

  const itemsQuery = instructorId
    ? db.select({
        id: lessons.id,
        topicId: lessons.topicId,
        title: lessons.title,
        content: lessons.content,
        order: lessons.order,
        isActive: lessons.isActive,
        createdAt: lessons.createdAt,
        updatedAt: lessons.updatedAt,
        topicName: topics.name,
      }).from(lessons).innerJoin(topics, eq(lessons.topicId, topics.id)).innerJoin(courses, eq(topics.courseId, courses.id)).where(where).orderBy(lessons.order).limit(limit).offset(offset)
    : db.select({
        id: lessons.id,
        topicId: lessons.topicId,
        title: lessons.title,
        content: lessons.content,
        order: lessons.order,
        isActive: lessons.isActive,
        createdAt: lessons.createdAt,
        updatedAt: lessons.updatedAt,
        topicName: topics.name,
      }).from(lessons).innerJoin(topics, eq(lessons.topicId, topics.id)).where(where).orderBy(lessons.order).limit(limit).offset(offset);
  const items = await itemsQuery;
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getLessonById(id: string) {
  const [item] = await db.select().from(lessons).where(eq(lessons.id, id));
  if (!item) throw new NotFoundError("Lesson");
  return item;
}

export async function getLessonWithContent(id: string) {
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id));
  if (!lesson) throw new NotFoundError("Lesson");

  const materials = await db
    .select()
    .from(learningMaterials)
    .where(eq(learningMaterials.lessonId, id))
    .orderBy(learningMaterials.order);

  const activities = await db
    .select()
    .from(learningActivities)
    .where(eq(learningActivities.lessonId, id))
    .orderBy(learningActivities.order);

  return { ...lesson, materials, activities };
}

export async function createLesson(data: { topicId: string; title: string; content?: string }, createdBy?: string) {
  const [maxOrder] = await db.select({ max: sql<number>`coalesce(max(${lessons.order}), 0)` }).from(lessons).where(eq(lessons.topicId, data.topicId));
  const [item] = await db.insert(lessons).values({ ...data, order: (maxOrder?.max ?? 0) + 1 }).returning();
  await logAudit({ userId: createdBy, action: "CREATE_LESSON", resource: "LESSON", resourceId: item.id });
  return item;
}

export async function updateLesson(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(lessons).where(eq(lessons.id, id));
  if (!existing) throw new NotFoundError("Lesson");

  const [item] = await db.update(lessons).set({ ...data, updatedAt: new Date() }).where(eq(lessons.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_LESSON", resource: "LESSON", resourceId: id });
  return item;
}

export async function deleteLesson(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(lessons).where(eq(lessons.id, id));
  if (!existing) throw new NotFoundError("Lesson");

  await db.update(lessons).set({ isActive: false, updatedAt: new Date() }).where(eq(lessons.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_LESSON", resource: "LESSON", resourceId: id });
}

// ─── Learning Materials ──────────────────────────────────────────────────────

export async function listMaterials(lessonId: string) {
  return db.select().from(learningMaterials).where(eq(learningMaterials.lessonId, lessonId)).orderBy(learningMaterials.order);
}

export async function getMaterialById(id: string) {
  const [item] = await db.select().from(learningMaterials).where(eq(learningMaterials.id, id));
  if (!item) throw new NotFoundError("Learning Material");
  return item;
}

export async function createMaterial(lessonId: string, data: { title: string; type: string; content?: string; url?: string; filePath?: string; isRequired?: boolean }, createdBy?: string) {
  const [maxOrder] = await db.select({ max: sql<number>`coalesce(max(${learningMaterials.order}), 0)` }).from(learningMaterials).where(eq(learningMaterials.lessonId, lessonId));
  const [item] = await db.insert(learningMaterials).values({ ...data, lessonId, order: (maxOrder?.max ?? 0) + 1, type: data.type as "TEXT" | "VIDEO" | "DOCUMENT" | "LINK" | "IMAGE" }).returning();
  await logAudit({ userId: createdBy, action: "CREATE_MATERIAL", resource: "LEARNING_MATERIAL", resourceId: item.id });
  return item;
}

export async function updateMaterial(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(learningMaterials).where(eq(learningMaterials.id, id));
  if (!existing) throw new NotFoundError("Learning Material");

  const [item] = await db.update(learningMaterials).set({ ...data, updatedAt: new Date() }).where(eq(learningMaterials.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_MATERIAL", resource: "LEARNING_MATERIAL", resourceId: id });
  return item;
}

export async function deleteMaterial(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(learningMaterials).where(eq(learningMaterials.id, id));
  if (!existing) throw new NotFoundError("Learning Material");

  await db.delete(learningMaterials).where(eq(learningMaterials.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_MATERIAL", resource: "LEARNING_MATERIAL", resourceId: id });
}

// ─── Learning Activities ─────────────────────────────────────────────────────

export async function listActivities(lessonId: string) {
  return db.select().from(learningActivities).where(eq(learningActivities.lessonId, lessonId)).orderBy(learningActivities.order);
}

export async function getActivityById(id: string) {
  const [item] = await db.select().from(learningActivities).where(eq(learningActivities.id, id));
  if (!item) throw new NotFoundError("Learning Activity");
  return item;
}

export async function createActivity(lessonId: string, data: { title: string; type: string; description?: string; instructions?: string; config?: Record<string, unknown>; points?: number; isRequired?: boolean }, createdBy?: string) {
  const [maxOrder] = await db.select({ max: sql<number>`coalesce(max(${learningActivities.order}), 0)` }).from(learningActivities).where(eq(learningActivities.lessonId, lessonId));
  const [item] = await db.insert(learningActivities).values({ ...data, lessonId, order: (maxOrder?.max ?? 0) + 1, type: data.type as "READING" | "VIDEO_WATCH" | "QUIZ" | "REFLECTION" | "CASE_STUDY" | "DISCUSSION" | "PRACTICE" | "ASSIGNMENT", config: data.config ?? null }).returning();
  await logAudit({ userId: createdBy, action: "CREATE_ACTIVITY", resource: "LEARNING_ACTIVITY", resourceId: item.id });
  return item;
}

export async function updateActivity(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(learningActivities).where(eq(learningActivities.id, id));
  if (!existing) throw new NotFoundError("Learning Activity");

  const [item] = await db.update(learningActivities).set({ ...data, updatedAt: new Date() }).where(eq(learningActivities.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_ACTIVITY", resource: "LEARNING_ACTIVITY", resourceId: id });
  return item;
}

export async function deleteActivity(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(learningActivities).where(eq(learningActivities.id, id));
  if (!existing) throw new NotFoundError("Learning Activity");

  await db.delete(learningActivities).where(eq(learningActivities.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_ACTIVITY", resource: "LEARNING_ACTIVITY", resourceId: id });
}

// ─── Student Progress ────────────────────────────────────────────────────────

export async function getStudentProgress(studentId: string, lessonId: string) {
  const [item] = await db
    .select()
    .from(studentLessonProgress)
    .where(and(eq(studentLessonProgress.studentId, studentId), eq(studentLessonProgress.lessonId, lessonId)));
  return item || null;
}

export async function getStudentCourseProgress(studentId: string, courseId: string) {
  const courseLessons = await db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(topics, eq(lessons.topicId, topics.id))
    .where(eq(topics.courseId, courseId));

  const lessonIds = courseLessons.map((l) => l.id);
  if (lessonIds.length === 0) return { total: 0, completed: 0, inProgress: 0, percentage: 0 };

  const progress = await db
    .select()
    .from(studentLessonProgress)
    .where(
      and(
        eq(studentLessonProgress.studentId, studentId),
        sql`${studentLessonProgress.lessonId} = ANY(${lessonIds})`
      )
    );

  const completed = progress.filter((p) => p.status === "COMPLETED").length;
  const inProgress = progress.filter((p) => p.status === "IN_PROGRESS").length;

  return {
    total: lessonIds.length,
    completed,
    inProgress,
    percentage: Math.round((completed / lessonIds.length) * 100),
  };
}

export async function upsertProgress(studentId: string, data: { lessonId: string; status: string; timeSpentSeconds?: number; score?: number; metadata?: Record<string, unknown> }) {
  const [existing] = await db
    .select()
    .from(studentLessonProgress)
    .where(and(eq(studentLessonProgress.studentId, studentId), eq(studentLessonProgress.lessonId, data.lessonId)));

  const now = new Date();
  const updateData: Record<string, unknown> = {
    status: data.status,
    updatedAt: now,
  };

  if (data.timeSpentSeconds !== undefined) updateData.timeSpentSeconds = data.timeSpentSeconds;
  if (data.score !== undefined) updateData.score = data.score;
  if (data.metadata) updateData.metadata = data.metadata;

  if (data.status === "IN_PROGRESS" && !existing?.startedAt) {
    updateData.startedAt = now;
  }
  if (data.status === "COMPLETED" && !existing?.completedAt) {
    updateData.completedAt = now;
  }

  if (existing) {
    const [item] = await db
      .update(studentLessonProgress)
      .set(updateData)
      .where(eq(studentLessonProgress.id, existing.id))
      .returning();
    return item;
  }

  const [item] = await db
    .insert(studentLessonProgress)
    .values({
      studentId,
      lessonId: data.lessonId,
      status: data.status as "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED",
      startedAt: data.status === "IN_PROGRESS" ? now : null,
      completedAt: data.status === "COMPLETED" ? now : null,
      timeSpentSeconds: data.timeSpentSeconds ?? 0,
      score: data.score ?? null,
      metadata: data.metadata ?? null,
    })
    .returning();

  return item;
}
