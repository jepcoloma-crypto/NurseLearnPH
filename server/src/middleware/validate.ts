import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
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
      next(err);
    }
  };
}
