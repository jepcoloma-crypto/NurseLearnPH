import { Router, Request, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import {
  createCaseSchema,
  updateCaseSchema,
  createStageSchema,
  updateStageSchema,
  submitCaseAttemptSchema,
  listQuerySchema,
} from "./clinical.schema.js";
import * as svc from "./clinical.service.js";

const router = Router();

// ─── Cases ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/clinical/cases:
 *   get:
 *     tags: [Clinical Cases]
 *     summary: List all clinical cases
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/cases", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listCases((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical/cases/{id}:
 *   get:
 *     tags: [Clinical Cases]
 *     summary: Get a clinical case by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Clinical case ID
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/cases/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getCaseById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical/cases:
 *   post:
 *     tags: [Clinical Cases]
 *     summary: Create a new clinical case
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCaseSchema'
 *     responses:
 *       201:
 *         description: Clinical case created
 */
router.post("/cases", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createCaseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createCase(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical/cases/{id}:
 *   put:
 *     tags: [Clinical Cases]
 *     summary: Update a clinical case
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Clinical case ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCaseSchema'
 *     responses:
 *       200:
 *         description: Clinical case updated
 */
router.put("/cases/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateCaseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateCase(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical/cases/{id}:
 *   delete:
 *     tags: [Clinical Cases]
 *     summary: Delete a clinical case
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Clinical case ID
 *     responses:
 *       204:
 *         description: Clinical case deleted
 */
router.delete("/cases/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteCase(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical/cases/{id}/toggle-publish:
 *   patch:
 *     tags: [Clinical Cases]
 *     summary: Toggle publish status of a clinical case
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Clinical case ID
 *     responses:
 *       200:
 *         description: Publish status toggled
 */
router.patch("/cases/:id/toggle-publish", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const updated = await svc.toggleCasePublish(req.params.id as string, userId);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ─── Stages ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/clinical/cases/{caseId}/stages:
 *   post:
 *     tags: [Clinical Cases]
 *     summary: Create a new stage for a clinical case
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Parent clinical case ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateStageSchema'
 *     responses:
 *       201:
 *         description: Stage created
 */
router.post("/cases/:caseId/stages", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createStageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createStage(req.params.caseId as string, req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical/stages/{id}:
 *   put:
 *     tags: [Clinical Cases]
 *     summary: Update a clinical case stage
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Stage ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateStageSchema'
 *     responses:
 *       200:
 *         description: Stage updated
 */
router.put("/stages/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateStageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateStage(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical/stages/{id}:
 *   delete:
 *     tags: [Clinical Cases]
 *     summary: Delete a clinical case stage
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Stage ID
 *     responses:
 *       204:
 *         description: Stage deleted
 */
router.delete("/stages/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteStage(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Attempts ────────────────────────────────────────────────────────────────

router.get("/attempts/:attemptId", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.getCaseAttempt(req.params.attemptId as string, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical/cases/{caseId}/start:
 *   post:
 *     tags: [Clinical Cases]
 *     summary: Start a clinical case attempt
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Clinical case ID to attempt
 *     responses:
 *       201:
 *         description: Attempt started
 */
router.post("/cases/:caseId/start", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.startCaseAttempt(req.params.caseId as string, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical/attempts/{attemptId}/submit:
 *   post:
 *     tags: [Clinical Cases]
 *     summary: Submit a clinical case attempt
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: string
 *         description: Attempt ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitCaseAttemptSchema'
 *     responses:
 *       200:
 *         description: Attempt submitted and scored
 */
router.post("/attempts/:attemptId/submit", authenticate, requireRole("STUDENT"), validateBody(submitCaseAttemptSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.submitCaseAttempt(req.params.attemptId as string, userId, req.body.responses);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical/attempts:
 *   get:
 *     tags: [Clinical Cases]
 *     summary: List student's case attempts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of attempts
 */
router.get("/attempts", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const item = await svc.listAttempts(userId, page, limit);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical/attempts/{attemptId}/result:
 *   get:
 *     tags: [Clinical Cases]
 *     summary: Get the result of a clinical case attempt
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: string
 *         description: Attempt ID
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/attempts/:attemptId/result", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.getCaseAttemptResult(req.params.attemptId as string, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical/cases/{caseId}/history:
 *   get:
 *     tags: [Clinical Cases]
 *     summary: Get student history for a clinical case
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Clinical case ID
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/cases/:caseId/history", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const items = await svc.getStudentCaseHistory(req.params.caseId as string, userId);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

export default router;
