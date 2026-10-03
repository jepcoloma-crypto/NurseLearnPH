import { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.js";
import { ForbiddenError } from "./error-handler.js";
import { db } from "../database/index.js";
import { rolePermissions, permissions } from "../database/schema/index.js";
import { eq } from "drizzle-orm";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("rbac");

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      next(new ForbiddenError("Not authenticated"));
      return;
    }

    if (!roles.includes(user.role)) {
      logger.debug(
        { userId: user.userId, requiredRoles: roles, actualRole: user.role },
        "Role check failed"
      );
      next(new ForbiddenError("Insufficient permissions"));
      return;
    }

    next();
  };
}

export function requirePermission(...permissionNames: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      next(new ForbiddenError("Not authenticated"));
      return;
    }

    const rolePerms = await db
      .select({ permissionName: permissions.name })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        eq(
          rolePermissions.role,
          user.role as
            | "ADMIN"
            | "PROGRAM_COORDINATOR"
            | "INSTRUCTOR"
            | "CLINICAL_INSTRUCTOR"
            | "STUDENT"
        )
      );

    const userPermissions = rolePerms.map((rp) => rp.permissionName);

    const hasPermission = permissionNames.some((p) =>
      userPermissions.includes(p)
    );

    if (!hasPermission) {
      logger.debug(
        {
          userId: user.userId,
          requiredPermissions: permissionNames,
          actualRole: user.role,
        },
        "Permission check failed"
      );
      next(new ForbiddenError("Insufficient permissions"));
      return;
    }

    next();
  };
}
