import { Router, Request, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import {
  createSkillSchema,
  updateSkillSchema,
  createChecklistSchema,
  createStationSchema,
  updateStationSchema,
  createAssessmentSchema,
  updateAssessmentSchema,
  submitChecklistSchema,
  listQuerySchema,
} from "./skills-lab.schema.js";
import * as svc from "./skills-lab.service.js";

const router = Router();

// ─── Skills ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/skills-lab/skills:
 *   get:
 *     tags: [Skills Lab]
 *     summary: List all skills
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
router.get("/skills", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listSkills((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/skills/{id}:
 *   get:
 *     tags: [Skills Lab]
 *     summary: Get a skill by ID
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
router.get("/skills/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getSkillById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/skills:
 *   post:
 *     tags: [Skills Lab]
 *     summary: Create a skill
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
 *               category: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/skills", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createSkillSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createSkill(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/skills/{id}:
 *   put:
 *     tags: [Skills Lab]
 *     summary: Update a skill
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
router.put("/skills/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateSkillSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateSkill(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/skills/{id}:
 *   delete:
 *     tags: [Skills Lab]
 *     summary: Delete a skill
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
router.delete("/skills/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteSkill(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/skills/{id}/toggle-status:
 *   patch:
 *     tags: [Skills Lab]
 *     summary: Toggle skill active status
 *     description: Toggle a skill between active and inactive.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Status toggled
 *       404:
 *         description: Skill not found
 */
router.patch("/skills/:id/toggle-status", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const updated = await svc.toggleSkillStatus(req.params.id as string, userId);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ─── Checklists ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/skills-lab/skills/{skillId}/checklists:
 *   post:
 *     tags: [Skills Lab]
 *     summary: Add a checklist to a skill
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: skillId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/skills/:skillId/checklists", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createChecklistSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.addChecklist(req.params.skillId as string, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/checklists/{id}:
 *   delete:
 *     tags: [Skills Lab]
 *     summary: Remove a checklist
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
router.delete("/checklists/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.removeChecklist(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Stations ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/skills-lab/stations:
 *   get:
 *     tags: [Skills Lab]
 *     summary: List all stations
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
router.get("/stations", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listStations((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/stations/{id}:
 *   get:
 *     tags: [Skills Lab]
 *     summary: Get a station by ID
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
router.get("/stations/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getStationById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/stations:
 *   post:
 *     tags: [Skills Lab]
 *     summary: Create a station
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
 *               skillId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/stations", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createStationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createStation(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/stations/{id}:
 *   put:
 *     tags: [Skills Lab]
 *     summary: Update a station
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
router.put("/stations/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateStationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateStation(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/stations/{id}:
 *   delete:
 *     tags: [Skills Lab]
 *     summary: Delete a station
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
router.delete("/stations/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteStation(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Assessments ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/skills-lab/assessments:
 *   get:
 *     tags: [Skills Lab]
 *     summary: List all skills lab assessments
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
router.get("/assessments", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listAssessments((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/assessments/{id}:
 *   get:
 *     tags: [Skills Lab]
 *     summary: Get a skills lab assessment by ID
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
router.get("/assessments/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getAssessmentById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/assessments:
 *   post:
 *     tags: [Skills Lab]
 *     summary: Create a skills lab assessment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stationId: { type: string, format: uuid }
 *               studentId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/assessments", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR"), validateBody(createAssessmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createAssessment(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/assessments/{id}:
 *   put:
 *     tags: [Skills Lab]
 *     summary: Update a skills lab assessment
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
 *               score: { type: number }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put("/assessments/:id", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR"), validateBody(updateAssessmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateAssessment(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/assessments/{assessmentId}/checklist:
 *   post:
 *     tags: [Skills Lab]
 *     summary: Submit checklist evaluation for an assessment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items: { type: array, items: { type: object, properties: { label: { type: string }, checked: { type: boolean } } } }
 *     responses:
 *       200:
 *         description: Checklist submitted
 */
router.post("/assessments/:assessmentId/checklist", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(submitChecklistSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.submitChecklist(req.params.assessmentId as string, req.body.items);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Student Skills ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/skills-lab/students/{studentId}/skills:
 *   get:
 *     tags: [Skills Lab]
 *     summary: Get skills for a student
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
router.get("/students/:studentId/skills", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.getStudentSkills(req.params.studentId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/students/{studentId}/skills/{skillId}/sign-off:
 *   post:
 *     tags: [Skills Lab]
 *     summary: Sign off a skill for a student
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: skillId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Skill signed off
 */
router.post("/students/:studentId/skills/:skillId/sign-off", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.signOffSkill(req.params.studentId as string, req.params.skillId as string, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Student Self-Practice Routes ─────────────────────────────────────────────

/**
 * @swagger
 * /api/skills-lab/my-skills:
 *   get:
 *     tags: [Skills Lab]
 *     summary: Get current student's skills with details and checklists
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Student's skills with checklists
 */
router.get("/my-skills", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const items = await svc.getStudentSkillsWithDetails(userId);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/my-skills/{skillId}/practice:
 *   post:
 *     tags: [Skills Lab]
 *     summary: Log a practice session for a skill
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checkedItems:
 *                 type: array
 *                 items:
 *                   type: string
 */
router.post("/my-skills/:skillId/practice", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.practiceSkill(userId, req.params.skillId as string, req.body.checkedItems ?? []);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/my-skills/{skillId}/request-assessment:
 *   post:
 *     tags: [Skills Lab]
 *     summary: Request instructor assessment for a skill
 *     security:
 *       - bearerAuth: []
 */
router.post("/my-skills/:skillId/request-assessment", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.requestAssessment(userId, req.params.skillId as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/pending-assessments:
 *   get:
 *     tags: [Skills Lab]
 *     summary: Get students pending skill assessment requests (instructor view)
 *     security:
 *       - bearerAuth: []
 */
router.get("/pending-assessments", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.getPendingAssessments();
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/assessments/from-request/{studentSkillId}:
 *   post:
 *     tags: [Skills Lab]
 *     summary: Create assessment from a pending student request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentSkillId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Assessment created
 */
router.post("/assessments/from-request/:studentSkillId", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const assessment = await svc.createAssessmentFromRequest(req.params.studentSkillId as string, userId);
    res.status(201).json({ success: true, data: assessment });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/assessments/{id}/details:
 *   get:
 *     tags: [Skills Lab]
 *     summary: Get assessment details with checklist items and student's practice data
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Assessment details
 */
router.get("/assessments/:id/details", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const details = await svc.getAssessmentDetails(req.params.id as string);
    res.json({ success: true, data: details });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/skills-lab/assessments/{id}/grade:
 *   post:
 *     tags: [Skills Lab]
 *     summary: Grade assessment checklist items and complete it
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
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     checklistId: { type: string }
 *                     isCompleted: { type: boolean }
 *                     notes: { type: string }
 *                     pointsAwarded: { type: number }
 *               feedback: { type: string }
 *               isCompetent: { type: boolean }
 *     responses:
 *       200:
 *         description: Assessment graded and completed
 */
router.post("/assessments/:id/grade", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items, feedback, isCompetent } = req.body;
    const result = await svc.gradeAndCompleteAssessment(req.params.id as string, items, feedback ?? "", isCompetent ?? false);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

export default router;
