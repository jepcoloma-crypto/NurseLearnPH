import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../middleware/auth.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { validateQuery } from "../../middleware/validate-query.js";
import { listNotificationsQuerySchema } from "./notifications.schema.js";
import * as notificationsService from "./notifications.service.js";

const router = Router();

router.get(
  "/",
  authenticate,
  validateQuery(listNotificationsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.userId;
      const query = (req as unknown as Record<string, unknown>)
        .validatedQuery as typeof listNotificationsQuerySchema._type;
      const result = await notificationsService.listNotifications(userId, query);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/unread-count",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.userId;
      const count = await notificationsService.getUnreadCount(userId);
      res.json({
        success: true,
        data: { count },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/read-all",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.userId;
      await notificationsService.markAllAsRead(userId);
      res.json({
        success: true,
        data: { message: "All notifications marked as read" },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/:id/read",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user.userId;
      const id = req.params.id as string;
      const notification = await notificationsService.markAsRead(id, userId);
      res.json({
        success: true,
        data: notification,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
