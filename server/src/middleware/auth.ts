import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, JwtPayload } from "../services/jwt.service.js";
import { UnauthorizedError } from "./error-handler.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("auth-middleware");

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new UnauthorizedError("Missing or invalid authorization header"));
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
    } else {
      logger.error({ err }, "Unexpected error during authentication");
      next(new UnauthorizedError("Authentication failed"));
    }
  }
}
