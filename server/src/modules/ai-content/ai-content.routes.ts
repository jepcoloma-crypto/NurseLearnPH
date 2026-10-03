import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate, AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import {
  generateQuestionSchema,
  reviewQuestionSchema,
  generateCaseSchema,
  reviewCaseSchema,
  generateStudyGuideSchema,
  reviewStudyGuideSchema,
  updateQuestionSchema,
  updateCaseSchema,
  updateStudyGuideSchema,
  listQuerySchema,
  analyzeFileSchema,
} from "./ai-content.schema.js";
import * as svc from "./ai-content.service.js";

const router = Router();

// ─── Questions ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/ai-content/questions:
 *   get:
 *     tags: [AI Content]
 *     summary: List AI-generated questions
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
router.get("/questions", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listQuestions((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/ai-content/questions/generate:
 *   post:
 *     tags: [AI Content]
 *     summary: Generate questions using AI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topic: { type: string }
 *               count: { type: integer }
 *               difficulty: { type: string, enum: [EASY, MEDIUM, HARD] }
 *               type: { type: string, enum: [MC, TF, SAQ, NCLEX] }
 *     responses:
 *       201:
 *         description: Questions generated
 */
router.post("/questions/generate", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(generateQuestionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const items = await svc.generateQuestions({ ...req.body, generatedBy: userId });
    res.status(201).json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/ai-content/questions/{id}/review:
 *   post:
 *     tags: [AI Content]
 *     summary: Review an AI-generated question
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
 *               status: { type: string, enum: [APPROVED, REJECTED, NEEDS_REVISION] }
 *               feedback: { type: string }
 *     responses:
 *       200:
 *         description: Review recorded
 */
router.post("/questions/:id/review", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(reviewQuestionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.reviewQuestion(req.params.id as string, { ...req.body, reviewedBy: userId });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Cases ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/ai-content/cases:
 *   get:
 *     tags: [AI Content]
 *     summary: List AI-generated clinical cases
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
router.get("/cases", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listCases((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/ai-content/cases/generate:
 *   post:
 *     tags: [AI Content]
 *     summary: Generate a clinical case using AI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topic: { type: string }
 *               difficulty: { type: string }
 *               specialty: { type: string }
 *     responses:
 *       201:
 *         description: Case generated
 */
router.post("/cases/generate", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(generateCaseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.generateCase({ ...req.body, generatedBy: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/ai-content/cases/{id}/review:
 *   post:
 *     tags: [AI Content]
 *     summary: Review an AI-generated case
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
 *               status: { type: string, enum: [APPROVED, REJECTED, NEEDS_REVISION] }
 *               feedback: { type: string }
 *     responses:
 *       200:
 *         description: Review recorded
 */
router.post("/cases/:id/review", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(reviewCaseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.reviewCase(req.params.id as string, { ...req.body, reviewedBy: userId });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Study Guides ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/ai-content/study-guides:
 *   get:
 *     tags: [AI Content]
 *     summary: List AI-generated study guides
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
router.get("/study-guides", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listStudyGuides((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/ai-content/study-guides/generate:
 *   post:
 *     tags: [AI Content]
 *     summary: Generate a study guide using AI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topic: { type: string }
 *               lessonId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Study guide generated
 */
router.post("/study-guides/generate", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(generateStudyGuideSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.generateStudyGuide({ ...req.body, generatedBy: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/ai-content/study-guides/{id}/review:
 *   post:
 *     tags: [AI Content]
 *     summary: Review an AI-generated study guide
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
 *               status: { type: string, enum: [APPROVED, REJECTED, NEEDS_REVISION] }
 *               feedback: { type: string }
 *     responses:
 *       200:
 *         description: Review recorded
 */
router.post("/study-guides/:id/review", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(reviewStudyGuideSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.reviewStudyGuide(req.params.id as string, { ...req.body, reviewedBy: userId });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/ai-content/questions/{id}:
 *   put:
 *     tags: [AI Content]
 *     summary: Edit an AI-generated question (PENDING/REVISION_NEEDED → back to PENDING)
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
 *               topic: { type: string }
 *               questionText: { type: string }
 *               options: { type: array, items: { type: string } }
 *               correctAnswer: { type: string }
 *               explanation: { type: string }
 *               difficulty: { type: string, enum: [EASY, MEDIUM, HARD] }
 *     responses:
 *       200:
 *         description: Question updated
 *       409:
 *         description: Content is not editable in its current status
 */
router.put("/questions/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateQuestionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateQuestion(req.params.id as string, { ...req.body, editedBy: userId });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/ai-content/cases/{id}:
 *   put:
 *     tags: [AI Content]
 *     summary: Edit an AI-generated clinical case (PENDING/REVISION_NEEDED → back to PENDING)
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
 *               description: { type: string }
 *               clinicalPresentation: { type: string }
 *               difficulty: { type: string, enum: [EASY, MEDIUM, HARD] }
 *               stages: { type: array, items: { type: object } }
 *               learningObjectives: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Case updated
 *       409:
 *         description: Content is not editable in its current status
 */
router.put("/cases/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateCaseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateCase(req.params.id as string, { ...req.body, editedBy: userId });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/ai-content/study-guides/{id}:
 *   put:
 *     tags: [AI Content]
 *     summary: Edit an AI-generated study guide (PENDING/REVISION_NEEDED → back to PENDING)
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
 *               content: { type: string }
 *               summary: { type: string }
 *               keyPoints: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Study guide updated
 *       409:
 *         description: Content is not editable in its current status
 */
router.put("/study-guides/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateStudyGuideSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateStudyGuide(req.params.id as string, { ...req.body, editedBy: userId });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Approval History ────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/ai-content/approval-history/{contentType}/{contentId}:
 *   get:
 *     tags: [AI Content]
 *     summary: Get approval history for AI-generated content
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentType
 *         required: true
 *         schema: { type: string, enum: [question, case, study_guide] }
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/approval-history/:contentType/:contentId", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listApprovalHistory(req.params.contentType as string, req.params.contentId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

// ─── File Analysis (Gemini Multimodal) ──────────────────────────────────────

/**
 * @swagger
 * /api/ai-content/analyze-file:
 *   post:
 *     tags: [AI Content]
 *     summary: Analyze an uploaded file using Gemini AI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fileName, mimeType, fileBase64]
 *             properties:
 *               fileName: { type: string }
 *               mimeType: { type: string }
 *               fileBase64: { type: string }
 *     responses:
 *       200:
 *         description: Analyzed content with summary, concepts, and objectives
 */
router.post("/analyze-file", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(analyzeFileSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileName, mimeType, fileBase64 } = req.body;
    const fileBuffer = Buffer.from(fileBase64, "base64");
    const result = await svc.analyzeUploadedFile(fileBuffer, mimeType, fileName);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ─── AI Tutor Chat ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/ai-content/tutor-chat:
 *   post:
 *     tags: [AI Content]
 *     summary: Chat with AI tutor using Gemini
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string }
 *               lessonContext: { type: string }
 *     responses:
 *       200:
 *         description: AI tutor response
 */
router.post("/tutor-chat", authenticate, validateBody(z.object({ message: z.string().min(1), lessonContext: z.string().optional() })), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, lessonContext } = req.body;
    const { generateTutorResponse } = await import("../../services/gemini.service.js");
    const response = await generateTutorResponse(message, [], lessonContext);
    res.json({ success: true, data: { response } });
  } catch (err) { next(err); }
});

export default router;
