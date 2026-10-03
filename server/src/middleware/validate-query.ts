import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query);
      (req as unknown as Record<string, unknown>).validatedQuery = parsed;
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
            message: "Invalid query parameters",
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
