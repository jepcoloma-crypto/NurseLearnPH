import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate, AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import {
  createCategorySchema,
  updateCategorySchema,
  createQuestionSchema,
  updateQuestionSchema,
  createExamSchema,
  updateExamSchema,
  startExamSchema,
  submitExamSchema,
  listQuerySchema,
  practiceQuerySchema,
  checkPracticeSchema,
} from "./nle.schema.js";
import * as svc from "./nle.service.js";

const router = Router();

// Roles that may manage the NLE question bank (mirrors client `nle.manage`)
const nleManager = requireRole("ADMIN", "PROGRAM_COORDINATOR", "INSTRUCTOR", "CLINICAL_INSTRUCTOR");
const NLE_MANAGE_ROLES: string[] = ["ADMIN", "PROGRAM_COORDINATOR", "INSTRUCTOR", "CLINICAL_INSTRUCTOR"];

// ─── Categories ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nle/categories:
 *   get:
 *     tags: [NLE Prep]
 *     summary: List all NLE categories
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/categories", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listCategories();
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/categories/{id}:
 *   get:
 *     tags: [NLE Prep]
 *     summary: Get a category by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category UUID
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Category not found
 */
router.get("/categories/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getCategoryById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/categories:
 *   post:
 *     tags: [NLE Prep]
 *     summary: Create a new NLE category
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
 *               - code
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *               code:
 *                 type: string
 *                 maxLength: 50
 *               parentId:
 *                 type: string
 *                 format: uuid
 *               sortOrder:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       201:
 *         description: Category created
 *       403:
 *         description: Forbidden
 */
router.post("/categories", authenticate, nleManager, validateBody(createCategorySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.createCategory(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/categories/{id}:
 *   put:
 *     tags: [NLE Prep]
 *     summary: Update an NLE category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               sortOrder:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Success
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Category not found
 */
router.put("/categories/:id", authenticate, nleManager, validateBody(updateCategorySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.updateCategory(req.params.id as string, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

router.delete("/categories/:id", authenticate, nleManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.deleteCategory(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Questions ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nle/questions:
 *   get:
 *     tags: [NLE Prep]
 *     summary: List all NLE questions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [EASY, MEDIUM, HARD]
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/questions", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = (req as AuthenticatedRequest).user;
    const includeExplanation = NLE_MANAGE_ROLES.includes(role);
    const result = await svc.listQuestions((req as any).validatedQuery as typeof listQuerySchema._type, includeExplanation);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/questions/{id}:
 *   get:
 *     tags: [NLE Prep]
 *     summary: Get a question by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Question UUID
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Question not found
 */
router.get("/questions/:id", authenticate, nleManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getQuestionById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/questions:
 *   post:
 *     tags: [NLE Prep]
 *     summary: Create a new NLE question
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryId
 *               - questionText
 *               - options
 *             properties:
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               questionText:
 *                 type: string
 *               questionType:
 *                 type: string
 *                 enum: [MC, TF, ESSAY, FILL_BLANK]
 *                 default: MC
 *               difficulty:
 *                 type: string
 *                 enum: [EASY, MEDIUM, HARD]
 *                 default: MEDIUM
 *               explanation:
 *                 type: string
 *               isHighYield:
 *                 type: boolean
 *                 default: false
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               options:
 *                 type: array
 *                 minItems: 2
 *                 items:
 *                   type: object
 *                   required:
 *                     - optionText
 *                   properties:
 *                     optionText:
 *                       type: string
 *                     isCorrect:
 *                       type: boolean
 *                       default: false
 *     responses:
 *       201:
 *         description: Question created
 *       403:
 *         description: Forbidden
 */
router.post("/questions", authenticate, nleManager, validateBody(createQuestionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createQuestion({ ...req.body, createdBy: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/questions/{id}:
 *   put:
 *     tags: [NLE Prep]
 *     summary: Update an NLE question
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Question UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               questionText:
 *                 type: string
 *               difficulty:
 *                 type: string
 *                 enum: [EASY, MEDIUM, HARD]
 *               explanation:
 *                 type: string
 *               isHighYield:
 *                 type: boolean
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Success
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Question not found
 */
router.put("/questions/:id", authenticate, nleManager, validateBody(updateQuestionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.updateQuestion(req.params.id as string, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/questions/{id}:
 *   delete:
 *     tags: [NLE Prep]
 *     summary: Delete an NLE question
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Question UUID
 *     responses:
 *       204:
 *         description: Question deleted
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Question not found
 */
router.delete("/questions/:id", authenticate, nleManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, role } = (req as AuthenticatedRequest).user;
    await svc.deleteQuestion(req.params.id as string, { userId, role });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── AI Suggestion ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nle/questions/suggest:
 *   post:
 *     tags: [NLE Prep]
 *     summary: Generate a random AI question for a category (not saved until created)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryId
 *             properties:
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Suggested question ready to review
 *       403:
 *         description: Forbidden
 */
router.post("/questions/suggest", authenticate, nleManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId } = req.body;
    if (!categoryId) return res.status(400).json({ success: false, error: "categoryId is required" });
    const suggestion = await svc.suggestQuestion(categoryId);
    res.json({ success: true, data: suggestion });
  } catch (err) { next(err); }
});

// ─── Bulk Import ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nle/questions/import:
 *   post:
 *     tags: [NLE Prep]
 *     summary: Bulk import NLE questions from JSON
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - questions
 *             properties:
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - categoryId
 *                     - questionText
 *                     - options
 *                   properties:
 *                     categoryId:
 *                       type: string
 *                       format: uuid
 *                     questionText:
 *                       type: string
 *                     questionType:
 *                       type: string
 *                       enum: [MC, TF]
 *                       default: MC
 *                     difficulty:
 *                       type: string
 *                       enum: [EASY, MEDIUM, HARD]
 *                       default: MEDIUM
 *                     explanation:
 *                       type: string
 *                     isHighYield:
 *                       type: boolean
 *                       default: false
 *                     tags:
 *                       type: array
 *                       items:
 *                         type: string
 *                     options:
 *                       type: array
 *                       minItems: 2
 *                       items:
 *                         type: object
 *                         required:
 *                           - optionText
 *                           - isCorrect
 *                         properties:
 *                           optionText:
 *                             type: string
 *                           isCorrect:
 *                             type: boolean
 *     responses:
 *       200:
 *         description: Import results
 *       403:
 *         description: Forbidden
 */
router.post("/questions/import", authenticate, nleManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: "questions array is required" });
    }
    if (questions.length > 500) {
      return res.status(400).json({ success: false, error: "Maximum 500 questions per import" });
    }
    const result = await svc.bulkImportQuestions(questions, userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ─── AI Generation ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nle/questions/generate:
 *   post:
 *     tags: [NLE Prep]
 *     summary: Generate NLE questions from text content using AI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryId
 *               - content
 *               - count
 *             properties:
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               content:
 *                 type: string
 *                 description: Text content to generate questions from
 *               count:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 50
 *               difficulty:
 *                 type: string
 *                 enum: [EASY, MEDIUM, HARD]
 *               highYieldPercent:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *                 default: 20
 *     responses:
 *       200:
 *         description: Generation results
 *       403:
 *         description: Forbidden
 */
router.post("/questions/generate", authenticate, nleManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const { categoryId, content, count, difficulty, highYieldPercent } = req.body;
    if (!categoryId || !content || !count) {
      return res.status(400).json({ success: false, error: "categoryId, content, and count are required" });
    }
    if (count > 50) {
      return res.status(400).json({ success: false, error: "Maximum 50 questions per generation" });
    }
    const result = await svc.generateQuestionsFromContent(content, {
      categoryId,
      count,
      difficulty,
      highYieldPercent,
    }, userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/questions/generate-from-file:
 *   post:
 *     tags: [NLE Prep]
 *     summary: Generate NLE questions from an uploaded lesson file using AI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - categoryId
 *               - count
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF, DOCX, or TXT file
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               count:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 50
 *               difficulty:
 *                 type: string
 *                 enum: [EASY, MEDIUM, HARD]
 *               highYieldPercent:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *                 default: 20
 *     responses:
 *       200:
 *         description: Generation results
 *       403:
 *         description: Forbidden
 */
router.post("/questions/generate-from-file", authenticate, nleManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;

    // Handle file upload inline
    const { uploadMedia } = await import("../../middleware/upload.js");
    const upload = uploadMedia("documents").single("file");

    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }

      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ success: false, error: "File is required" });
      }

      const { categoryId, count, difficulty, highYieldPercent } = req.body;
      if (!categoryId || !count) {
        return res.status(400).json({ success: false, error: "categoryId and count are required" });
      }

      const fs = await import("fs/promises");
      const fileBuffer = await fs.readFile(file.path);

      const result = await svc.generateQuestionsFromFile(
        fileBuffer,
        file.mimetype,
        file.originalname,
        {
          categoryId,
          count: parseInt(count),
          difficulty,
          highYieldPercent: highYieldPercent ? parseInt(highYieldPercent) : undefined,
        },
        userId
      );

      res.json({ success: true, data: result });
    });
  } catch (err) { next(err); }
});

// ─── Stats ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nle/stats:
 *   get:
 *     tags: [NLE Prep]
 *     summary: Get NLE question bank statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Question bank stats
 */
router.get("/stats", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await svc.getQuestionStats();
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

// ─── Practice ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nle/practice:
 *   get:
 *     tags: [NLE Prep]
 *     summary: Get practice questions for the authenticated student
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [EASY, MEDIUM, HARD]
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *       - in: query
 *         name: highYieldOnly
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Success
 *       403:
 *         description: Forbidden - STUDENT role required
 */
router.post("/practice/check", authenticate, validateBody(checkPracticeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.checkPracticeAnswers(req.body.answers);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get("/practice", authenticate, validateQuery(practiceQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.getPracticeQuestions((req as any).validatedQuery as typeof practiceQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ─── Exams ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nle/exams:
 *   get:
 *     tags: [NLE Prep]
 *     summary: List all NLE exams
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: examType
 *         schema:
 *           type: string
 *           enum: [PRACTICE, MOCK, TIMED]
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/exams", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listExams((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/exams/{id}:
 *   get:
 *     tags: [NLE Prep]
 *     summary: Get an exam by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam UUID
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Exam not found
 */
router.get("/exams/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  // Static routes such as /exams/attempts are registered later — don't swallow them
  if (!z.string().uuid().safeParse(req.params.id).success) return next();
  try {
    const item = await svc.getExamById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/exams:
 *   post:
 *     tags: [NLE Prep]
 *     summary: Create a new NLE exam
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *               examType:
 *                 type: string
 *                 enum: [PRACTICE, MOCK, TIMED]
 *                 default: PRACTICE
 *               categoryFilter:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               questionCount:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 500
 *                 default: 50
 *               timeLimitMinutes:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 480
 *                 default: 90
 *               passingScore:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *                 default: 75
 *               isRandomized:
 *                 type: boolean
 *                 default: true
 *               showExplanations:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Exam created
 *       403:
 *         description: Forbidden
 */
router.post("/exams", authenticate, requireRole("ADMIN", "INSTRUCTOR"), validateBody(createExamSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createExam({ ...req.body, createdBy: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/exams/{id}:
 *   put:
 *     tags: [NLE Prep]
 *     summary: Update an NLE exam
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *               questionCount:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 500
 *               timeLimitMinutes:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 480
 *               passingScore:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *     responses:
 *       200:
 *         description: Success
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Exam not found
 */
router.put("/exams/:id", authenticate, requireRole("ADMIN"), validateBody(updateExamSchema), async (req: Request, res: Response, next: NextFunction) => {
  if (!z.string().uuid().safeParse(req.params.id).success) return res.status(404).json({ success: false, error: { message: "NLE Exam not found" } });
  try {
    const item = await svc.updateExam(req.params.id as string, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Exam Attempts ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/nle/exams/start:
 *   post:
 *     tags: [NLE Prep]
 *     summary: Start an exam attempt
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - examId
 *             properties:
 *               examId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Exam attempt started
 *       403:
 *         description: Forbidden - STUDENT role required
 */
router.post("/exams/start", authenticate, requireRole("STUDENT"), validateBody(startExamSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const result = await svc.startExam(userId, req.body.examId);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/exams/{attemptId}/submit:
 *   post:
 *     tags: [NLE Prep]
 *     summary: Submit answers for an exam attempt
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam attempt UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - answers
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - questionId
 *                   properties:
 *                     questionId:
 *                       type: string
 *                       format: uuid
 *                     selectedOptionId:
 *                       type: string
 *                       format: uuid
 *                     timeSpentSeconds:
 *                       type: integer
 *                       minimum: 0
 *     responses:
 *       200:
 *         description: Exam attempt submitted
 *       403:
 *         description: Forbidden - STUDENT role required
 */
router.post("/exams/:attemptId/submit", authenticate, requireRole("STUDENT"), validateBody(submitExamSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const result = await svc.submitExamAttempt(userId, req.params.attemptId as string, req.body.answers);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/exams/attempts:
 *   get:
 *     tags: [NLE Prep]
 *     summary: List exam attempts for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: examId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter attempts by exam ID
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/exams/attempts", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const examId = req.query.examId as string | undefined;
    const items = await svc.listAttempts(userId, examId);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/exams/attempts/{id}:
 *   get:
 *     tags: [NLE Prep]
 *     summary: Get an exam attempt by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam attempt UUID
 *     responses:
 *       200:
 *         description: Success
 *       403:
 *         description: Access denied - students can only view their own attempts
 *       404:
 *         description: Attempt not found
 */
router.get("/exams/attempts/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const role = (req as AuthenticatedRequest).user.role;
    const item = await svc.getAttemptById(req.params.id as string);
    if (role === "STUDENT" && item.attempt.studentId !== userId) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/exams/attempts/{id}:
 *   delete:
 *     tags: [NLE Prep]
 *     summary: Discard an in-progress exam attempt (owner only)
 *     description: Removes a stuck or abandoned in-progress attempt so the student can restart the exam. Completed attempts cannot be discarded.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam attempt UUID
 *     responses:
 *       204:
 *         description: Attempt discarded
 *       403:
 *         description: Access denied - not the owner or attempt is not in progress
 *       404:
 *         description: Attempt not found
 */
router.delete("/exams/attempts/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.abandonAttempt(userId, req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Performance Analytics ───────────────────────────────────────────────────

/**
 * @swagger
 * /api/nle/performance:
 *   get:
 *     tags: [NLE Prep]
 *     summary: Get performance analytics for the authenticated student
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       403:
 *         description: Forbidden - STUDENT role required
 */
router.get("/performance", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const items = await svc.getStudentPerformance(userId);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/nle/performance/weaknesses:
 *   get:
 *     tags: [NLE Prep]
 *     summary: Get topic weakness analysis for the authenticated student
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       403:
 *         description: Forbidden - STUDENT role required
 */
router.get("/performance/weaknesses", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const items = await svc.getTopicWeaknessAnalysis(userId);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

export default router;
