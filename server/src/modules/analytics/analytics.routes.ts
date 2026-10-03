import { Router, Request, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { ForbiddenError } from "../../middleware/error-handler.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import { recordActivitySchema, listQuerySchema } from "./analytics.schema.js";
import * as svc from "./analytics.service.js";

const router = Router();

// ─── Activity Logging ────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/analytics/activities:
 *   post:
 *     tags: [Analytics]
 *     summary: Record student activity
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action, resource]
 *             properties:
 *               action:
 *                 type: string
 *                 description: Activity action name
 *               resource:
 *                 type: string
 *                 description: Activity resource name
 *               resourceId:
 *                 type: string
 *                 description: Optional resource identifier
 *               metadata:
 *                 type: object
 *                 description: Optional metadata key-value pairs
 *     responses:
 *       201:
 *         description: Activity recorded
 *       401:
 *         description: Unauthorized
 */
router.post("/activities", authenticate, validateBody(recordActivitySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.recordActivity({ ...req.body, userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/analytics/activities:
 *   get:
 *     tags: [Analytics]
 *     summary: List student activities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by course ID
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by student ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter activities from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter activities up to this date
 *     responses:
 *       200:
 *         description: Activity list returned
 *       401:
 *         description: Unauthorized
 */
router.get("/activities", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listActivities((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ─── Student Analytics ───────────────────────────────────────────────────────

/**
 * @swagger
 * /api/analytics/students/dashboard:
 *   get:
 *     tags: [Analytics]
 *     summary: Get student analytics dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Student dashboard data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - student role required
 */
router.get("/students/dashboard", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await svc.getStudentDashboard(userId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/analytics/students/{studentId}/courses/{courseId}/analytics:
 *   get:
 *     tags: [Analytics]
 *     summary: Get analytics for a student in a specific course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Student ID
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Student course analytics data
 *       401:
 *         description: Unauthorized
 */
router.get("/students/:studentId/courses/:courseId/analytics", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requester = (req as AuthenticatedRequest).user;
    if (requester.role === "STUDENT" && requester.userId !== req.params.studentId) {
      throw new ForbiddenError("Students can only view their own analytics");
    }
    const data = await svc.getStudentCourseAnalytics(req.params.studentId as string, req.params.courseId as string);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── Instructor Analytics ────────────────────────────────────────────────────

/**
 * @swagger
 * /api/analytics/instructors/dashboard:
 *   get:
 *     tags: [Analytics]
 *     summary: Get instructor analytics dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Instructor dashboard data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - instructor role required
 */
router.get("/instructors/dashboard", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR", "CLINICAL_INSTRUCTOR"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await svc.getInstructorDashboard(userId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/analytics/courses/{courseId}/analytics:
 *   get:
 *     tags: [Analytics]
 *     summary: Get analytics for a specific course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Course analytics data
 *       401:
 *         description: Unauthorized
 */
router.get("/courses/:courseId/analytics", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await svc.getCourseAnalytics(req.params.courseId as string);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── Performance Snapshots ───────────────────────────────────────────────────

/**
 * @swagger
 * /api/analytics/snapshots:
 *   post:
 *     tags: [Analytics]
 *     summary: Create a performance snapshot
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Performance snapshot created
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - instructor role required
 */
router.post("/snapshots", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.createPerformanceSnapshot(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/analytics/students/{studentId}/courses/{courseId}/snapshots:
 *   get:
 *     tags: [Analytics]
 *     summary: Get student performance history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Student ID
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Student performance history
 *       401:
 *         description: Unauthorized
 */
router.get("/students/:studentId/courses/:courseId/snapshots", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requester = (req as AuthenticatedRequest).user;
    if (requester.role === "STUDENT" && requester.userId !== req.params.studentId) {
      throw new ForbiddenError("Students can only view their own performance history");
    }
    const data = await svc.getStudentPerformanceHistory(req.params.studentId as string, req.params.courseId as string);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

export default router;
