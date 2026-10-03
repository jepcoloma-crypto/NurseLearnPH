import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { createChildLogger } from "../utils/logger.js";
import { config } from "../config/index.js";

const logger = createChildLogger("error-handler");

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  public readonly errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]>) {
    super("Validation failed", 400);
    this.errors = errors;
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const field = e.path.join(".");
      if (!errors[field]) errors[field] = [];
      errors[field].push(e.message);
    });
    res.status(400).json({
      success: false,
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        details: errors,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.constructor.name.toUpperCase().replace("ERROR", "_ERROR"),
        ...(err instanceof ValidationError ? { details: err.errors } : {}),
      },
    });
    return;
  }

  logger.error({ err }, "Unhandled error");

  res.status(500).json({
    success: false,
    error: {
      message: "Internal server error",
      code: "INTERNAL_ERROR",
    },
  });
}
