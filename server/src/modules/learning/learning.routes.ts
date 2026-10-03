import { Router, Request, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import { createChildLogger } from "../../utils/logger.js";
import {
  createTopicSchema,
  updateTopicSchema,
  createLessonSchema,
  updateLessonSchema,
  createMaterialSchema,
  updateMaterialSchema,
  createActivitySchema,
  updateActivitySchema,
  updateProgressSchema,
  listQuerySchema,
} from "./learning.schema.js";
import * as svc from "./learning.service.js";

const logger = createChildLogger("learning-routes");
const router = Router();

// ─── Topics ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/learning/topics:
 *   get:
 *     tags: [Learning]
 *     summary: List all topics
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
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: topicId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Paginated list of topics
 */
router.get("/topics", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listTopics((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/topics/{id}:
 *   get:
 *     tags: [Learning]
 *     summary: Get a topic by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Topic details
 */
router.get("/topics/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getTopicById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/topics:
 *   post:
 *     tags: [Learning]
 *     summary: Create a new topic
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [courseId, name]
 *             properties:
 *               courseId:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *               order:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *     responses:
 *       201:
 *         description: Topic created
 */
router.post("/topics", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createTopicSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createTopic(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/topics/{id}:
 *   put:
 *     tags: [Learning]
 *     summary: Update a topic
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *               order:
 *                 type: integer
 *                 minimum: 0
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Topic updated
 */
router.put("/topics/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateTopicSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateTopic(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/topics/{id}:
 *   delete:
 *     tags: [Learning]
 *     summary: Delete a topic
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Topic deleted
 */
router.delete("/topics/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteTopic(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Lessons ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/learning/lessons:
 *   get:
 *     tags: [Learning]
 *     summary: List all lessons
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
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: topicId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Paginated list of lessons
 */
router.get("/lessons", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listLessons((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/lessons/{id}:
 *   get:
 *     tags: [Learning]
 *     summary: Get a lesson by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lesson details
 */
router.get("/lessons/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getLessonById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/lessons/{id}/full:
 *   get:
 *     tags: [Learning]
 *     summary: Get a lesson with all content (materials + activities)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Full lesson details including materials and activities
 */
router.get("/lessons/:id/full", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getLessonWithContent(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/lessons:
 *   post:
 *     tags: [Learning]
 *     summary: Create a new lesson
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [topicId, title]
 *             properties:
 *               topicId:
 *                 type: string
 *                 format: uuid
 *               title:
 *                 type: string
 *                 maxLength: 255
 *               content:
 *                 type: string
 *               order:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *     responses:
 *       201:
 *         description: Lesson created
 */
router.post("/lessons", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createLessonSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createLesson(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/lessons/{id}:
 *   put:
 *     tags: [Learning]
 *     summary: Update a lesson
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *               content:
 *                 type: string
 *               order:
 *                 type: integer
 *                 minimum: 0
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Lesson updated
 */
router.put("/lessons/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateLessonSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateLesson(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/lessons/{id}:
 *   delete:
 *     tags: [Learning]
 *     summary: Delete a lesson
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Lesson deleted
 */
router.delete("/lessons/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteLesson(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Materials ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/learning/lessons/{lessonId}/materials:
 *   get:
 *     tags: [Learning]
 *     summary: List materials for a lesson
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of lesson materials
 */
router.get("/lessons/:lessonId/materials", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listMaterials(req.params.lessonId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/lessons/{lessonId}/materials:
 *   post:
 *     tags: [Learning]
 *     summary: Create a material for a lesson
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, type]
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *               type:
 *                 type: string
 *                 enum: [TEXT, VIDEO, DOCUMENT, LINK, IMAGE]
 *               content:
 *                 type: string
 *               url:
 *                 type: string
 *                 format: uri
 *               filePath:
 *                 type: string
 *               order:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *               isRequired:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Material created
 */
router.post("/lessons/:lessonId/materials", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createMaterialSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createMaterial(req.params.lessonId as string, req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/materials/{id}:
 *   put:
 *     tags: [Learning]
 *     summary: Update a material
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *               type:
 *                 type: string
 *                 enum: [TEXT, VIDEO, DOCUMENT, LINK, IMAGE]
 *               content:
 *                 type: string
 *               url:
 *                 type: string
 *                 format: uri
 *               filePath:
 *                 type: string
 *               order:
 *                 type: integer
 *                 minimum: 0
 *               isRequired:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Material updated
 */
router.put("/materials/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateMaterialSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateMaterial(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/materials/{id}:
 *   delete:
 *     tags: [Learning]
 *     summary: Delete a material
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Material deleted
 */
router.delete("/materials/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteMaterial(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Activities ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/learning/lessons/{lessonId}/activities:
 *   get:
 *     tags: [Learning]
 *     summary: List activities for a lesson
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of lesson activities
 */
router.get("/lessons/:lessonId/activities", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listActivities(req.params.lessonId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/lessons/{lessonId}/activities:
 *   post:
 *     tags: [Learning]
 *     summary: Create an activity for a lesson
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, type]
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *               type:
 *                 type: string
 *                 enum: [READING, VIDEO_WATCH, QUIZ, REFLECTION, CASE_STUDY, DISCUSSION, PRACTICE, ASSIGNMENT]
 *               description:
 *                 type: string
 *               instructions:
 *                 type: string
 *               config:
 *                 type: object
 *               points:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *               order:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *               isRequired:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Activity created
 */
router.post("/lessons/:lessonId/activities", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createActivitySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createActivity(req.params.lessonId as string, req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/activities/{id}:
 *   put:
 *     tags: [Learning]
 *     summary: Update an activity
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *               type:
 *                 type: string
 *                 enum: [READING, VIDEO_WATCH, QUIZ, REFLECTION, CASE_STUDY, DISCUSSION, PRACTICE, ASSIGNMENT]
 *               description:
 *                 type: string
 *               instructions:
 *                 type: string
 *               config:
 *                 type: object
 *               points:
 *                 type: integer
 *                 minimum: 0
 *               order:
 *                 type: integer
 *                 minimum: 0
 *               isRequired:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Activity updated
 */
router.put("/activities/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateActivitySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateActivity(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/activities/{id}:
 *   delete:
 *     tags: [Learning]
 *     summary: Delete an activity
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Activity deleted
 */
router.delete("/activities/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteActivity(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Student Progress ────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/learning/progress/me/{lessonId}:
 *   get:
 *     tags: [Learning]
 *     summary: Get current student's progress for a lesson
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Student progress for the lesson
 */
router.get("/progress/me/:lessonId", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.getStudentProgress(userId, req.params.lessonId as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/progress/me/course/{courseId}:
 *   get:
 *     tags: [Learning]
 *     summary: Get current student's progress for a course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Student course progress summary
 */
router.get("/progress/me/course/:courseId", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.getStudentCourseProgress(userId, req.params.courseId as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/learning/progress/me:
 *   post:
 *     tags: [Learning]
 *     summary: Upsert current student's progress
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lessonId, status]
 *             properties:
 *               lessonId:
 *                 type: string
 *                 format: uuid
 *               status:
 *                 type: string
 *                 enum: [NOT_STARTED, IN_PROGRESS, COMPLETED]
 *               timeSpentSeconds:
 *                 type: integer
 *                 minimum: 0
 *               score:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Progress upserted
 */
router.post("/progress/me", authenticate, requireRole("STUDENT"), validateBody(updateProgressSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.upsertProgress(userId, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── File Upload ─────────────────────────────────────────────────────────────

import { uploadMedia } from "../../middleware/upload.js";

/**
 * @swagger
 * /api/learning/upload:
 *   post:
 *     tags: [Learning]
 *     summary: Upload a file (document, image, or video)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               dest:
 *                 type: string
 *                 enum: [documents, images, videos]
 *                 default: documents
 *     responses:
 *       200:
 *         description: File uploaded
 */
router.post("/upload", authenticate, requireRole("INSTRUCTOR", "ADMIN", "PROGRAM_COORDINATOR"), (req: Request, res: Response, next: NextFunction) => {
  const dest = (req.query.dest as string) || "documents";
  const upload = uploadMedia(dest).single("file");
  upload(req, res, function (err) {
    if (err) {
      next(err);
      return;
    }
    const file = (req as any).file;
    if (!file) {
      res.status(400).json({ success: false, error: "No file provided" });
      return;
    }
    const sub = dest === "images" ? "images" : dest === "videos" ? "videos" : "documents";
    res.json({
      success: true,
      data: {
        filePath: `/storage/${sub}/${file.filename}`,
        url: `/storage/${sub}/${file.filename}`,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      },
    });
  });
});

export default router;
