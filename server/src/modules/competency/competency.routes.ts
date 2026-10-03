import { Router, Request, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { ForbiddenError } from "../../middleware/error-handler.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import {
  createFrameworkSchema,
  updateFrameworkSchema,
  createCompetencySchema,
  updateCompetencySchema,
  createIndicatorSchema,
  assessCompetencySchema,
  listQuerySchema,
} from "./competency.schema.js";
import * as svc from "./competency.service.js";

const router = Router();

// ─── Frameworks ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/competency/frameworks:
 *   get:
 *     tags: [Competency]
 *     summary: List all competency frameworks
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
router.get("/frameworks", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listFrameworks((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/competency/frameworks/{id}:
 *   get:
 *     tags: [Competency]
 *     summary: Get a competency framework by ID
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
router.get("/frameworks/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getFrameworkById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/competency/frameworks:
 *   post:
 *     tags: [Competency]
 *     summary: Create a competency framework
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
 *               description: { type: string }
 *               version: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/frameworks", authenticate, requireRole("ADMIN", "PROGRAM_COORDINATOR"), validateBody(createFrameworkSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createFramework(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/competency/frameworks/{id}:
 *   put:
 *     tags: [Competency]
 *     summary: Update a competency framework
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
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put("/frameworks/:id", authenticate, requireRole("ADMIN", "PROGRAM_COORDINATOR"), validateBody(updateFrameworkSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateFramework(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/competency/frameworks/{id}:
 *   delete:
 *     tags: [Competency]
 *     summary: Delete a competency framework
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
router.delete("/frameworks/:id", authenticate, requireRole("ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteFramework(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Competencies ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/competency/competencies:
 *   get:
 *     tags: [Competency]
 *     summary: List all competencies
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
router.get("/competencies", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listCompetencies((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/competency/competencies/{id}:
 *   get:
 *     tags: [Competency]
 *     summary: Get a competency by ID
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
router.get("/competencies/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getCompetencyById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/competency/competencies:
 *   post:
 *     tags: [Competency]
 *     summary: Create a competency
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               frameworkId: { type: string, format: uuid }
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/competencies", authenticate, requireRole("ADMIN", "PROGRAM_COORDINATOR"), validateBody(createCompetencySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createCompetency(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/competency/competencies/{id}:
 *   put:
 *     tags: [Competency]
 *     summary: Update a competency
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
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put("/competencies/:id", authenticate, requireRole("ADMIN", "PROGRAM_COORDINATOR"), validateBody(updateCompetencySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateCompetency(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Indicators ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/competency/competencies/{competencyId}/indicators:
 *   post:
 *     tags: [Competency]
 *     summary: Add an indicator to a competency
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: competencyId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description: { type: string }
 *               level: { type: string, enum: [BEGINNER, INTERMEDIATE, ADVANCED] }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/competencies/:competencyId/indicators", authenticate, requireRole("ADMIN", "PROGRAM_COORDINATOR"), validateBody(createIndicatorSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.addIndicator(req.params.competencyId as string, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/competency/indicators/{id}:
 *   delete:
 *     tags: [Competency]
 *     summary: Remove an indicator
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
router.delete("/indicators/:id", authenticate, requireRole("ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.removeIndicator(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Student Competencies ────────────────────────────────────────────────────

/**
 * @swagger
 * /api/competency/students/{studentId}/competencies:
 *   get:
 *     tags: [Competency]
 *     summary: Get competencies for a student
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/students/:studentId/competencies", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const studentId = req.params.studentId as string;
    if (user.role === "STUDENT" && user.userId !== studentId) throw new ForbiddenError("Students may only view their own competencies");
    const items = await svc.getStudentCompetencies(studentId);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/competency/students/{studentId}/competencies/summary:
 *   get:
 *     tags: [Competency]
 *     summary: Get competency summary for a student
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: frameworkId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/students/:studentId/competencies/summary", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const studentId = req.params.studentId as string;
    if (user.role === "STUDENT" && user.userId !== studentId) throw new ForbiddenError("Students may only view their own competencies");
    const frameworkId = req.query.frameworkId as string;
    const item = await svc.getStudentCompetencySummary(studentId, frameworkId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/competency/assess:
 *   post:
 *     tags: [Competency]
 *     summary: Assess a student's competency
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
 *               competencyId: { type: string, format: uuid }
 *               level: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Assessment recorded
 */
router.post("/assess", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR", "CLINICAL_INSTRUCTOR", "ADMIN"), validateBody(assessCompetencySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.assessCompetency({ ...req.body, assessedBy: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

export default router;
