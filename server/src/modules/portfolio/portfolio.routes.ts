import { Router, Request, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { ForbiddenError } from "../../middleware/error-handler.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import {
  createPortfolioSchema,
  updatePortfolioSchema,
  createPortfolioItemSchema,
  updatePortfolioItemSchema,
  createReflectionSchema,
  updateReflectionSchema,
  createClinicalExpLogSchema,
  updateClinicalExpLogSchema,
  createAchievementSchema,
  createCertificateSchema,
  updateCertificateSchema,
  createFeedbackSchema,
  updateFeedbackSchema,
  listQuerySchema,
} from "./portfolio.schema.js";
import * as svc from "./portfolio.service.js";

const router = Router();

// Force students to only ever see their own records (IDOR guard)
const scopeToSelf = (req: Request, _res: Response, next: NextFunction) => {
  const user = (req as AuthenticatedRequest).user;
  const q = (req as any).validatedQuery;
  if (user?.role === "STUDENT" && q && typeof q === "object") q.studentId = user.userId;
  next();
};

// ─── Portfolios ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/portfolio/portfolios:
 *   get:
 *     tags: [Portfolio]
 *     summary: List all portfolios
 *     description: Returns a paginated list of portfolios. Supports filtering by studentId, courseId, and isPublished.
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
 *         name: studentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by student ID
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by course ID
 *       - in: query
 *         name: isPublished
 *         schema:
 *           type: boolean
 *         description: Filter by published status
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get("/portfolios", authenticate, validateQuery(listQuerySchema), scopeToSelf, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listPortfolios((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/portfolios/{id}:
 *   get:
 *     tags: [Portfolio]
 *     summary: Get a portfolio by ID
 *     description: Returns a single portfolio with all its details.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Portfolio ID
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Portfolio not found
 */
router.get("/portfolios/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const item = await svc.getPortfolioById(req.params.id as string);
    if (user.role === "STUDENT" && item.studentId !== user.userId) throw new ForbiddenError("Students may only view their own portfolio");
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/portfolios:
 *   post:
 *     tags: [Portfolio]
 *     summary: Create a new portfolio
 *     description: Creates a new portfolio for the authenticated student.
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
 *                 description: Portfolio title
 *               description:
 *                 type: string
 *                 description: Portfolio description
 *     responses:
 *       201:
 *         description: Portfolio created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - student role required
 */
router.post("/portfolios", authenticate, requireRole("STUDENT"), validateBody(createPortfolioSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createPortfolio({ ...req.body, studentId: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/portfolios/{id}:
 *   put:
 *     tags: [Portfolio]
 *     summary: Update a portfolio
 *     description: Updates an existing portfolio. Only the owner student can update.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Portfolio ID
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
 *                 description: Portfolio title
 *               description:
 *                 type: string
 *                 description: Portfolio description
 *               isPublished:
 *                 type: boolean
 *                 description: Whether the portfolio is published
 *     responses:
 *       200:
 *         description: Portfolio updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the portfolio owner
 *       404:
 *         description: Portfolio not found
 */
router.put("/portfolios/:id", authenticate, requireRole("STUDENT"), validateBody(updatePortfolioSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updatePortfolio(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/portfolios/{id}:
 *   delete:
 *     tags: [Portfolio]
 *     summary: Delete a portfolio
 *     description: Deletes a portfolio. Only the owner student can delete.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Portfolio ID
 *     responses:
 *       204:
 *         description: Portfolio deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the portfolio owner
 *       404:
 *         description: Portfolio not found
 */
router.delete("/portfolios/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deletePortfolio(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Portfolio Items ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/portfolio/portfolios/{portfolioId}/items:
 *   get:
 *     tags: [Portfolio]
 *     summary: List portfolio items
 *     description: Returns all items belonging to a specific portfolio.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: portfolioId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Portfolio ID
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get("/portfolios/:portfolioId/items", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (user.role === "STUDENT") {
      const portfolio = await svc.getPortfolioById(req.params.portfolioId as string);
      if (portfolio.studentId !== user.userId) throw new ForbiddenError("Students may only view items from their own portfolio");
    }
    const items = await svc.listPortfolioItems(req.params.portfolioId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/portfolio-items/{id}:
 *   get:
 *     tags: [Portfolio]
 *     summary: Get a portfolio item by ID
 *     description: Returns a single portfolio item with its details.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Portfolio item ID
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Portfolio item not found
 */
router.get("/portfolio-items/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getPortfolioItemById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/portfolios/{portfolioId}/items:
 *   post:
 *     tags: [Portfolio]
 *     summary: Create a portfolio item
 *     description: Adds a new item to the specified portfolio.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: portfolioId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Portfolio ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - itemType
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *                 description: Item title
 *               description:
 *                 type: string
 *                 description: Item description
 *               itemType:
 *                 type: string
 *                 description: Type of portfolio item
 *               content:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Item content as key-value pairs
 *               order:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *                 description: Display order
 *               isPublished:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the item is published
 *     responses:
 *       201:
 *         description: Portfolio item created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - student role required
 */
router.post("/portfolios/:portfolioId/items", authenticate, requireRole("STUDENT"), validateBody(createPortfolioItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.createPortfolioItem(req.params.portfolioId as string, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/portfolio-items/{id}:
 *   put:
 *     tags: [Portfolio]
 *     summary: Update a portfolio item
 *     description: Updates an existing portfolio item. Only the owner student can update.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Portfolio item ID
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
 *                 description: Item title
 *               description:
 *                 type: string
 *                 description: Item description
 *               content:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Item content as key-value pairs
 *               order:
 *                 type: integer
 *                 minimum: 0
 *                 description: Display order
 *               isPublished:
 *                 type: boolean
 *                 description: Whether the item is published
 *     responses:
 *       200:
 *         description: Portfolio item updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the portfolio owner
 *       404:
 *         description: Portfolio item not found
 */
router.put("/portfolio-items/:id", authenticate, requireRole("STUDENT"), validateBody(updatePortfolioItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updatePortfolioItem(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/portfolio-items/{id}:
 *   delete:
 *     tags: [Portfolio]
 *     summary: Delete a portfolio item
 *     description: Deletes a portfolio item. Only the owner student can delete.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Portfolio item ID
 *     responses:
 *       204:
 *         description: Portfolio item deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the portfolio owner
 *       404:
 *         description: Portfolio item not found
 */
router.delete("/portfolio-items/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deletePortfolioItem(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Reflections ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/portfolio/reflections:
 *   get:
 *     tags: [Portfolio]
 *     summary: List all reflections
 *     description: Returns a paginated list of reflections. Supports filtering by studentId, courseId, and isPublished.
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
 *         name: studentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by student ID
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by course ID
 *       - in: query
 *         name: isPublished
 *         schema:
 *           type: boolean
 *         description: Filter by published status
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get("/reflections", authenticate, validateQuery(listQuerySchema), scopeToSelf, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listReflections((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/reflections/{id}:
 *   get:
 *     tags: [Portfolio]
 *     summary: Get a reflection by ID
 *     description: Returns a single reflection with its details.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Reflection ID
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Reflection not found
 */
router.get("/reflections/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getReflectionById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/reflections:
 *   post:
 *     tags: [Portfolio]
 *     summary: Create a new reflection
 *     description: Creates a new reflection for the authenticated student.
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
 *               - content
 *             properties:
 *               courseId:
 *                 type: string
 *                 format: uuid
 *                 description: Associated course ID
 *               clinicalRotationId:
 *                 type: string
 *                 format: uuid
 *                 description: Associated clinical rotation ID
 *               title:
 *                 type: string
 *                 maxLength: 255
 *                 description: Reflection title
 *               content:
 *                 type: string
 *                 description: Reflection content
 *               reflectionType:
 *                 type: string
 *                 default: CLINICAL
 *                 description: Type of reflection
 *               mood:
 *                 type: string
 *                 maxLength: 50
 *                 description: Mood during reflection
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Tags for the reflection
 *               isPublished:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the reflection is published
 *     responses:
 *       201:
 *         description: Reflection created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - student role required
 */
router.post("/reflections", authenticate, requireRole("STUDENT"), validateBody(createReflectionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createReflection({ ...req.body, studentId: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/reflections/{id}:
 *   put:
 *     tags: [Portfolio]
 *     summary: Update a reflection
 *     description: Updates an existing reflection. Only the owner student can update.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Reflection ID
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
 *                 description: Reflection title
 *               content:
 *                 type: string
 *                 description: Reflection content
 *               mood:
 *                 type: string
 *                 maxLength: 50
 *                 description: Mood during reflection
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Tags for the reflection
 *               isPublished:
 *                 type: boolean
 *                 description: Whether the reflection is published
 *     responses:
 *       200:
 *         description: Reflection updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the reflection owner
 *       404:
 *         description: Reflection not found
 */
router.put("/reflections/:id", authenticate, requireRole("STUDENT"), validateBody(updateReflectionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateReflection(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/reflections/{id}:
 *   delete:
 *     tags: [Portfolio]
 *     summary: Delete a reflection
 *     description: Deletes a reflection. Only the owner student can delete.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Reflection ID
 *     responses:
 *       204:
 *         description: Reflection deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the reflection owner
 *       404:
 *         description: Reflection not found
 */
router.delete("/reflections/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteReflection(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Clinical Experience Logs ────────────────────────────────────────────────

/**
 * @swagger
 * /api/portfolio/clinical-exp-logs:
 *   get:
 *     tags: [Portfolio]
 *     summary: List all clinical experience logs
 *     description: Returns a paginated list of clinical experience logs. Supports filtering by studentId, courseId, and isPublished.
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
 *         name: studentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by student ID
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by course ID
 *       - in: query
 *         name: isPublished
 *         schema:
 *           type: boolean
 *         description: Filter by published status
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get("/clinical-exp-logs", authenticate, validateQuery(listQuerySchema), scopeToSelf, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listClinicalExpLogs((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/clinical-exp-logs/{id}:
 *   get:
 *     tags: [Portfolio]
 *     summary: Get a clinical experience log by ID
 *     description: Returns a single clinical experience log with its details.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Clinical experience log ID
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Clinical experience log not found
 */
router.get("/clinical-exp-logs/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getClinicalExpLogById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/clinical-exp-logs:
 *   post:
 *     tags: [Portfolio]
 *     summary: Create a new clinical experience log
 *     description: Creates a new clinical experience log for the authenticated student.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *             properties:
 *               clinicalRotationId:
 *                 type: string
 *                 format: uuid
 *                 description: Associated clinical rotation ID
 *               patientCount:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *                 description: Number of patients seen
 *               proceduresPerformed:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of procedures performed
 *               skillsApplied:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of skills applied
 *               challenges:
 *                 type: string
 *                 description: Challenges faced
 *               learnings:
 *                 type: string
 *                 description: Key learnings
 *               supervisorNotes:
 *                 type: string
 *                 description: Notes from supervisor
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Self-rating from 1 to 5
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: Date of the clinical experience
 *     responses:
 *       201:
 *         description: Clinical experience log created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - student role required
 */
router.post("/clinical-exp-logs", authenticate, requireRole("STUDENT"), validateBody(createClinicalExpLogSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createClinicalExpLog({ ...req.body, studentId: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/clinical-exp-logs/{id}:
 *   put:
 *     tags: [Portfolio]
 *     summary: Update a clinical experience log
 *     description: Updates an existing clinical experience log. Only the owner student can update.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Clinical experience log ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patientCount:
 *                 type: integer
 *                 minimum: 0
 *                 description: Number of patients seen
 *               proceduresPerformed:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of procedures performed
 *               skillsApplied:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of skills applied
 *               challenges:
 *                 type: string
 *                 description: Challenges faced
 *               learnings:
 *                 type: string
 *                 description: Key learnings
 *               supervisorNotes:
 *                 type: string
 *                 description: Notes from supervisor
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Self-rating from 1 to 5
 *     responses:
 *       200:
 *         description: Clinical experience log updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the log owner
 *       404:
 *         description: Clinical experience log not found
 */
router.put("/clinical-exp-logs/:id", authenticate, requireRole("STUDENT"), validateBody(updateClinicalExpLogSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateClinicalExpLog(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/clinical-exp-logs/{id}:
 *   delete:
 *     tags: [Portfolio]
 *     summary: Delete a clinical experience log
 *     description: Deletes a clinical experience log. Only the owner student can delete.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Clinical experience log ID
 *     responses:
 *       204:
 *         description: Clinical experience log deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the log owner
 *       404:
 *         description: Clinical experience log not found
 */
router.delete("/clinical-exp-logs/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteClinicalExpLog(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Achievements ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/portfolio/achievements:
 *   get:
 *     tags: [Portfolio]
 *     summary: List all achievements
 *     description: Returns a paginated list of achievements. Supports filtering by studentId, courseId, and isPublished.
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
 *         name: studentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by student ID
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by course ID
 *       - in: query
 *         name: isPublished
 *         schema:
 *           type: boolean
 *         description: Filter by published status
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get("/achievements", authenticate, validateQuery(listQuerySchema), scopeToSelf, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listAchievements((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/achievements:
 *   post:
 *     tags: [Portfolio]
 *     summary: Create a new achievement
 *     description: Creates a new achievement. Only instructors and coordinators can create achievements.
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
 *               - category
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *                 description: Achievement title
 *               description:
 *                 type: string
 *                 description: Achievement description
 *               category:
 *                 type: string
 *                 description: Achievement category
 *               points:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *                 description: Points awarded for this achievement
 *               metadata:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Additional metadata
 *     responses:
 *       201:
 *         description: Achievement created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - instructor or coordinator role required
 */
router.post("/achievements", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR", "CLINICAL_INSTRUCTOR", "ADMIN"), validateBody(createAchievementSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.createAchievement(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/achievements/{id}:
 *   delete:
 *     tags: [Portfolio]
 *     summary: Delete an achievement
 *     description: Deletes an achievement. Only admins and program coordinators can delete.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Achievement ID
 *     responses:
 *       204:
 *         description: Achievement deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin or program coordinator role required
 *       404:
 *         description: Achievement not found
 */
router.delete("/achievements/:id", authenticate, requireRole("ADMIN", "PROGRAM_COORDINATOR"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.deleteAchievement(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Certificates ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/portfolio/certificates:
 *   get:
 *     tags: [Portfolio]
 *     summary: List all certificates
 *     description: Returns a paginated list of certificates. Supports filtering by studentId, courseId, and isPublished.
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
 *         name: studentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by student ID
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by course ID
 *       - in: query
 *         name: isPublished
 *         schema:
 *           type: boolean
 *         description: Filter by published status
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get("/certificates", authenticate, validateQuery(listQuerySchema), scopeToSelf, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listCertificates((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/certificates/{id}:
 *   get:
 *     tags: [Portfolio]
 *     summary: Get a certificate by ID
 *     description: Returns a single certificate with its details.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Certificate ID
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Certificate not found
 */
router.get("/certificates/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getCertificateById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/certificates:
 *   post:
 *     tags: [Portfolio]
 *     summary: Create a new certificate
 *     description: Creates a new certificate. Only instructors and program coordinators can create certificates.
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
 *               courseId:
 *                 type: string
 *                 format: uuid
 *                 description: Associated course ID
 *               title:
 *                 type: string
 *                 maxLength: 255
 *                 description: Certificate title
 *               description:
 *                 type: string
 *                 description: Certificate description
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Expiration date
 *               metadata:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Additional metadata
 *     responses:
 *       201:
 *         description: Certificate created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - instructor or coordinator role required
 */
router.post("/certificates", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createCertificateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createCertificate({ ...req.body, issuedBy: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/certificates/{id}:
 *   put:
 *     tags: [Portfolio]
 *     summary: Update a certificate
 *     description: Updates an existing certificate. Only admins and program coordinators can update.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Certificate ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, REVOKED, EXPIRED]
 *                 description: Certificate status
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Expiration date
 *     responses:
 *       200:
 *         description: Certificate updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin or program coordinator role required
 *       404:
 *         description: Certificate not found
 */
router.put("/certificates/:id", authenticate, requireRole("ADMIN", "PROGRAM_COORDINATOR"), validateBody(updateCertificateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.updateCertificate(req.params.id as string, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/certificates/{id}/revoke:
 *   post:
 *     tags: [Portfolio]
 *     summary: Revoke a certificate
 *     description: Revokes an existing certificate. Only admins can revoke certificates.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Certificate ID
 *     responses:
 *       200:
 *         description: Certificate revoked
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin role required
 *       404:
 *         description: Certificate not found
 */
router.post("/certificates/:id/revoke", authenticate, requireRole("ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.revokeCertificate(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Feedback ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/portfolio/portfolio-items/{itemId}/feedback:
 *   get:
 *     tags: [Portfolio]
 *     summary: List feedback for a portfolio item
 *     description: Returns all feedback entries for a specific portfolio item.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Portfolio item ID
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get("/portfolio-items/:itemId/feedback", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listFeedback(req.params.itemId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/portfolio-feedback:
 *   post:
 *     tags: [Portfolio]
 *     summary: Create feedback for a portfolio item
 *     description: Creates a new feedback entry for a portfolio item. Only instructors and coordinators can create feedback.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - portfolioItemId
 *               - comments
 *             properties:
 *               portfolioItemId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the portfolio item to review
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating from 1 to 5
 *               comments:
 *                 type: string
 *                 description: Feedback comments
 *               strengths:
 *                 type: string
 *                 description: Identified strengths
 *               improvements:
 *                 type: string
 *                 description: Suggested improvements
 *     responses:
 *       201:
 *         description: Feedback created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - instructor or coordinator role required
 */
router.post("/portfolio-feedback", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR", "CLINICAL_INSTRUCTOR", "ADMIN"), validateBody(createFeedbackSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createFeedback({ ...req.body, reviewerId: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/portfolio-feedback/{id}:
 *   put:
 *     tags: [Portfolio]
 *     summary: Update feedback
 *     description: Updates an existing feedback entry. Only instructors and program coordinators can update.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Feedback ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating from 1 to 5
 *               comments:
 *                 type: string
 *                 description: Feedback comments
 *               strengths:
 *                 type: string
 *                 description: Identified strengths
 *               improvements:
 *                 type: string
 *                 description: Suggested improvements
 *     responses:
 *       200:
 *         description: Feedback updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - instructor or coordinator role required
 *       404:
 *         description: Feedback not found
 */
router.put("/portfolio-feedback/:id", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR"), validateBody(updateFeedbackSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.updateFeedback(req.params.id as string, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/portfolio/portfolio-feedback/{id}:
 *   delete:
 *     tags: [Portfolio]
 *     summary: Delete feedback
 *     description: Deletes a feedback entry. Only instructors and program coordinators can delete.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Feedback ID
 *     responses:
 *       204:
 *         description: Feedback deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - instructor or coordinator role required
 *       404:
 *         description: Feedback not found
 */
router.delete("/portfolio-feedback/:id", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.deleteFeedback(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
