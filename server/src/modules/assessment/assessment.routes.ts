import { Router, Request, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import {
  createQuestionSchema,
  updateQuestionSchema,
  createAssessmentSchema,
  updateAssessmentSchema,
  submitAttemptSchema,
  gradeAttemptSchema,
  listQuerySchema,
  listAttemptsQuerySchema,
  gradebookQuerySchema,
} from "./assessment.schema.js";
import * as svc from "./assessment.service.js";

const router = Router();

// ─── Questions ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/assessment/questions:
 *   get:
 *     tags: [Assessments]
 *     summary: List all questions
 *     description: Retrieve a paginated list of questions with optional filters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter questions
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by course ID
 *       - in: query
 *         name: topicId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by topic ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [MC, TF, ESSAY, FILL_BLANK, SCENARIO]
 *         description: Filter by question type
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [EASY, MEDIUM, HARD]
 *         description: Filter by difficulty level
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Paginated list of questions
 *       401:
 *         description: Unauthorized
 */
router.get("/questions", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listQuestions((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/assessment/questions/{id}:
 *   get:
 *     tags: [Assessments]
 *     summary: Get a question by ID
 *     description: Retrieve a single question with its options.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Question ID
 *     responses:
 *       200:
 *         description: Question found
 *       404:
 *         description: Question not found
 */
router.get("/questions/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getQuestionById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/assessment/questions:
 *   post:
 *     tags: [Assessments]
 *     summary: Create a new question
 *     description: Create a question with options. Requires INSTRUCTOR or ADMIN role.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [courseId, type, stem]
 *             properties:
 *               courseId:
 *                 type: string
 *                 format: uuid
 *                 description: Course this question belongs to
 *               topicId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional topic association
 *               type:
 *                 type: string
 *                 enum: [MC, TF, ESSAY, FILL_BLANK, SCENARIO]
 *                 description: Question type
 *               difficulty:
 *                 type: string
 *                 enum: [EASY, MEDIUM, HARD]
 *                 default: MEDIUM
 *               stem:
 *                 type: string
 *                 description: The question text
 *               explanation:
 *                 type: string
 *                 description: Optional explanation for the answer
 *               points:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *               options:
 *                 type: array
 *                 minItems: 2
 *                 description: Answer options (required for MC questions)
 *                 items:
 *                   type: object
 *                   required: [text, isCorrect]
 *                   properties:
 *                     text:
 *                       type: string
 *                     isCorrect:
 *                       type: boolean
 *                     order:
 *                       type: integer
 *                       minimum: 0
 *                       default: 0
 *     responses:
 *       201:
 *         description: Question created
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden - requires INSTRUCTOR or ADMIN role
 */
router.post("/questions", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createQuestionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createQuestion(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/assessment/questions/{id}:
 *   put:
 *     tags: [Assessments]
 *     summary: Update a question
 *     description: Update question fields. Requires INSTRUCTOR or ADMIN role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Question ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topicId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               type:
 *                 type: string
 *                 enum: [MC, TF, ESSAY, FILL_BLANK, SCENARIO]
 *               difficulty:
 *                 type: string
 *                 enum: [EASY, MEDIUM, HARD]
 *               stem:
 *                 type: string
 *               explanation:
 *                 type: string
 *               points:
 *                 type: integer
 *                 minimum: 1
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Question updated
 *       404:
 *         description: Question not found
 *       403:
 *         description: Forbidden - requires INSTRUCTOR or ADMIN role
 */
router.put("/questions/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateQuestionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateQuestion(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/assessment/questions/{id}:
 *   delete:
 *     tags: [Assessments]
 *     summary: Delete a question
 *     description: Soft-delete a question. Requires INSTRUCTOR or ADMIN role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Question ID
 *     responses:
 *       204:
 *         description: Question deleted
 *       403:
 *         description: Forbidden - requires INSTRUCTOR or ADMIN role
 *       404:
 *         description: Question not found
 */
router.delete("/questions/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteQuestion(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/assessment/questions/{id}/toggle-status:
 *   patch:
 *     tags: [Questions]
 *     summary: Toggle question active status
 *     description: Toggle a question between active and inactive.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Question ID
 *     responses:
 *       200:
 *         description: Status toggled
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Question not found
 */
router.patch("/questions/:id/toggle-status", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const updated = await svc.toggleQuestionStatus(req.params.id as string, userId);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ─── Assessments ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/assessment/assessments:
 *   get:
 *     tags: [Assessments]
 *     summary: List all assessments
 *     description: Retrieve a paginated list of assessments with optional filters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter assessments
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by course ID
 *       - in: query
 *         name: topicId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by topic ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [QUIZ, EXAM, ASSIGNMENT]
 *         description: Filter by assessment type
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [EASY, MEDIUM, HARD]
 *         description: Filter by difficulty level
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Paginated list of assessments
 *       401:
 *         description: Unauthorized
 */
router.get("/assessments", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, role } = (req as AuthenticatedRequest).user;
    const query = (req as any).validatedQuery as typeof listQuerySchema._type;
    const result = await svc.listAssessments({ ...query, publishedOnly: role === "STUDENT", studentId: role === "STUDENT" ? userId : undefined });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/assessment/assessments/{id}:
 *   get:
 *     tags: [Assessments]
 *     summary: Get an assessment by ID
 *     description: Retrieve a single assessment with its associated questions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Assessment ID
 *     responses:
 *       200:
 *         description: Assessment found
 *       404:
 *         description: Assessment not found
 */
router.get("/assessments/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, role } = (req as AuthenticatedRequest).user;
    const item = await svc.getAssessmentById(req.params.id as string, role === "STUDENT" ? userId : undefined);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/assessment/assessments:
 *   post:
 *     tags: [Assessments]
 *     summary: Create a new assessment
 *     description: Create an assessment and optionally link existing questions. Requires INSTRUCTOR or ADMIN role.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [courseId, title]
 *             properties:
 *               courseId:
 *                 type: string
 *                 format: uuid
 *                 description: Course this assessment belongs to
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Assessment title
 *               description:
 *                 type: string
 *                 description: Optional description
 *               type:
 *                 type: string
 *                 enum: [QUIZ, EXAM, ASSIGNMENT]
 *                 default: QUIZ
 *               timeLimitMinutes:
 *                 type: integer
 *                 minimum: 1
 *                 nullable: true
 *                 description: Time limit in minutes (null for no limit)
 *               passingScore:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *                 default: 75
 *               maxAttempts:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *               questionIds:
 *                 type: array
 *                 description: Optional list of question IDs to link
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       201:
 *         description: Assessment created
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden - requires INSTRUCTOR or ADMIN role
 */
router.post("/assessments", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createAssessmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createAssessment(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/assessment/assessments/{id}:
 *   put:
 *     tags: [Assessments]
 *     summary: Update an assessment
 *     description: Update assessment fields. Requires INSTRUCTOR or ADMIN role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Assessment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [QUIZ, EXAM, ASSIGNMENT]
 *               timeLimitMinutes:
 *                 type: integer
 *                 minimum: 1
 *                 nullable: true
 *               passingScore:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *               maxAttempts:
 *                 type: integer
 *                 minimum: 1
 *               isPublished:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Assessment updated
 *       404:
 *         description: Assessment not found
 *       403:
 *         description: Forbidden - requires INSTRUCTOR or ADMIN role
 */
router.put("/assessments/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateAssessmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateAssessment(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/assessment/assessments/{id}:
 *   delete:
 *     tags: [Assessments]
 *     summary: Delete an assessment
 *     description: Soft-delete an assessment. Requires INSTRUCTOR or ADMIN role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Assessment ID
 *     responses:
 *       204:
 *         description: Assessment deleted
 *       403:
 *         description: Forbidden - requires INSTRUCTOR or ADMIN role
 *       404:
 *         description: Assessment not found
 */
router.delete("/assessments/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteAssessment(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Student Attempts ────────────────────────────────────────────────────────

router.get("/my-attempts", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const items = await svc.getStudentAttempts(userId);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/assessment/assessments/{assessmentId}/start:
 *   post:
 *     tags: [Assessments]
 *     summary: Start an assessment attempt
 *     description: Begin a new attempt for a published assessment. Requires STUDENT role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Assessment ID
 *     responses:
 *       201:
 *         description: Attempt started
 *       400:
 *         description: Attempt limit reached or assessment not published
 *       403:
 *         description: Forbidden - requires STUDENT role
 *       404:
 *         description: Assessment not found
 */
router.post("/assessments/:assessmentId/start", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.startAttempt(req.params.assessmentId as string, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/assessment/attempts/{attemptId}:
 *   get:
 *     tags: [Assessments]
 *     summary: Get attempt with questions
 *     description: Retrieve an in-progress attempt with its questions (without answers). Requires STUDENT role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Attempt ID
 *     responses:
 *       200:
 *         description: Attempt with questions
 *       403:
 *         description: Forbidden - requires STUDENT role
 *       404:
 *         description: Attempt not found
 */
router.get("/attempts/:attemptId", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.getAttemptWithQuestions(req.params.attemptId as string, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/assessment/attempts/{attemptId}/submit:
 *   post:
 *     tags: [Assessments]
 *     summary: Submit an assessment attempt
 *     description: Submit answers for an in-progress attempt. Requires STUDENT role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Attempt ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answers]
 *             properties:
 *               answers:
 *                 type: array
 *                 description: List of student answers
 *                 items:
 *                   type: object
 *                   required: [questionId]
 *                   properties:
 *                     questionId:
 *                       type: string
 *                       format: uuid
 *                       description: Question ID
 *                     selectedOptionId:
 *                       type: string
 *                       format: uuid
 *                       nullable: true
 *                       description: Selected option ID (for MC/TF questions)
 *                     textAnswer:
 *                       type: string
 *                       nullable: true
 *                       description: Free-text answer (for ESSAY/FILL_BLANK questions)
 *     responses:
 *       200:
 *         description: Attempt submitted and graded
 *       400:
 *         description: Invalid submission
 *       403:
 *         description: Forbidden - requires STUDENT role
 *       404:
 *         description: Attempt not found
 */
router.post("/attempts/:attemptId/submit", authenticate, requireRole("STUDENT"), validateBody(submitAttemptSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.submitAttempt(req.params.attemptId as string, userId, req.body.answers);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/assessment/attempts/{attemptId}/result:
 *   get:
 *     tags: [Assessments]
 *     summary: Get attempt result
 *     description: Retrieve the graded result of a completed attempt. Requires STUDENT role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Attempt ID
 *     responses:
 *       200:
 *         description: Attempt result with score and feedback
 *       403:
 *         description: Forbidden - requires STUDENT role
 *       404:
 *         description: Attempt not found
 */
router.get("/attempts/:attemptId/result", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.getAttemptResult(req.params.attemptId as string, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Instructor Grading ──────────────────────────────────────────────────────

/**
 * @swagger
 * /api/assessment/attempts/{attemptId}/grade:
 *   post:
 *     tags: [Assessments]
 *     summary: Grade an assessment attempt
 *     description: Manually grade or override scores for an attempt. Requires INSTRUCTOR or PROGRAM_COORDINATOR role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Attempt ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answers]
 *             properties:
 *               answers:
 *                 type: array
 *                 description: Graded answers with scores and feedback
 *                 items:
 *                   type: object
 *                   required: [questionId]
 *                   properties:
 *                     questionId:
 *                       type: string
 *                       format: uuid
 *                       description: Question ID
 *                     selectedOptionId:
 *                       type: string
 *                       format: uuid
 *                       nullable: true
 *                       description: Selected option ID
 *                     textAnswer:
 *                       type: string
 *                       nullable: true
 *                       description: Free-text answer
 *     responses:
 *       200:
 *         description: Attempt graded
 *       400:
 *         description: Invalid grading data
 *       403:
 *         description: Forbidden - requires INSTRUCTOR or PROGRAM_COORDINATOR role
 *       404:
 *         description: Attempt not found
 */
router.post("/attempts/:attemptId/grade", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR"), validateBody(gradeAttemptSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.gradeAttempt(req.params.attemptId as string, userId, req.body.answers);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Instructor Gradebook ────────────────────────────────────────────────────

router.get("/attempts", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateQuery(listAttemptsQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = (req as unknown as { validatedQuery: typeof listAttemptsQuerySchema._type }).validatedQuery;
    const result = await svc.listAttempts(query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get("/gradebook", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateQuery(gradebookQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = (req as unknown as { validatedQuery: typeof gradebookQuerySchema._type }).validatedQuery;
    const result = await svc.getCourseGradebook(query.courseId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/assessments/gradebook/full:
 *   get:
 *     tags: [Gradebook]
 *     summary: Get comprehensive course gradebook (assessments + clinical cases + skills)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full gradebook data
 */
router.get("/gradebook/full", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateQuery(gradebookQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = (req as unknown as { validatedQuery: typeof gradebookQuerySchema._type }).validatedQuery;
    const result = await svc.getFullGradebook(query.courseId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

export default router;
