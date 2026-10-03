import { Router, Request, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import {
  chatSchema,
  hintSchema,
  socraticSchema,
  lessonAssistSchema,
  listQuerySchema,
} from "./ai-tutor.schema.js";
import * as svc from "./ai-tutor.service.js";

const router = Router();

// ─── Chat ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/ai-tutor/chat:
 *   post:
 *     tags: [AI Tutor]
 *     summary: Send a message to the AI tutor
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string }
 *               context: { type: string }
 *               lessonId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: AI response
 */
router.post("/chat", authenticate, requireRole("STUDENT"), validateBody(chatSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const result = await svc.chat({ ...req.body, studentId: userId });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ─── Conversations ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/ai-tutor/conversations:
 *   get:
 *     tags: [AI Tutor]
 *     summary: List AI tutor conversations
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
router.get("/conversations", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listConversations((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/ai-tutor/conversations/{id}:
 *   get:
 *     tags: [AI Tutor]
 *     summary: Get a conversation by ID
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
router.get("/conversations/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.getConversationById(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ─── Hints ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/ai-tutor/hint:
 *   post:
 *     tags: [AI Tutor]
 *     summary: Get an AI hint for a question
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               questionId: { type: string, format: uuid }
 *               context: { type: string }
 *     responses:
 *       200:
 *         description: Hint
 */
router.post("/hint", authenticate, requireRole("STUDENT"), validateBody(hintSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.getHint(req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/ai-tutor/hints:
 *   get:
 *     tags: [AI Tutor]
 *     summary: List available hints
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: topic
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/hints", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const topic = req.query.topic as string | undefined;
    const items = await svc.listHints(topic);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/ai-tutor/hints:
 *   post:
 *     tags: [AI Tutor]
 *     summary: Create a new hint (admin/instructor)
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
 *               content: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/hints", authenticate, requireRole("ADMIN", "INSTRUCTOR"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.createHint(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Socratic Mode ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/ai-tutor/socratic/start:
 *   post:
 *     tags: [AI Tutor]
 *     summary: Start a Socratic questioning session
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
 *         description: Session started
 */
router.post("/socratic/start", authenticate, requireRole("STUDENT"), validateBody(socraticSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const result = await svc.startSocraticSession({ ...req.body, studentId: userId });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/ai-tutor/socratic/questions:
 *   get:
 *     tags: [AI Tutor]
 *     summary: List Socratic questions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: topic
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/socratic/questions", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const topic = req.query.topic as string | undefined;
    const items = await svc.listSocraticQuestions(topic);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/ai-tutor/socratic/questions:
 *   post:
 *     tags: [AI Tutor]
 *     summary: Create a Socratic question (admin/instructor)
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
 *               question: { type: string }
 *               followUp: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/socratic/questions", authenticate, requireRole("ADMIN", "INSTRUCTOR"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.createSocraticQuestion(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Lesson Assistance ───────────────────────────────────────────────────────

/**
 * @swagger
 * /api/ai-tutor/lesson-assist:
 *   post:
 *     tags: [AI Tutor]
 *     summary: Get AI assistance for a lesson
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lessonId: { type: string, format: uuid }
 *               question: { type: string }
 *     responses:
 *       200:
 *         description: Assistance response
 */
router.post("/lesson-assist", authenticate, requireRole("STUDENT"), validateBody(lessonAssistSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const result = await svc.getLessonAssistance({ ...req.body, studentId: userId });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

export default router;
