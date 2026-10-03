import { Router, Request, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { ForbiddenError } from "../../middleware/error-handler.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import {
  createRotationSchema,
  updateRotationSchema,
  createPatientAssignmentSchema,
  markAttendanceSchema,
  completeRotationSchema,
  updateCompletionSchema,
  createClinicalLogSchema,
  updateClinicalLogSchema,
  reviewClinicalLogSchema,
  createEvaluationSchema,
  updateEvaluationSchema,
  listQuerySchema,
} from "./clinical-rle.schema.js";
import * as svc from "./clinical-rle.service.js";

const router = Router();

const STAFF_ROLES: string[] = ["INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"];

// ─── Rotations ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/clinical-rle/rotations:
 *   get:
 *     tags: [Clinical RLE]
 *     summary: List all clinical rotations
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
router.get("/rotations", authenticate, requireRole(...STAFF_ROLES), validateQuery(listQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.listRotations((req as any).validatedQuery as typeof listQuerySchema._type);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/rotations/{id}:
 *   get:
 *     tags: [Clinical RLE]
 *     summary: Get a rotation by ID
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
router.get("/rotations/:id", authenticate, requireRole(...STAFF_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getRotationById(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/rotations:
 *   post:
 *     tags: [Clinical RLE]
 *     summary: Create a clinical rotation
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
 *               courseId: { type: string, format: uuid }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/rotations", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR"), validateBody(createRotationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createRotation(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/rotations/{id}:
 *   put:
 *     tags: [Clinical RLE]
 *     summary: Update a clinical rotation
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
router.put("/rotations/:id", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR"), validateBody(updateRotationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateRotation(req.params.id as string, req.body, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/rotations/{id}:
 *   delete:
 *     tags: [Clinical RLE]
 *     summary: Delete a clinical rotation
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
router.delete("/rotations/:id", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    await svc.deleteRotation(req.params.id as string, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/rotations/{rotationId}/completion-summary:
 *   get:
 *     tags: [Clinical RLE]
 *     summary: Per-student hours and attendance summary used to verify a rotation before completion
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rotationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Completion summary
 */
router.get("/rotations/:rotationId/completion-summary", authenticate, requireRole(...STAFF_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.getCompletionSummary(req.params.rotationId as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/rotations/{rotationId}/complete:
 *   post:
 *     tags: [Clinical RLE]
 *     summary: Mark a rotation as COMPLETED (optionally selecting which students are completed)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rotationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               studentIds:
 *                 type: array
 *                 description: Students to mark completed. Omit to mark all assigned students.
 *                 items: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Rotation completed with summary
 *       409:
 *         description: Already completed or cancelled
 */
router.post("/rotations/:rotationId/complete", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(completeRotationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const result = await svc.completeRotation(req.params.rotationId as string, userId, req.body.studentIds as string[] | undefined);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/rotations/{rotationId}/completion:
 *   put:
 *     tags: [Clinical RLE]
 *     summary: Adjust which students are marked completed for a COMPLETED rotation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rotationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentIds]
 *             properties:
 *               studentIds:
 *                 type: array
 *                 description: Full set of student IDs to mark completed (unlisted assigned students are unmarked).
 *                 items: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Completion selection updated with summary
 *       409:
 *         description: Rotation is not COMPLETED yet
 */
router.put("/rotations/:rotationId/completion", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateCompletionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const summary = await svc.updateRotationCompletion(req.params.rotationId as string, req.body.studentIds, userId);
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
});

// ─── Rotation Students ──────────────────────────────────────────────────────

/**
 * @swagger
 * /api/clinical-rle/rotations/{rotationId}/students:
 *   get:
 *     tags: [Clinical RLE]
 *     summary: List students assigned to a rotation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rotationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of students
 */
router.get("/rotations/:rotationId/students", authenticate, requireRole(...STAFF_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listRotationStudents(req.params.rotationId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/rotations/{rotationId}/students:
 *   post:
 *     tags: [Clinical RLE]
 *     summary: Assign students to a rotation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rotationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               studentIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Students assigned
 */
router.post("/rotations/:rotationId/students", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const result = await svc.assignStudentsToRotation(req.params.rotationId as string, req.body.studentIds ?? [], userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/rotations/{rotationId}/students/{studentId}:
 *   delete:
 *     tags: [Clinical RLE]
 *     summary: Remove a student from a rotation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rotationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Student removed
 */
router.delete("/rotations/:rotationId/students/:studentId", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.removeStudentFromRotation(req.params.rotationId as string, req.params.studentId as string);
    res.json({ success: true, data: { removed: true } });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/rotations/{rotationId}/details:
 *   get:
 *     tags: [Clinical RLE]
 *     summary: Get rotation with students and instructor details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rotationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Rotation details with students
 */
router.get("/rotations/:rotationId/details", authenticate, requireRole(...STAFF_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const details = await svc.getRotationWithStudents(req.params.rotationId as string);
    res.json({ success: true, data: details });
  } catch (err) { next(err); }
});

// ─── Patient Assignments ─────────────────────────────────────────────────────

/**
 * @swagger
 * /api/clinical-rle/rotations/{rotationId}/patients:
 *   get:
 *     tags: [Clinical RLE]
 *     summary: List patient assignments for a rotation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rotationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: studentId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/rotations/:rotationId/patients", authenticate, requireRole(...STAFF_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await svc.listPatientAssignments(req.params.rotationId as string, req.query.studentId as string);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/patients:
 *   post:
 *     tags: [Clinical RLE]
 *     summary: Create a patient assignment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rotationId: { type: string, format: uuid }
 *               studentId: { type: string, format: uuid }
 *               patientName: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/patients", authenticate, requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR"), validateBody(createPatientAssignmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.createPatientAssignment(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/patients/{id}/release:
 *   post:
 *     tags: [Clinical RLE]
 *     summary: Release a patient assignment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Released
 */
router.post("/patients/:id/release", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.releasePatientAssignment(req.params.id as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Attendance ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/clinical-rle/rotations/{rotationId}/attendance:
 *   get:
 *     tags: [Clinical RLE]
 *     summary: List attendance records for a rotation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rotationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: studentId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/rotations/:rotationId/attendance", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    // Students may only read their own attendance records
    const studentId = user.role === "STUDENT" ? user.userId : (req.query.studentId as string);
    const items = await svc.listAttendance(req.params.rotationId as string, studentId);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/attendance:
 *   post:
 *     tags: [Clinical RLE]
 *     summary: Mark attendance for a student
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rotationId: { type: string, format: uuid }
 *               studentId: { type: string, format: uuid }
 *               date: { type: string, format: date }
 *               status: { type: string, enum: [PRESENT, ABSENT, LATE, EXCUSED] }
 *     responses:
 *       201:
 *         description: Recorded
 */
router.post("/attendance", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(markAttendanceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.markAttendance(req.body, userId);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/rotations/{rotationId}/students/{studentId}/hours:
 *   get:
 *     tags: [Clinical RLE]
 *     summary: Get total clinical hours for a student in a rotation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rotationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/rotations/:rotationId/students/:studentId/hours", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (user.role === "STUDENT" && user.userId !== req.params.studentId) {
      next(new ForbiddenError("Students may only view their own hours"));
      return;
    }
    const item = await svc.getStudentHours(req.params.rotationId as string, req.params.studentId as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Batch Attendance ───────────────────────────────────────────────────────

/**
 * @swagger
 * /api/clinical-rle/attendance/batch:
 *   post:
 *     tags: [Clinical RLE]
 *     summary: Mark attendance for multiple students at once
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rotationId: { type: string, format: uuid }
 *               date: { type: string, format: date }
 *               records:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     studentId: { type: string, format: uuid }
 *                     status: { type: string, enum: [PRESENT, ABSENT, LATE, EXCUSED] }
 *                     hoursLogged: { type: number }
 *                     notes: { type: string }
 *     responses:
 *       201:
 *         description: Recorded
 */
router.post("/attendance/batch", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const { rotationId, date, records } = req.body;
    if (!rotationId || !date || !Array.isArray(records) || records.length === 0) {
      res.status(400).json({ success: false, error: { message: "rotationId, date, and records array are required", code: "VALIDATION_ERROR" } });
      return;
    }
    const results = await Promise.all(
      records.map((r: { studentId: string; status: string; hoursLogged?: number; notes?: string }) =>
        svc.markAttendance({ rotationId, studentId: r.studentId, date, status: r.status, hoursLogged: r.hoursLogged, notes: r.notes }, userId)
      )
    );
    res.status(201).json({ success: true, data: { count: results.length, records: results } });
  } catch (err) { next(err); }
});

// ─── Student Rotations (for student view) ───────────────────────────────────

/**
 * @swagger
 * /api/clinical-rle/my-rotations:
 *   get:
 *     tags: [Clinical RLE]
 *     summary: Get rotations assigned to the current student
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/my-rotations", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const items = await svc.getStudentRotations(userId);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

// ─── Clinical Logs ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/clinical-rle/rotations/{rotationId}/logs:
 *   get:
 *     tags: [Clinical RLE]
 *     summary: List clinical logs for a rotation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rotationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: studentId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/rotations/:rotationId/logs", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    // Students may only read their own clinical logs
    const studentId = user.role === "STUDENT" ? user.userId : undefined;
    const items = await svc.listRotationLogs(req.params.rotationId as string, studentId);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/logs:
 *   post:
 *     tags: [Clinical RLE]
 *     summary: Create a clinical log entry
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rotationId: { type: string, format: uuid }
 *               patientName: { type: string }
 *               procedure: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/logs", authenticate, requireRole("STUDENT"), validateBody(createClinicalLogSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createClinicalLog({ ...req.body, studentId: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/logs/{id}:
 *   put:
 *     tags: [Clinical RLE]
 *     summary: Edit a clinical log (owner only, while SUBMITTED)
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
 *           schema: { type: object }
 *     responses:
 *       200:
 *         description: Updated
 *       403:
 *         description: Not the owner
 *   delete:
 *     tags: [Clinical RLE]
 *     summary: Delete a clinical log (owner only, while SUBMITTED)
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
 *         description: Not the owner
 */
router.put("/logs/:id", authenticate, requireRole("STUDENT"), validateBody(updateClinicalLogSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.updateClinicalLog(req.params.id as string, userId, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

router.delete("/logs/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.deleteClinicalLog(req.params.id as string, userId);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/logs/{id}/review:
 *   post:
 *     tags: [Clinical RLE]
 *     summary: Review a clinical log (instructor feedback)
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
 *               feedback: { type: string }
 *     responses:
 *       200:
 *         description: Review recorded
 */
router.post("/logs/:id/review", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(reviewClinicalLogSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.reviewClinicalLog(req.params.id as string, userId, req.body.feedback);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// ─── Evaluations ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/clinical-rle/rotations/{rotationId}/evaluations:
 *   get:
 *     tags: [Clinical RLE]
 *     summary: List evaluations for a rotation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rotationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: studentId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/rotations/:rotationId/evaluations", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    // Students may only read their own evaluations
    const studentId = user.role === "STUDENT" ? user.userId : (req.query.studentId as string);
    const items = await svc.listEvaluations(req.params.rotationId as string, studentId);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/evaluations:
 *   post:
 *     tags: [Clinical RLE]
 *     summary: Create a clinical evaluation
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rotationId: { type: string, format: uuid }
 *               studentId: { type: string, format: uuid }
 *               score: { type: number }
 *               comments: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/evaluations", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(createEvaluationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const item = await svc.createEvaluation({ ...req.body, instructorId: userId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/evaluations/{id}:
 *   put:
 *     tags: [Clinical RLE]
 *     summary: Edit an existing evaluation (instructor)
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
 *           schema: { type: object }
 *     responses:
 *       200:
 *         description: Updated
 *       404:
 *         description: Not found
 */
router.put("/evaluations/:id", authenticate, requireRole("INSTRUCTOR", "CLINICAL_INSTRUCTOR", "PROGRAM_COORDINATOR", "ADMIN"), validateBody(updateEvaluationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await svc.updateEvaluation(req.params.id as string, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/rotations/{rotationId}/students/{studentId}/summary:
 *   get:
 *     tags: [Clinical RLE]
 *     summary: Get student rotation summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rotationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/rotations/:rotationId/students/:studentId/summary", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (user.role === "STUDENT" && user.userId !== req.params.studentId) {
      next(new ForbiddenError("Students may only view their own summary"));
      return;
    }
    const item = await svc.getStudentRotationSummary(req.params.rotationId as string, req.params.studentId as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/clinical-rle/rotations/{rotationId}/students/{studentId}/certificate:
 *   get:
 *     tags: [Clinical RLE]
 *     summary: Printable completion certificate (rotation must be COMPLETED; students only for themselves)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rotationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Certificate data
 *       403:
 *         description: Not assigned / student mismatch
 *       409:
 *         description: Rotation not completed
 */
router.get("/rotations/:rotationId/students/:studentId/certificate", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (user.role === "STUDENT" && user.userId !== req.params.studentId) {
      next(new ForbiddenError("Students may only view their own certificate"));
      return;
    }
    const item = await svc.getRotationCertificate(req.params.rotationId as string, req.params.studentId as string);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

export default router;
