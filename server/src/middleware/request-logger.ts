import { Request, Response, NextFunction } from "express";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("request-logger");

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
    };

    if (res.statusCode >= 400) {
      logger.warn(logData, "Request completed with error");
    } else {
      logger.info(logData, "Request completed");
    }
  });

  next();
}
