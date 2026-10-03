import { Router, Request, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import {
  createLearningPathSchema,
  updateLearningPathSchema,
  addPathItemSchema,
  createRemediationPlanSchema,
  updateRemediationPlanSchema,
  addRemediationItemSchema,
  addPrerequisiteSchema,
  listQuerySchema,
} from "./adaptive.schema.js";
import * as svc from "./adaptive.service.js";

const router = Router();

// ─── Learning Paths ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/adaptive/learning-paths:
 *   get:
 *     tags: [Adaptive Learning]
 *     summary: List all learning paths
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/learning-paths", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listLearningPaths((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/adaptive/learning-paths/{id}:
 *   get:
 *     tags: [Adaptive Learning]
 *     summary: Get a learning path by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/learning-paths/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getLearningPathById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/adaptive/learning-paths:
 *   post:
 *     tags: [Adaptive Learning]
 *     summary: Create a learning path
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               courseId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/learning-paths", authenticate, requireRole("STUDENT"), validateBody(createLearningPathSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createLearningPath({ ...req.body, studentId: userId }, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/adaptive/learning-paths/{id}:
 *   put:
 *     tags: [Adaptive Learning]
 *     summary: Update a learning path
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put("/learning-paths/:id", authenticate, requireRole("STUDENT"), validateBody(updateLearningPathSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateLearningPath(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/adaptive/learning-paths/{id}:
 *   delete:
 *     tags: [Adaptive Learning]
 *     summary: Delete a learning path
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted
 */
router.delete("/learning-paths/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteLearningPath(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Path Items ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/adaptive/learning-paths/{pathId}/items:
 *   post:
 *     tags: [Adaptive Learning]
 *     summary: Add an item to a learning path
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pathId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lessonId: { type: string, format: uuid }
 *               order: { type: integer }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/learning-paths/:pathId/items", authenticate, requireRole("STUDENT"), validateBody(addPathItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const path = await svc.getLearningPathById(req.params.pathId as string);
    if (path.studentId !== userId) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    const item = await svc.addPathItem(req.params.pathId as string, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/adaptive/learning-path-items/{id}/complete:
 *   post:
 *     tags: [Adaptive Learning]
 *     summary: Mark a learning path item as completed
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               score: { type: number }
 *     responses:
 *       200:
 *         description: Completed
 */
router.post("/learning-path-items/:id/complete", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.completePathItem(req.params.id as string, req.body.score);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/adaptive/learning-path-items/{id}:
 *   delete:
 *     tags: [Adaptive Learning]
 *     summary: Remove an item from a learning path
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted
 */
router.delete("/learning-path-items/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.removePathItem(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Remediation Plans ───────────────────────────────────────────────────────

/**
 * @swagger
 * /api/adaptive/remediation-plans:
 *   get:
 *     tags: [Adaptive Learning]
 *     summary: List all remediation plans
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/remediation-plans", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listRemediationPlans((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/adaptive/remediation-plans/{id}:
 *   get:
 *     tags: [Adaptive Learning]
 *     summary: Get a remediation plan by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/remediation-plans/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getRemediationPlanById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/adaptive/remediation-plans:
 *   post:
 *     tags: [Adaptive Learning]
 *     summary: Create a remediation plan
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               studentId: { type: string, format: uuid }
 *               courseId: { type: string, format: uuid }
 *               reason: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/remediation-plans", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR"), validateBody(createRemediationPlanSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createRemediationPlan({ ...req.body, studentId: req.body.studentId }, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/adaptive/remediation-plans/{id}:
 *   put:
 *     tags: [Adaptive Learning]
 *     summary: Update a remediation plan
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put("/remediation-plans/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateRemediationPlanSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateRemediationPlan(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/adaptive/remediation-plans/{id}:
 *   delete:
 *     tags: [Adaptive Learning]
 *     summary: Delete a remediation plan
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted
 */
router.delete("/remediation-plans/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteRemediationPlan(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Remediation Items ───────────────────────────────────────────────────────

/**
 * @swagger
 * /api/adaptive/remediation-plans/{planId}/items:
 *   post:
 *     tags: [Adaptive Learning]
 *     summary: Add an item to a remediation plan
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lessonId: { type: string, format: uuid }
 *               order: { type: integer }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/remediation-plans/:planId/items", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(addRemediationItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.addRemediationItem(req.params.planId as string, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/adaptive/remediation-items/{id}/complete:
 *   post:
 *     tags: [Adaptive Learning]
 *     summary: Mark a remediation item as completed
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Completed
 */
router.post("/remediation-items/:id/complete", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.completeRemediationItem(req.params.id as string, req.body.notes);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/adaptive/remediation-items/{id}:
 *   delete:
 *     tags: [Adaptive Learning]
 *     summary: Remove a remediation item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted
 */
router.delete("/remediation-items/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.removeRemediationItem(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Prerequisites ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/adaptive/courses/{courseId}/prerequisites:
 *   get:
 *     tags: [Adaptive Learning]
 *     summary: List prerequisites for a course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/courses/:courseId/prerequisites", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listPrerequisites(req.params.courseId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/adaptive/prerequisites:
 *   post:
 *     tags: [Adaptive Learning]
 *     summary: Add a prerequisite to a course
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               courseId: { type: string, format: uuid }
 *               prerequisiteCourseId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/prerequisites", authenticate, requireRole("ADMIN", "PROGRAM_COORDINATOR"), validateBody(addPrerequisiteSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.addPrerequisite(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/adaptive/prerequisites/{id}:
 *   delete:
 *     tags: [Adaptive Learning]
 *     summary: Remove a prerequisite
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted
 */
router.delete("/prerequisites/:id", authenticate, requireRole("ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.removePrerequisite(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/adaptive/students/{studentId}/courses/{courseId}/prerequisites/check:
 *   get:
 *     tags: [Adaptive Learning]
 *     summary: Check if student meets prerequisites for a course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Prerequisite check result
 */
router.get("/students/:studentId/courses/:courseId/prerequisites/check", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.checkPrerequisites(req.params.studentId as string, req.params.courseId as string);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

export default router;
