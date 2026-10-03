import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  studentAnalytics,
  courseAnalytics,
  activityLogs,
  performanceSnapshots,
  users,
  courses,
  courseEnrollments,
  assessments,
  assessmentAttempts,
  assessmentQuestions,
  lessons,
  topics,
  skills,
  studentLessonProgress,
  studentSkills,
  studentCompetencies,
  clinicalRotations,
  attendanceRecords,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { createChildLogger } from "../../utils/logger.js";

const logger = createChildLogger("analytics-service");

// ─── Activity Logging ────────────────────────────────────────────────────────

export async function recordActivity(data: {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  const [item] = await db
    .insert(activityLogs)
    .values({
      userId: data.userId,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId ?? null,
      metadata: data.metadata ?? null,
      ipAddress: data.ipAddress ?? null,
    })
    .returning();

  await logAudit({ userId: data.userId, action: "CREATE", resource: "activity_log", resourceId: item.id, metadata: { action: data.action, resource: data.resource } });

  return item;
}

export async function listActivities(query: { userId?: string; resource?: string; page: number; limit: number }) {
  const { userId, resource, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (userId) conditions.push(eq(activityLogs.userId, userId));
  if (resource) conditions.push(eq(activityLogs.resource, resource));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(activityLogs).where(where);

  const items = await db.select().from(activityLogs).where(where).orderBy(desc(activityLogs.createdAt)).limit(limit).offset(offset);
  return {
    items,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

// ─── Student Analytics ───────────────────────────────────────────────────────

export async function getStudentDashboard(studentId: string) {
  const enrollments = await db.select().from(courseEnrollments).where(eq(courseEnrollments.studentId, studentId));
  const courseIds = Array.from(new Set(enrollments.map((e) => e.courseId)));
  const hasCourses = courseIds.length > 0;

  const courseRows = hasCourses ? await db.select().from(courses).where(inArray(courses.id, courseIds)) : [];
  const courseMap = new Map(courseRows.map((c) => [c.id, c]));

  // Assessment attempts joined to their course, normalized to a percentage
  // (score / total possible points * 100) to match the assessment module convention.
  const attemptRows = hasCourses
    ? await db
        .select({
          assessmentId: assessmentAttempts.assessmentId,
          courseId: assessments.courseId,
          score: assessmentAttempts.score,
        })
        .from(assessmentAttempts)
        .innerJoin(assessments, eq(assessmentAttempts.assessmentId, assessments.id))
        .where(and(eq(assessmentAttempts.studentId, studentId), inArray(assessments.courseId, courseIds)))
    : [];

  const totalAttempts = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assessmentAttempts)
    .where(eq(assessmentAttempts.studentId, studentId));

  const assessmentIds = Array.from(new Set(attemptRows.map((a) => a.assessmentId)));
  const pointRows =
    assessmentIds.length > 0
      ? await db
          .select({
            assessmentId: assessmentQuestions.assessmentId,
            total: sql<number>`coalesce(sum(${assessmentQuestions.points}), 0)::int`,
          })
          .from(assessmentQuestions)
          .where(inArray(assessmentQuestions.assessmentId, assessmentIds))
          .groupBy(assessmentQuestions.assessmentId)
      : [];
  const pointsByAssessment = new Map(pointRows.map((p) => [p.assessmentId, p.total]));

  const attemptPcts: Array<{ courseId: string; pct: number }> = [];
  for (const a of attemptRows) {
    const total = pointsByAssessment.get(a.assessmentId) ?? 0;
    if (a.score !== null && total > 0) {
      attemptPcts.push({ courseId: a.courseId, pct: Math.round((a.score / total) * 100) });
    }
  }

  // Lessons completed vs total across enrolled courses
  const lessonTotalRows = hasCourses
    ? await db
        .select({ courseId: topics.courseId, total: sql<number>`count(*)::int` })
        .from(lessons)
        .innerJoin(topics, eq(lessons.topicId, topics.id))
        .where(inArray(topics.courseId, courseIds))
        .groupBy(topics.courseId)
    : [];
  const lessonCompletedRows = hasCourses
    ? await db
        .select({ courseId: topics.courseId, completed: sql<number>`count(distinct ${studentLessonProgress.lessonId})::int` })
        .from(studentLessonProgress)
        .innerJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
        .innerJoin(topics, eq(lessons.topicId, topics.id))
        .where(
          and(
            eq(studentLessonProgress.studentId, studentId),
            eq(studentLessonProgress.status, "COMPLETED"),
            inArray(topics.courseId, courseIds)
          )
        )
        .groupBy(topics.courseId)
    : [];

  // Skills across enrolled courses
  const skillRows = hasCourses
    ? await db
        .select({ courseId: skills.courseId, isCompetent: studentSkills.isCompetent })
        .from(studentSkills)
        .innerJoin(skills, eq(studentSkills.skillId, skills.id))
        .where(and(eq(studentSkills.studentId, studentId), inArray(skills.courseId, courseIds)))
    : [];

  // Competencies are framework-level (not course-attributable), so they stay global
  const [compTotals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      achieved: sql<number>`count(*) filter (where ${studentCompetencies.isAchieved} = true)::int`,
    })
    .from(studentCompetencies)
    .where(eq(studentCompetencies.studentId, studentId));

  const recentActivity = await db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.userId, studentId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(10);

  // Grade distribution (A-F) from percentage scores
  const pctValues = attemptPcts.map((a) => a.pct);
  const bucket = (min: number, max?: number) =>
    pctValues.filter((p) => p >= min && (max === undefined || p < max)).length;
  const gradeDistribution = [
    { name: "A", value: bucket(90) },
    { name: "B", value: bucket(80, 90) },
    { name: "C", value: bucket(70, 80) },
    { name: "D", value: bucket(60, 70) },
    { name: "F", value: bucket(0, 60) },
  ];

  const overallAvg =
    pctValues.length > 0 ? Math.round(pctValues.reduce((s, v) => s + v, 0) / pctValues.length) : null;

  const lessonsTotal = lessonTotalRows.reduce((s, r) => s + r.total, 0);
  const lessonsCompleted = lessonCompletedRows.reduce((s, r) => s + r.completed, 0);
  const completionRate = lessonsTotal > 0 ? Math.round((lessonsCompleted / lessonsTotal) * 100) : 0;

  const totalByCourse = new Map(lessonTotalRows.map((r) => [r.courseId, r.total]));
  const completedByCourse = new Map(lessonCompletedRows.map((r) => [r.courseId, r.completed]));

  const coursesData: Array<{
    course: (typeof courseRows)[number];
    lessonsCompleted: number;
    lessonsTotal: number;
    averageScore: number | null;
    skillsCompetent: number;
  }> = [];
  for (const cid of courseIds) {
    const course = courseMap.get(cid);
    if (!course) continue;
    const pcts = attemptPcts.filter((a) => a.courseId === cid).map((a) => a.pct);
    coursesData.push({
      course,
      lessonsCompleted: completedByCourse.get(cid) ?? 0,
      lessonsTotal: totalByCourse.get(cid) ?? 0,
      averageScore: pcts.length > 0 ? Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length) : null,
      skillsCompetent: skillRows.filter((s) => s.courseId === cid && s.isCompetent).length,
    });
  }

  return {
    enrollments: coursesData,
    stats: {
      totalCourses: enrollments.length,
      totalAssessments: totalAttempts[0]?.count ?? 0,
      averageScore: overallAvg,
      completionRate,
      skillsCompetent: skillRows.filter((s) => s.isCompetent).length,
      skillsTotal: skillRows.length,
      competenciesAchieved: compTotals?.achieved ?? 0,
      competenciesTotal: compTotals?.total ?? 0,
    },
    gradeDistribution,
    recentActivity,
  };
}

export async function getStudentCourseAnalytics(studentId: string, courseId: string) {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));

  const lessonsProgress = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${studentLessonProgress.status} = 'COMPLETED')::int`,
      inProgress: sql<number>`count(*) filter (where ${studentLessonProgress.status} = 'IN_PROGRESS')::int`,
    })
    .from(studentLessonProgress)
    .where(eq(studentLessonProgress.studentId, studentId));

  const assessments = await db
    .select({
      count: sql<number>`count(*)::int`,
      avgScore: sql<number>`coalesce(avg(${assessmentAttempts.score}), 0)::int`,
      bestScore: sql<number>`coalesce(max(${assessmentAttempts.score}), 0)::int`,
    })
    .from(assessmentAttempts)
    .where(eq(assessmentAttempts.studentId, studentId));

  const [snapshot] = await db
    .select()
    .from(performanceSnapshots)
    .where(and(eq(performanceSnapshots.studentId, studentId), eq(performanceSnapshots.courseId, courseId)))
    .orderBy(desc(performanceSnapshots.snapshotDate))
    .limit(1);

  return {
    course,
    lessons: lessonsProgress[0] ?? { total: 0, completed: 0, inProgress: 0 },
    assessments: assessments[0] ?? { count: 0, avgScore: 0, bestScore: 0 },
    latestSnapshot: snapshot ?? null,
  };
}

// ─── Instructor Analytics ────────────────────────────────────────────────────

export async function getInstructorDashboard(instructorId: string) {
  const instructorRotations = await db
    .select()
    .from(clinicalRotations)
    .where(eq(clinicalRotations.createdBy, instructorId));

  const totalStudents = await db
    .select({ count: sql<number>`count(distinct ${courseEnrollments.studentId})::int` })
    .from(courseEnrollments);

  const totalAssessments = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assessmentAttempts);

  const recentEvaluations = await db
    .select()
    .from(activityLogs)
    .where(and(eq(activityLogs.userId, instructorId), eq(activityLogs.action, "GRADE_ATTEMPT")))
    .orderBy(desc(activityLogs.createdAt))
    .limit(10);

  return {
    rotations: instructorRotations.length,
    totalStudents: totalStudents[0]?.count ?? 0,
    totalAssessments: totalAssessments[0]?.count ?? 0,
    recentActivity: recentEvaluations,
  };
}

export async function getCourseAnalytics(courseId: string) {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));

  const enrollments = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(courseEnrollments)
    .where(eq(courseEnrollments.courseId, courseId));

  const assessments = await db
    .select({
      count: sql<number>`count(*)::int`,
      avgScore: sql<number>`coalesce(avg(${assessmentAttempts.score}), 0)::int`,
    })
    .from(assessmentAttempts)
    .innerJoin(courseEnrollments, eq(assessmentAttempts.studentId, courseEnrollments.studentId))
    .where(eq(courseEnrollments.courseId, courseId));

  const lessonsProgress = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${studentLessonProgress.status} = 'COMPLETED')::int`,
    })
    .from(studentLessonProgress)
    .innerJoin(courseEnrollments, eq(studentLessonProgress.studentId, courseEnrollments.studentId))
    .where(eq(courseEnrollments.courseId, courseId));

  const [existing] = await db.select().from(courseAnalytics).where(eq(courseAnalytics.courseId, courseId));

  const updateData = {
    courseId,
    totalStudents: enrollments[0]?.count ?? 0,
    averageScore: assessments[0]?.avgScore ?? 0,
    totalAssessments: assessments[0]?.count ?? 0,
    totalLessons: lessonsProgress[0]?.total ?? 0,
    completionRate: lessonsProgress[0]?.total ? Math.round(((lessonsProgress[0]?.completed ?? 0) / lessonsProgress[0].total) * 100) : 0,
    averageProgress: lessonsProgress[0]?.total ? Math.round(((lessonsProgress[0]?.completed ?? 0) / lessonsProgress[0].total) * 100) : 0,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(courseAnalytics).set(updateData).where(eq(courseAnalytics.courseId, courseId));

    await logAudit({ action: "UPDATE", resource: "course_analytics", resourceId: existing.id, metadata: { courseId } });
  } else {
    await db.insert(courseAnalytics).values(updateData);

    await logAudit({ action: "CREATE", resource: "course_analytics", metadata: { courseId } });
  }

  return {
    course,
    ...updateData,
  };
}

