import { Router, Request, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import {
  createPatientSchema,
  updatePatientSchema,
  createScenarioSchema,
  updateScenarioSchema,
  createStateTransitionSchema,
  createActionSchema,
  createResponseSchema,
  startSessionSchema,
  performActionSchema,
  completeSessionSchema,
  listQuerySchema,
} from "./simulation.schema.js";
import * as svc from "./simulation.service.js";

const router = Router();

// ─── Virtual Patients ────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/simulation/patients:
 *   get:
 *     tags: [Simulation]
 *     summary: List virtual patients
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
router.get("/patients", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listPatients((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/patients/{id}:
 *   get:
 *     tags: [Simulation]
 *     summary: Get virtual patient by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/patients/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getPatientById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/patients:
 *   post:
 *     tags: [Simulation]
 *     summary: Create a virtual patient
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - age
 *               - gender
 *             properties:
 *               name:
 *                 type: string
 *               age:
 *                 type: integer
 *               gender:
 *                 type: string
 *               medicalHistory:
 *                 type: string
 *               diagnosis:
 *                 type: string
 *     responses:
 *       201:
 *         description: Patient created
 */
router.post("/patients", authenticate, requireRole("ADMIN", "INSTRUCTOR", "PROGRAM_COORDINATOR"), validateBody(createPatientSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createPatient({ ...req.body, createdBy: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/patients/{id}:
 *   put:
 *     tags: [Simulation]
 *     summary: Update a virtual patient
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               age:
 *                 type: integer
 *               gender:
 *                 type: string
 *               medicalHistory:
 *                 type: string
 *               diagnosis:
 *                 type: string
 *     responses:
 *       200:
 *         description: Patient updated
 */
router.put("/patients/:id", authenticate, requireRole("ADMIN", "INSTRUCTOR"), validateBody(updatePatientSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.updatePatient(req.params.id as string, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

router.delete("/patients/:id", authenticate, requireRole("ADMIN", "INSTRUCTOR"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.deletePatient(req.params.id as string);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) { next(err); }
});

// ─── Patient Scenarios ───────────────────────────────────────────────────────

/**
 * @swagger
 * /api/simulation/scenarios:
 *   get:
 *     tags: [Simulation]
 *     summary: List patient scenarios
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
router.get("/scenarios", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listScenarios((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/scenarios/{id}:
 *   get:
 *     tags: [Simulation]
 *     summary: Get patient scenario by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Scenario ID
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/scenarios/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getScenarioById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/scenarios:
 *   post:
 *     tags: [Simulation]
 *     summary: Create a patient scenario
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patientId
 *               - title
 *             properties:
 *               patientId:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Scenario created
 */
router.post("/scenarios", authenticate, requireRole("ADMIN", "INSTRUCTOR"), validateBody(createScenarioSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createScenario({ ...req.body, createdBy: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/scenarios/{id}:
 *   put:
 *     tags: [Simulation]
 *     summary: Update a patient scenario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Scenario ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Scenario updated
 */
router.put("/scenarios/:id", authenticate, requireRole("ADMIN", "INSTRUCTOR"), validateBody(updateScenarioSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.updateScenario(req.params.id as string, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

router.delete("/scenarios/:id", authenticate, requireRole("ADMIN", "INSTRUCTOR"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.deleteScenario(req.params.id as string);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) { next(err); }
});

// ─── State Transitions ───────────────────────────────────────────────────────

/**
 * @swagger
 * /api/simulation/scenarios/{scenarioId}/transitions:
 *   get:
 *     tags: [Simulation]
 *     summary: List state transitions for a scenario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scenarioId
 *         required: true
 *         schema:
 *           type: string
 *         description: Scenario ID
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/scenarios/:scenarioId/transitions", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listTransitions(req.params.scenarioId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/scenarios/{scenarioId}/transitions:
 *   post:
 *     tags: [Simulation]
 *     summary: Create a state transition for a scenario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scenarioId
 *         required: true
 *         schema:
 *           type: string
 *         description: Scenario ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromState
 *               - toState
 *             properties:
 *               fromState:
 *                 type: string
 *               toState:
 *                 type: string
 *               condition:
 *                 type: string
 *     responses:
 *       201:
 *         description: Transition created
 */
router.post("/scenarios/:scenarioId/transitions", authenticate, requireRole("ADMIN", "INSTRUCTOR"), validateBody(createStateTransitionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.createTransition(req.params.scenarioId as string, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/transitions/{id}:
 *   delete:
 *     tags: [Simulation]
 *     summary: Delete a state transition
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transition ID
 *     responses:
 *       204:
 *         description: Transition deleted
 */
router.delete("/transitions/:id", authenticate, requireRole("ADMIN", "INSTRUCTOR"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.deleteTransition(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Nursing Actions ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/simulation/actions:
 *   get:
 *     tags: [Simulation]
 *     summary: List nursing actions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/actions", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listActions();
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/actions/{id}:
 *   get:
 *     tags: [Simulation]
 *     summary: Get a nursing action by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Action ID
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/actions/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getActionById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/actions:
 *   post:
 *     tags: [Simulation]
 *     summary: Create a nursing action
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Action created
 */
router.post("/actions", authenticate, requireRole("ADMIN", "INSTRUCTOR"), validateBody(createActionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.createAction(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Patient Responses ───────────────────────────────────────────────────────

/**
 * @swagger
 * /api/simulation/scenarios/{scenarioId}/responses:
 *   get:
 *     tags: [Simulation]
 *     summary: List patient responses for a scenario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scenarioId
 *         required: true
 *         schema:
 *           type: string
 *         description: Scenario ID
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/scenarios/:scenarioId/responses", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listResponses(req.params.scenarioId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/scenarios/{scenarioId}/responses:
 *   post:
 *     tags: [Simulation]
 *     summary: Create a patient response for a scenario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scenarioId
 *         required: true
 *         schema:
 *           type: string
 *         description: Scenario ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - actionId
 *               - responseText
 *             properties:
 *               actionId:
 *                 type: string
 *               responseText:
 *                 type: string
 *     responses:
 *       201:
 *         description: Response created
 */
router.post("/scenarios/:scenarioId/responses", authenticate, requireRole("ADMIN", "INSTRUCTOR"), validateBody(createResponseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.createResponse(req.params.scenarioId as string, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Simulation Sessions ─────────────────────────────────────────────────────

/**
 * @swagger
 * /api/simulation/sessions:
 *   get:
 *     tags: [Simulation]
 *     summary: List simulation sessions
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
router.get("/sessions", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listSessions((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/sessions/{id}:
 *   get:
 *     tags: [Simulation]
 *     summary: Get simulation session by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/sessions/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getSessionById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/sessions/start:
 *   post:
 *     tags: [Simulation]
 *     summary: Start a new simulation session
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scenarioId
 *             properties:
 *               scenarioId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Session started
 */
router.post("/sessions/start", authenticate, requireRole("STUDENT"), validateBody(startSessionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.startSession(userId, req.body.scenarioId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/sessions/{id}/action:
 *   post:
 *     tags: [Simulation]
 *     summary: Perform a nursing action in a session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - actionId
 *             properties:
 *               actionId:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Action performed
 */
router.post("/sessions/:id/action", authenticate, requireRole("STUDENT"), validateBody(performActionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const result = await svc.performAction(req.params.id as string, userId, req.body.actionId, req.body.notes);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/sessions/{id}/complete:
 *   post:
 *     tags: [Simulation]
 *     summary: Complete a simulation session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session completed
 */
router.post("/sessions/:id/complete", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.completeSession(req.params.id as string, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Debriefings ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/simulation/sessions/{sessionId}/debriefing:
 *   get:
 *     tags: [Simulation]
 *     summary: Get debriefing for a session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/sessions/:sessionId/debriefing", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getDebriefing(req.params.sessionId as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/simulation/sessions/{sessionId}/debriefing:
 *   post:
 *     tags: [Simulation]
 *     summary: Create a debriefing for a session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - summary
 *             properties:
 *               summary:
 *                 type: string
 *               feedback:
 *                 type: string
 *               score:
 *                 type: number
 *     responses:
 *       201:
 *         description: Debriefing created
 */
router.post("/sessions/:sessionId/debriefing", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(completeSessionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createDebriefing(req.params.sessionId as string, { ...req.body, instructorId: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

export default router;
