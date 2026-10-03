import { Router, Request, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import {
  createDiagnosisSchema,
  updateDiagnosisSchema,
  createCarePlanSchema,
  updateCarePlanSchema,
  addDiagnosisToPlanSchema,
  createOutcomeSchema,
  updateOutcomeSchema,
  createInterventionSchema,
  reviewCarePlanSchema,
  submitCarePlanSchema,
  evaluateCarePlanSchema,
  listQuerySchema,
} from "./nursing-process.schema.js";
import * as svc from "./nursing-process.service.js";

const router = Router();

// ─── Nursing Diagnoses ───────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nursing-process/diagnoses:
 *   get:
 *     tags: [Nursing Process]
 *     summary: List all nursing diagnoses
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
router.get("/diagnoses", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listDiagnoses((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nursing-process/diagnoses/{id}:
 *   get:
 *     tags: [Nursing Process]
 *     summary: Get a nursing diagnosis by ID
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
router.get("/diagnoses/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getDiagnosisById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nursing-process/diagnoses:
 *   post:
 *     tags: [Nursing Process]
 *     summary: Create a nursing diagnosis
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
 *               definition: { type: string }
 *               riskFactors: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/diagnoses", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createDiagnosisSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createDiagnosis(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nursing-process/diagnoses/{id}:
 *   put:
 *     tags: [Nursing Process]
 *     summary: Update a nursing diagnosis
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
 *               definition: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put("/diagnoses/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateDiagnosisSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateDiagnosis(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Care Plans ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nursing-process/care-plans:
 *   get:
 *     tags: [Nursing Process]
 *     summary: List all care plans
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
router.get("/care-plans", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listCarePlans((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nursing-process/care-plans/{id}:
 *   get:
 *     tags: [Nursing Process]
 *     summary: Get a care plan by ID
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
router.get("/care-plans/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getCarePlanById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nursing-process/care-plans:
 *   post:
 *     tags: [Nursing Process]
 *     summary: Create a care plan
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patientName: { type: string }
 *               medicalDiagnosis: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/care-plans", authenticate, requireRole("STUDENT"), validateBody(createCarePlanSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createCarePlan({ ...req.body, studentId: userId }, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nursing-process/care-plans/{id}:
 *   put:
 *     tags: [Nursing Process]
 *     summary: Update a care plan
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
 *               patientName: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put("/care-plans/:id", authenticate, requireRole("STUDENT"), validateBody(updateCarePlanSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateCarePlan(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nursing-process/care-plans/{id}:
 *   delete:
 *     tags: [Nursing Process]
 *     summary: Delete a care plan
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
router.delete("/care-plans/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteCarePlan(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Submit / Recall ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nursing-process/care-plans/{id}/submit:
 *   post:
 *     tags: [Nursing Process]
 *     summary: Submit or recall a care plan
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
 *               status: { type: string, enum: [SUBMITTED, DRAFT] }
 *     responses:
 *       200:
 *         description: Updated
 */
router.post("/care-plans/:id/submit", authenticate, requireRole("STUDENT"), validateBody(submitCarePlanSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.submitCarePlan(req.params.id as string, req.body.status, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Evaluate ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nursing-process/care-plans/{id}/evaluate:
 *   post:
 *     tags: [Nursing Process]
 *     summary: Evaluate a care plan (approve, return, complete)
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
 *               evaluationNotes: { type: string }
 *               status: { type: string, enum: [APPROVED, RETURNED, COMPLETED] }
 *     responses:
 *       200:
 *         description: Evaluated
 */
router.post("/care-plans/:id/evaluate", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(evaluateCarePlanSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.evaluateCarePlan(req.params.id as string, userId, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Care Plan Diagnoses ─────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nursing-process/care-plans/{carePlanId}/diagnoses:
 *   post:
 *     tags: [Nursing Process]
 *     summary: Add a diagnosis to a care plan
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: carePlanId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               diagnosisId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/care-plans/:carePlanId/diagnoses", authenticate, requireRole("STUDENT"), validateBody(addDiagnosisToPlanSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.addDiagnosis(req.params.carePlanId as string, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nursing-process/care-plan-diagnoses/{id}:
 *   put:
 *     tags: [Nursing Process]
 *     summary: Update diagnosis details (rationale, goal type, assessment data)
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
 *               priority: { type: integer }
 *               rationale: { type: string }
 *               goalType: { type: string, enum: [SHORT_TERM, LONG_TERM] }
 *               assessmentData: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put("/care-plan-diagnoses/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.updateDiagnosisOnPlan(req.params.id as string, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nursing-process/care-plan-diagnoses/{id}:
 *   delete:
 *     tags: [Nursing Process]
 *     summary: Remove a diagnosis from a care plan
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
router.delete("/care-plan-diagnoses/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.removeDiagnosis(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Care Plan Outcomes ──────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nursing-process/care-plan-diagnoses/{diagnosisId}/outcomes:
 *   post:
 *     tags: [Nursing Process]
 *     summary: Add an outcome to a care plan diagnosis
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: diagnosisId
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
 *               targetDate: { type: string, format: date }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/care-plan-diagnoses/:diagnosisId/outcomes", authenticate, requireRole("STUDENT"), validateBody(createOutcomeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.addOutcome(req.params.diagnosisId as string, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nursing-process/care-plan-outcomes/{id}:
 *   put:
 *     tags: [Nursing Process]
 *     summary: Update a care plan outcome
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
router.put("/care-plan-outcomes/:id", authenticate, requireRole("STUDENT", "INSTRUCTOR", "PROGRAM_COORDINATOR"), validateBody(updateOutcomeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.updateOutcome(req.params.id as string, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nursing-process/care-plan-outcomes/{id}:
 *   delete:
 *     tags: [Nursing Process]
 *     summary: Remove a care plan outcome
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
router.delete("/care-plan-outcomes/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.removeOutcome(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Care Plan Interventions ─────────────────────────────────────────────────

/**
 * @swagger
 * /api/nursing-process/care-plan-diagnoses/{diagnosisId}/interventions:
 *   post:
 *     tags: [Nursing Process]
 *     summary: Add an intervention to a care plan diagnosis
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: diagnosisId
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
 *               type: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/care-plan-diagnoses/:diagnosisId/interventions", authenticate, requireRole("STUDENT"), validateBody(createInterventionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.addIntervention(req.params.diagnosisId as string, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nursing-process/care-plan-interventions/{id}:
 *   put:
 *     tags: [Nursing Process]
 *     summary: Update a care plan intervention
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
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put("/care-plan-interventions/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.updateIntervention(req.params.id as string, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nursing-process/care-plan-interventions/{id}:
 *   delete:
 *     tags: [Nursing Process]
 *     summary: Remove a care plan intervention
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
router.delete("/care-plan-interventions/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.removeIntervention(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Review ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nursing-process/care-plans/{id}/review:
 *   post:
 *     tags: [Nursing Process]
 *     summary: Review a care plan (instructor)
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
 *               status: { type: string, enum: [APPROVED, NEEDS_REVISION] }
 *               feedback: { type: string }
 *     responses:
 *       200:
 *         description: Review recorded
 */
router.post("/care-plans/:id/review", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR"), validateBody(reviewCarePlanSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.reviewCarePlan(req.params.id as string, userId, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

export default router;
