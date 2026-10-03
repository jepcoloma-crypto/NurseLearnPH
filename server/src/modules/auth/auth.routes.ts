import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../middleware/auth.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import {
  loginLimiter,
  registerLimiter,
  refreshLimiter,
  changePasswordLimiter,
  verifyLimiter,
  resendLimiter,
} from "../../middleware/rate-limiter.js";
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from "./auth.schema.js";
import * as authService from "./auth.service.js";

const router = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Invalid credentials
 */
router.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(req.body, req.ip);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

/**
 * @swagger
 * /api/auth/signup-config:
 *   get:
 *     tags: [Auth]
 *     summary: Public self-signup configuration
 *     description: Tells the client whether the signup page is available and whether new accounts require admin approval.
 *     responses:
 *       200:
 *         description: Signup configuration
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
 *                     enabled:
 *                       type: boolean
 *                     requireApproval:
 *                       type: boolean
 */
router.get(
  "/signup-config",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: authService.getSignupConfig() });
    } catch (err) { next(err); }
  }
);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new student account
 *     description: Creates an inactive student account and emails a verification link. With SIGNUP_MODE=approval (default) the account becomes usable only after an administrator approves it; with SIGNUP_MODE=auto verification activates it immediately.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Registration successful — verification email sent
 *       403:
 *         description: Registration is disabled
 *       409:
 *         description: Email already exists
 *       400:
 *         description: Validation error
 */
router.post(
  "/register",
  registerLimiter,
  validateBody(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.register(req.body, req.ip);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Verify an email address via token
 *     description: Consumes the single-use token from the verification email. Depending on SIGNUP_MODE the account is either activated immediately (auto) or queued for administrator approval (approval).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification result (status: active | pending)
 *       404:
 *         description: Invalid, expired, or already-used verification link
 *       429:
 *         description: Too many verification attempts
 */
router.post(
  "/verify-email",
  verifyLimiter,
  validateBody(verifyEmailSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.verifyEmail(req.body, req.ip);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     tags: [Auth]
 *     summary: Resend the verification email
 *     description: Always returns a generic success response so the endpoint cannot be used to probe registered emails.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Generic confirmation
 *       429:
 *         description: Too many resend attempts
 */
router.post(
  "/resend-verification",
  resendLimiter,
  validateBody(resendVerificationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.resendVerification(req.body, req.ip);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token using refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens refreshed
 *       401:
 *         description: Invalid refresh token
 */
router.post(
  "/refresh",
  refreshLimiter,
  validateBody(refreshTokenSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.refreshToken(req.body.refreshToken, req.ip);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and revoke refresh token
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/logout",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.userId;
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(" ")[1];
      await authService.logout(userId, token, req.ip);
      res.json({ success: true, data: { message: "Logged out successfully" } });
    } catch (err) { next(err); }
  }
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
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
 */
router.get(
  "/me",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.userId;
      const user = await authService.getMe(userId);
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  }
);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     tags: [Auth]
 *     summary: Change password for authenticated user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Invalid current password
 */
router.put(
  "/change-password",
  authenticate,
  changePasswordLimiter,
  validateBody(changePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.userId;
      await authService.changePassword(userId, req.body);
      res.json({ success: true, data: { message: "Password changed successfully" } });
    } catch (err) { next(err); }
  }
);

export default router;
