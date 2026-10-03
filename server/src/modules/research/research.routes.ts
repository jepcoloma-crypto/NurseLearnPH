import { Router, Request, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import {
  createProjectSchema,
  createCohortSchema,
  createStudySchema,
  enrollParticipantSchema,
  recordPrePostTestSchema,
  exportDataSchema,
  listQuerySchema,
  updateProjectSchema,
} from "./research.schema.js";
import * as svc from "./research.service.js";

const router = Router();

// ─── Projects ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/research/projects:
 *   get:
 *     tags: [Research]
 *     summary: List all research projects
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
router.get("/projects", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listProjects((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/research/projects/{id}:
 *   get:
 *     tags: [Research]
 *     summary: Get a research project by ID
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
router.get("/projects/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getProjectById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/research/projects:
 *   post:
 *     tags: [Research]
 *     summary: Create a research project
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               methodology: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/projects", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createProjectSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createProject({ ...req.body, principalInvestigator: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/research/projects/{id}:
 *   put:
 *     tags: [Research]
 *     summary: Update a research project
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
 *               title: { type: string }
 *               status: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put("/projects/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateProjectSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, role } = (req as AuthenticatedRequest).user;
    const item = await svc.updateProject(req.params.id as string, req.body, { userId, role });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Cohorts ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/research/projects/{projectId}/cohorts:
 *   get:
 *     tags: [Research]
 *     summary: List cohorts for a project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/projects/:projectId/cohorts", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listCohorts(req.params.projectId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/research/cohorts:
 *   post:
 *     tags: [Research]
 *     summary: Create a cohort
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projectId: { type: string, format: uuid }
 *               name: { type: string }
 *               size: { type: integer }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/cohorts", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createCohortSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.createCohort(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Studies ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/research/projects/{projectId}/studies:
 *   get:
 *     tags: [Research]
 *     summary: List studies for a project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/projects/:projectId/studies", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listStudies(req.params.projectId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/research/studies:
 *   post:
 *     tags: [Research]
 *     summary: Create a study
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projectId: { type: string, format: uuid }
 *               title: { type: string }
 *               type: { type: string, enum: [PRE_POST, QUASI_EXPERIMENTAL, RANDOMIZED_CONTROLLED] }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/studies", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createStudySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.createStudy(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Participants ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/research/studies/{studyId}/participants:
 *   get:
 *     tags: [Research]
 *     summary: List participants in a study
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studyId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/studies/:studyId/participants", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listParticipants(req.params.studyId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/research/studies/{studyId}/enroll:
 *   post:
 *     tags: [Research]
 *     summary: Enroll a participant in a study
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studyId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cohortId: { type: string, format: uuid }
 *               groupAssignment: { type: string, enum: [CONTROL, EXPERIMENTAL] }
 *     responses:
 *       201:
 *         description: Enrolled
 */
router.post("/studies/:studyId/enroll", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(enrollParticipantSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.enrollParticipant(req.params.studyId as string, req.body.cohortId, req.body.groupAssignment);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Pre/Post Tests ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/research/pre-post-tests:
 *   post:
 *     tags: [Research]
 *     summary: Record a pre/post test result
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               studyId: { type: string, format: uuid }
 *               participantId: { type: string, format: uuid }
 *               type: { type: string, enum: [PRE, POST] }
 *               score: { type: number }
 *     responses:
 *       201:
 *         description: Recorded
 */
router.post("/pre-post-tests", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(recordPrePostTestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.recordPrePostTest({ ...req.body, administeredBy: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/research/studies/{studyId}/analysis:
 *   get:
 *     tags: [Research]
 *     summary: Get pre/post test analysis for a study
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studyId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Analysis results
 */
router.get("/studies/:studyId/analysis", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.getStudyPrePostAnalysis(req.params.studyId as string);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ─── Data Exports ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/research/exports:
 *   post:
 *     tags: [Research]
 *     summary: Export research data
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projectId: { type: string, format: uuid }
 *               format: { type: string, enum: [CSV, JSON, SPSS] }
 *     responses:
 *       201:
 *         description: Export created
 */
router.post("/exports", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(exportDataSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const result = await svc.exportData({ ...req.body, exportedBy: userId });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/research/projects/{projectId}/exports:
 *   get:
 *     tags: [Research]
 *     summary: List exports for a project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/projects/:projectId/exports", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listExports(req.params.projectId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

// ─── Deletion ────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/research/projects/{id}:
 *   delete:
 *     tags: [Research]
 *     summary: Delete a research project and all of its data
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Deleted
 *       403:
 *         description: Forbidden
 */
router.delete("/projects/:id", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, role } = (req as AuthenticatedRequest).user;
    const item = await svc.deleteProject(req.params.id as string, { userId, role });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/research/cohorts/{id}:
 *   delete:
 *     tags: [Research]
 *     summary: Delete a cohort (linked studies and participants are unlinked, not removed)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Deleted
 *       403:
 *         description: Forbidden
 */
router.delete("/cohorts/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, role } = (req as AuthenticatedRequest).user;
    const item = await svc.deleteCohort(req.params.id as string, { userId, role });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/research/studies/{id}:
 *   delete:
 *     tags: [Research]
 *     summary: Delete a study with its participants and pre/post test records
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Deleted
 *       403:
 *         description: Forbidden
 */
router.delete("/studies/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, role } = (req as AuthenticatedRequest).user;
    const item = await svc.deleteStudy(req.params.id as string, { userId, role });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

export default router;
