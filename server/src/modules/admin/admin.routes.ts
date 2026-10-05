import { Router, Request, Response, NextFunction } from "express";
import { authenticate, type AuthenticatedRequest } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateQuery } from "../../middleware/validate-query.js";
import { validateBody } from "../../middleware/validate.js";
import { z } from "zod";
import { listAuditLogs, logAudit } from "../../services/audit.service.js";
import { getSettings, updateSettings } from "./settings.service.js";

const router = Router();

const auditLogQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(15),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
});

router.get("/audit-logs", authenticate, requireRole("ADMIN"), validateQuery(auditLogQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = (req as unknown as { validatedQuery: z.infer<typeof auditLogQuerySchema> }).validatedQuery;
    const result = await listAuditLogs(query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Module Settings (printable-document configuration) ──────────────────────

const organizationSchema = z.object({
  name: z.string().max(200).optional(),
  address: z.string().max(300).optional(),
  contact: z.string().max(200).optional(),
  logoUrl: z.string().max(500).optional(),
  programName: z.string().max(200).optional(),
});

const reportsSchema = z.object({
  headerNote: z.string().max(500).optional(),
  footerNote: z.string().max(500).optional(),
});

const certificatesSchema = z.object({
  title: z.string().max(150).optional(),
  signatoryName: z.string().max(150).optional(),
  signatoryTitle: z.string().max(150).optional(),
  footerNote: z.string().max(500).optional(),
});

const updateModuleSettingsSchema = z
  .object({
    organization: organizationSchema.optional(),
    reports: reportsSchema.optional(),
    certificates: certificatesSchema.optional(),
  })
  .refine((v) => Object.values(v).some((section) => section !== undefined), {
    message: "No settings sections provided",
  });

/**
 * GET /api/admin/module-settings
 * Every authenticated user reads the settings (printed documents need them);
 * defaults are merged server-side so a fresh install still renders.
 */
router.get("/module-settings", authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await getSettings() });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/module-settings
 * Admin-only. Sections are merged into their stored rows so partial saves
 * never wipe neighbouring fields.
 */
router.put("/module-settings", authenticate, requireRole("ADMIN"), validateBody(updateModuleSettingsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const body = req.body as z.infer<typeof updateModuleSettingsSchema>;
    const data = await updateSettings(body, userId);
    await logAudit({
      userId,
      action: "UPDATE_SETTINGS",
      resource: "SETTINGS",
      metadata: { sections: Object.keys(body) },
      ipAddress: req.ip,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
