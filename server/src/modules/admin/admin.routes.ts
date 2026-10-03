import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateQuery } from "../../middleware/validate-query.js";
import { z } from "zod";
import { listAuditLogs } from "../../services/audit.service.js";

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

export default router;
