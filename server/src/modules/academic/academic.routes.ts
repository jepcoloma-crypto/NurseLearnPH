import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../middleware/auth.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import * as svc from "./academic.service.js";
import {
  createProgramSchema,
  updateProgramSchema,
  createAcademicYearSchema,
  updateAcademicYearSchema,
  createSemesterSchema,
  updateSemesterSchema,
  createYearLevelSchema,
  createSectionSchema,
  createCourseSchema,
  updateCourseSchema,
  enrollStudentSchema,
  updateEnrollmentSchema,
  createLearningOutcomeSchema,
  updateLearningOutcomeSchema,
  listQuerySchema,
  assignStudentSectionSchema,
  listStudentSectionQuerySchema,
} from "./academic.schema.js";

const router = Router();
const adminOrCoordinator = requireRole("ADMIN", "PROGRAM_COORDINATOR");
const enrollmentViewer = requireRole("ADMIN", "PROGRAM_COORDINATOR", "INSTRUCTOR");
// Staff who may browse the full course catalog
const courseViewer = requireRole("ADMIN", "PROGRAM_COORDINATOR", "INSTRUCTOR", "CLINICAL_INSTRUCTOR");

// ─── Programs ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/academic/programs:
 *   get:
 *     tags: [Academic]
 *     summary: List all academic programs
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
router.get("/programs", authenticate, adminOrCoordinator, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listPrograms((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/programs/{id}:
 *   get:
 *     tags: [Academic]
 *     summary: Get a program by ID
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
router.get("/programs/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getProgramById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/programs:
 *   post:
 *     tags: [Academic]
 *     summary: Create an academic program
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
 *               code: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/programs", authenticate, adminOrCoordinator, validateBody(createProgramSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createProgram(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/programs/{id}:
 *   put:
 *     tags: [Academic]
 *     summary: Update an academic program
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
router.put("/programs/:id", authenticate, adminOrCoordinator, validateBody(updateProgramSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateProgram(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/programs/{id}:
 *   delete:
 *     tags: [Academic]
 *     summary: Delete an academic program
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
 */
router.delete("/programs/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteProgram(req.params.id as string, userId);
    res.json({ success: true, data: { message: "Program deleted" } });
  } catch (err) { next(err); }
});

// ─── Academic Years ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/academic/academic-years:
 *   get:
 *     tags: [Academic]
 *     summary: List all academic years
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
router.get("/academic-years", authenticate, adminOrCoordinator, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listAcademicYears((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/academic-years/{id}:
 *   get:
 *     tags: [Academic]
 *     summary: Get an academic year by ID
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
router.get("/academic-years/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getAcademicYearById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/academic-years:
 *   post:
 *     tags: [Academic]
 *     summary: Create an academic year
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               year: { type: string, example: "2026-2027" }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/academic-years", authenticate, adminOrCoordinator, validateBody(createAcademicYearSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createAcademicYear(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/academic-years/{id}:
 *   put:
 *     tags: [Academic]
 *     summary: Update an academic year
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
 *               year: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put("/academic-years/:id", authenticate, adminOrCoordinator, validateBody(updateAcademicYearSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateAcademicYear(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

router.delete("/academic-years/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteAcademicYear(req.params.id as string, userId);
    res.json({ success: true, data: { message: "Academic year deleted" } });
  } catch (err) { next(err); }
});

// ─── Semesters ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/academic/semesters:
 *   get:
 *     tags: [Academic]
 *     summary: List all semesters
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
router.get("/semesters", authenticate, adminOrCoordinator, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listSemesters((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/semesters/{id}:
 *   get:
 *     tags: [Academic]
 *     summary: Get a semester by ID
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
router.get("/semesters/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getSemesterById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/semesters:
 *   post:
 *     tags: [Academic]
 *     summary: Create a semester
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               academicYearId: { type: string, format: uuid }
 *               name: { type: string }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/semesters", authenticate, adminOrCoordinator, validateBody(createSemesterSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createSemester(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/semesters/{id}:
 *   put:
 *     tags: [Academic]
 *     summary: Update a semester
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
router.put("/semesters/:id", authenticate, adminOrCoordinator, validateBody(updateSemesterSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateSemester(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

router.delete("/semesters/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteSemester(req.params.id as string, userId);
    res.json({ success: true, data: { message: "Semester deleted" } });
  } catch (err) { next(err); }
});

// ─── Year Levels ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/academic/year-levels:
 *   get:
 *     tags: [Academic]
 *     summary: List all year levels
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
router.get("/year-levels", authenticate, adminOrCoordinator, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listYearLevels((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/year-levels/{id}:
 *   get:
 *     tags: [Academic]
 *     summary: Get a year level by ID
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
router.get("/year-levels/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getYearLevelById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/year-levels:
 *   post:
 *     tags: [Academic]
 *     summary: Create a year level
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               programId: { type: string, format: uuid }
 *               level: { type: integer }
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/year-levels", authenticate, adminOrCoordinator, validateBody(createYearLevelSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createYearLevel(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

router.put("/year-levels/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateYearLevel(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

router.delete("/year-levels/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteYearLevel(req.params.id as string, userId);
    res.json({ success: true, data: { message: "Year level deleted" } });
  } catch (err) { next(err); }
});

// ─── Sections ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/academic/sections:
 *   get:
 *     tags: [Academic]
 *     summary: List all sections
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
router.get("/sections", authenticate, adminOrCoordinator, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listSections((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/sections/{id}:
 *   get:
 *     tags: [Academic]
 *     summary: Get a section by ID
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
router.get("/sections/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getSectionById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/sections:
 *   post:
 *     tags: [Academic]
 *     summary: Create a section
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               yearLevelId: { type: string, format: uuid }
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/sections", authenticate, adminOrCoordinator, validateBody(createSectionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createSection(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

router.put("/sections/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateSection(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

router.delete("/sections/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteSection(req.params.id as string, userId);
    res.json({ success: true, data: { message: "Section deleted" } });
  } catch (err) { next(err); }
});

// ─── Courses ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/academic/courses:
 *   get:
 *     tags: [Academic]
 *     summary: List all courses
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
router.get("/courses", authenticate, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const query = { ...((req as any).validatedQuery as typeof listQuerySchema._type) };

    if (user.role === "STUDENT") {
      // Students only see courses they are actively enrolled in
      query.studentId = user.userId;
    } else if (!["ADMIN", "PROGRAM_COORDINATOR", "INSTRUCTOR", "CLINICAL_INSTRUCTOR"].includes(user.role)) {
      res.status(403).json({ success: false, error: { message: "Insufficient permissions", code: "FORBIDDEN" } });
      return;
    }

    const result = await svc.listCourses(query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/courses/{id}:
 *   get:
 *     tags: [Academic]
 *     summary: Get a course by ID
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
router.get("/courses/:id", authenticate, enrollmentViewer, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getCourseById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/courses:
 *   post:
 *     tags: [Academic]
 *     summary: Create a course
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               programId: { type: string, format: uuid }
 *               code: { type: string }
 *               name: { type: string }
 *               description: { type: string }
 *               credits: { type: integer }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/courses", authenticate, adminOrCoordinator, validateBody(createCourseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createCourse(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/courses/{id}:
 *   put:
 *     tags: [Academic]
 *     summary: Update a course
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
router.put("/courses/:id", authenticate, adminOrCoordinator, validateBody(updateCourseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateCourse(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/courses/{id}:
 *   delete:
 *     tags: [Academic]
 *     summary: Delete a course
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
 */
router.delete("/courses/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteCourse(req.params.id as string, userId);
    res.json({ success: true, data: { message: "Course deleted" } });
  } catch (err) { next(err); }
});

// ─── Enrollments ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/academic/enrollments:
 *   get:
 *     tags: [Academic]
 *     summary: List all enrollments
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
router.get("/enrollments", authenticate, enrollmentViewer, validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = (req as any).validatedQuery as typeof listQuerySchema._type;
    // Instructors only ever see enrollments in their own courses; ignore spoofed filters
    if ((req as AuthenticatedRequest).user.role === "INSTRUCTOR") {
      query.instructorId = (req as AuthenticatedRequest).user.userId;
    }
    const result = await svc.listEnrollments(query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/enrollments:
 *   post:
 *     tags: [Academic]
 *     summary: Enroll a student in a course section
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               studentId: { type: string, format: uuid }
 *               sectionId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Enrolled
 */
router.post("/enrollments", authenticate, adminOrCoordinator, validateBody(enrollStudentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.enrollStudent(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/enrollments/{id}:
 *   delete:
 *     tags: [Academic]
 *     summary: Unenroll a student
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Unenrolled
 */
router.put("/enrollments/:id", authenticate, adminOrCoordinator, validateBody(updateEnrollmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateEnrollmentSection(req.params.id as string, req.body.sectionId, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

router.delete("/enrollments/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.unenrollStudent(req.params.id as string, userId);
    res.json({ success: true, data: { message: "Student unenrolled" } });
  } catch (err) { next(err); }
});

// ─── Learning Outcomes ───────────────────────────────────────────────────────

/**
 * @swagger
 * /api/academic/courses/{courseId}/outcomes:
 *   get:
 *     tags: [Academic]
 *     summary: List learning outcomes for a course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/courses/:courseId/outcomes", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listLearningOutcomes(req.params.courseId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/courses/{courseId}/outcomes:
 *   post:
 *     tags: [Academic]
 *     summary: Create a learning outcome for a course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
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
 *               level: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/courses/:courseId/outcomes", authenticate, adminOrCoordinator, validateBody(createLearningOutcomeSchema.omit({ courseId: true })), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createLearningOutcome({ ...req.body, courseId: req.params.courseId as string }, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/outcomes/{id}:
 *   put:
 *     tags: [Academic]
 *     summary: Update a learning outcome
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
router.put("/outcomes/:id", authenticate, adminOrCoordinator, validateBody(updateLearningOutcomeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateLearningOutcome(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/outcomes/{id}:
 *   delete:
 *     tags: [Academic]
 *     summary: Delete a learning outcome
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
 */
router.delete("/outcomes/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteLearningOutcome(req.params.id as string, userId);
    res.json({ success: true, data: { message: "Learning outcome deleted" } });
  } catch (err) { next(err); }
});

// ─── Student Sections ────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/academic/student-sections:
 *   get:
 *     tags: [Academic]
 *     summary: List student-section assignments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: sectionId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: studentId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: academicYearId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/student-sections", authenticate, adminOrCoordinator, validateQuery(listStudentSectionQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listStudentSections((req as any).validatedQuery as typeof listStudentSectionQuerySchema._type);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/student-sections:
 *   post:
 *     tags: [Academic]
 *     summary: Assign a student to a section
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentId, sectionId, academicYearId]
 *             properties:
 *               studentId: { type: string, format: uuid }
 *               sectionId: { type: string, format: uuid }
 *               academicYearId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Assigned
 */
router.post("/student-sections", authenticate, adminOrCoordinator, validateBody(assignStudentSectionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.assignStudentSection(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/student-sections/{id}:
 *   delete:
 *     tags: [Academic]
 *     summary: Remove a student from a section
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Removed
 */
router.delete("/student-sections/:id", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.removeStudentSection(req.params.id as string, userId);
    res.json({ success: true, data: { message: "Student removed from section" } });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/academic/sections/{sectionId}/students:
 *   get:
 *     tags: [Academic]
 *     summary: List all students in a section
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/sections/:sectionId/students", authenticate, adminOrCoordinator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.getStudentsBySection(req.params.sectionId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

export default router;
