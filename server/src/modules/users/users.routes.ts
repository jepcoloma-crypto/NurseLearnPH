import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../middleware/auth.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import {
  createUserSchema,
  updateUserSchema,
  updateUserPasswordSchema,
  listUsersQuerySchema,
} from "./users.schema.js";
import * as usersService from "./users.service.js";

const router = Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users
 *     description: Returns a paginated list of users. Requires ADMIN or PROGRAM_COORDINATOR role.
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
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of results per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, PROGRAM_COORDINATOR, INSTRUCTOR, CLINICAL_INSTRUCTOR, STUDENT]
 *         description: Filter by user role
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Paginated list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient role
 */
router.get(
  "/",
  authenticate,
  requireRole("ADMIN", "PROGRAM_COORDINATOR", "INSTRUCTOR"),
  validateQuery(listUsersQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req as unknown as Record<string, unknown>).validatedQuery as typeof listUsersQuerySchema._type;
      const result = await usersService.listUsers(query);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a user by ID
 *     description: Returns a single user by their ID. Requires ADMIN, PROGRAM_COORDINATOR, or INSTRUCTOR role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient role
 *       404:
 *         description: User not found
 */
router.get(
  "/:id",
  authenticate,
  requireRole("ADMIN", "PROGRAM_COORDINATOR", "INSTRUCTOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const user = await usersService.getUserById(id);
      res.json({
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: Create a new user
 *     description: Creates a new user account. Requires ADMIN role.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserInput'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - ADMIN role required
 *       409:
 *         description: Conflict - email already exists
 */
router.post(
  "/",
  authenticate,
  requireRole("ADMIN"),
  validateBody(createUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.userId;
      const user = await usersService.createUser(req.body, userId);
      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Update a user
 *     description: Updates an existing user. Requires ADMIN role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserInput'
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - ADMIN role required
 *       404:
 *         description: User not found
 */
router.put(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  validateBody(updateUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.userId;
      const id = req.params.id as string;
      const user = await usersService.updateUser(id, req.body, userId);
      res.json({
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/users/{id}/password:
 *   put:
 *     tags: [Users]
 *     summary: Reset a user's password
 *     description: Sets a new password for the user and revokes their refresh tokens so existing sessions are logged out. Requires ADMIN role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: The user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: New password (minimum 8 characters)
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - ADMIN role required
 *       404:
 *         description: User not found
 */
router.put(
  "/:id/password",
  authenticate,
  requireRole("ADMIN"),
  validateBody(updateUserPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.userId;
      const id = req.params.id as string;
      const result = await usersService.updateUserPassword(id, req.body.password, userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete a user
 *     description: Deletes a user by ID. Requires ADMIN role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: User deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - ADMIN role required
 *       404:
 *         description: User not found
 */
router.delete(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.userId;
      const id = req.params.id as string;
      await usersService.deleteUser(id, userId);
      res.json({
        success: true,
        data: { message: "User deleted successfully" },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Signup approvals (SIGNUP_MODE=approval) ───────────────────────────────

/**
 * @swagger
 * /api/users/{id}/approve:
 *   post:
 *     tags: [Users]
 *     summary: Approve a pending self-signup
 *     description: Activates a verified, not-yet-active account so the applicant can log in. Requires ADMIN role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Account activated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - ADMIN role required
 *       404:
 *         description: User not found
 *       409:
 *         description: User is not pending approval
 */
router.post(
  "/:id/approve",
  authenticate,
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.userId;
      const id = req.params.id as string;
      const data = await usersService.approveUser(id, userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/users/{id}/reject:
 *   post:
 *     tags: [Users]
 *     summary: Reject a pending self-signup
 *     description: Keeps the account inactive and soft-deletes it (retained for audit). The applicant is notified by email. Requires ADMIN role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Optional reason included in the notification email
 *     responses:
 *       200:
 *         description: Signup rejected
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - ADMIN role required
 *       404:
 *         description: User not found
 *       409:
 *         description: User is not pending approval
 */
router.post(
  "/:id/reject",
  authenticate,
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.userId;
      const id = req.params.id as string;
      const reason =
        typeof req.body?.reason === "string" && req.body.reason.trim()
          ? req.body.reason.trim().slice(0, 500)
          : undefined;
      const data = await usersService.rejectUser(id, userId, reason);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Student Profile ────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/users/{studentId}/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get comprehensive student activity profile
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Student profile with aggregated activity data
 */
router.get(
  "/:studentId/profile",
  authenticate,
  requireRole("INSTRUCTOR", "PROGRAM_COORDINATOR", "CLINICAL_INSTRUCTOR", "ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await import("./student-profile.service.js").then((m) =>
        m.getStudentProfile(req.params.studentId as string)
      );
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
