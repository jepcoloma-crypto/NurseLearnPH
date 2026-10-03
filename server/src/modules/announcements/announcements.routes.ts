import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../middleware/auth.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validate-query.js";
import { uploadMedia } from "../../middleware/upload.js";
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  listAnnouncementQuerySchema,
} from "./announcements.schema.js";
import * as announcementsService from "./announcements.service.js";

const router = Router();

function actorOf(req: Request) {
  const { userId, role } = (req as AuthenticatedRequest).user;
  return { userId, role };
}

router.get(
  "/",
  authenticate,
  validateQuery(listAnnouncementQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req as unknown as Record<string, unknown>)
        .validatedQuery as typeof listAnnouncementQuerySchema._type;
      const result = await announcementsService.listAnnouncements(
        query,
        actorOf(req)
      );
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
  "/:id",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const announcement = await announcementsService.getAnnouncementById(
        id,
        actorOf(req)
      );
      res.json({
        success: true,
        data: announcement,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Read receipts ──────────────────────────────────────────────────────────

router.post(
  "/:id/read",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await announcementsService.markAnnouncementRead(
        req.params.id as string,
        actorOf(req)
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:id/receipts",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await announcementsService.getAnnouncementReceipts(
        req.params.id as string,
        actorOf(req)
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/",
  authenticate,
  requireRole("ADMIN", "PROGRAM_COORDINATOR", "INSTRUCTOR", "CLINICAL_INSTRUCTOR"),
  validateBody(createAnnouncementSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const announcement = await announcementsService.createAnnouncement(
        req.body,
        actorOf(req)
      );
      res.status(201).json({
        success: true,
        data: announcement,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/:id",
  authenticate,
  requireRole("ADMIN", "PROGRAM_COORDINATOR", "INSTRUCTOR", "CLINICAL_INSTRUCTOR"),
  validateBody(updateAnnouncementSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const announcement = await announcementsService.updateAnnouncement(
        id,
        req.body,
        actorOf(req)
      );
      res.json({
        success: true,
        data: announcement,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/:id",
  authenticate,
  requireRole("ADMIN", "PROGRAM_COORDINATOR", "INSTRUCTOR", "CLINICAL_INSTRUCTOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      await announcementsService.deleteAnnouncement(id, actorOf(req));
      res.json({
        success: true,
        data: { message: "Announcement deleted successfully" },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Attachments ────────────────────────────────────────────────────────────

router.post(
  "/:id/attachments",
  authenticate,
  requireRole("ADMIN", "PROGRAM_COORDINATOR", "INSTRUCTOR", "CLINICAL_INSTRUCTOR"),
  (req: Request, res: Response, next: NextFunction) => {
    uploadMedia("documents").array("files", 10)(req, res, (err) => {
      if (err) {
        next(err);
        return;
      }
      const files =
        (req as unknown as {
          files?: Array<{
            originalname: string;
            filename: string;
            mimetype: string;
            size: number;
          }>;
        }).files ?? [];
      if (files.length === 0) {
        res.status(400).json({ success: false, error: "No files provided" });
        return;
      }
      announcementsService
        .addAttachments(req.params.id as string, files, actorOf(req))
        .then((rows) => res.status(201).json({ success: true, data: rows }))
        .catch(next);
    });
  }
);

router.delete(
  "/:id/attachments/:attachmentId",
  authenticate,
  requireRole("ADMIN", "PROGRAM_COORDINATOR", "INSTRUCTOR", "CLINICAL_INSTRUCTOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await announcementsService.removeAttachment(
        req.params.id as string,
        req.params.attachmentId as string,
        actorOf(req)
      );
      res.json({
        success: true,
        data: { message: "Attachment removed" },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
