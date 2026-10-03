import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../middleware/auth.js";
import { db } from "../../database/index.js";
import { courses, topics, lessons, users, assessments } from "../../database/schema/index.js";
import { like, or, eq, sql } from "drizzle-orm";

const router = Router();

router.get("/", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      res.json({ success: true, data: { courses: [], topics: [], lessons: [], users: [], assessments: [] } });
      return;
    }

    const pattern = `%${q}%`;

    const matchedCourses = await db
      .select({
        id: courses.id,
        title: courses.name,
        type: sql<string>`'course'`,
        url: sql<string>`CONCAT('/courses')`,
      })
      .from(courses)
      .where(or(like(courses.name, pattern), like(courses.code, pattern)))
      .limit(10);

    const matchedTopics = await db
      .select({
        id: topics.id,
        title: topics.name,
        type: sql<string>`'topic'`,
        url: sql<string>`'/topics'`,
      })
      .from(topics)
      .where(like(topics.name, pattern))
      .limit(10);

    const matchedLessons = await db
      .select({
        id: lessons.id,
        title: lessons.title,
        type: sql<string>`'lesson'`,
        url: sql<string>`'/lessons'`,
      })
      .from(lessons)
      .where(like(lessons.title, pattern))
      .limit(10);

    const matchedUsers = await db
      .select({
        id: users.id,
        title: sql<string>`CONCAT(users.first_name, ' ', users.last_name)`,
        type: sql<string>`'user'`,
        url: sql<string>`'/users'`,
      })
      .from(users)
      .where(or(like(users.firstName, pattern), like(users.lastName, pattern), like(users.email, pattern)))
      .limit(10);

    const matchedAssessments = await db
      .select({
        id: assessments.id,
        title: assessments.title,
        type: sql<string>`'assessment'`,
        url: sql<string>`'/assessments'`,
      })
      .from(assessments)
      .where(like(assessments.title, pattern))
      .limit(10);

    res.json({
      success: true,
      data: {
        courses: matchedCourses,
        topics: matchedTopics,
        lessons: matchedLessons,
        users: matchedUsers,
        assessments: matchedAssessments,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