// ─── Performance Snapshots ───────────────────────────────────────────────────

export async function createPerformanceSnapshot(data: {
  studentId: string;
  courseId: string;
  overallScore?: number;
  assessmentScore?: number;
  competencyScore?: number;
  clinicalScore?: number;
  engagementScore?: number;
  riskLevel?: string;
  metadata?: Record<string, unknown>;
}) {
  const [item] = await db
    .insert(performanceSnapshots)
    .values({
      studentId: data.studentId,
      courseId: data.courseId,
      snapshotDate: new Date(),
      overallScore: data.overallScore ?? null,
      assessmentScore: data.assessmentScore ?? null,
      competencyScore: data.competencyScore ?? null,
      clinicalScore: data.clinicalScore ?? null,
      engagementScore: data.engagementScore ?? null,
      riskLevel: data.riskLevel ?? null,
      metadata: data.metadata ?? null,
    })
    .returning();

  await logAudit({ userId: data.studentId, action: "CREATE", resource: "performance_snapshot", resourceId: item.id, metadata: { courseId: data.courseId } });

  return item;
}

export async function getStudentPerformanceHistory(studentId: string, courseId: string) {
  const items = await db
    .select()
    .from(performanceSnapshots)
    .where(and(eq(performanceSnapshots.studentId, studentId), eq(performanceSnapshots.courseId, courseId)))
    .orderBy(desc(performanceSnapshots.snapshotDate));

  return items;
}
