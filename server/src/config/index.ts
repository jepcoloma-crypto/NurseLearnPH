import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL is required"),
  PORT: z.coerce.number().default(3002),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  // Self-signup activation: approval (default, admin activates after email
  // verification) | auto (activate on verification) | off (no public signup)
  SIGNUP_MODE: z.enum(["approval", "auto", "off"]).default("approval"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("debug"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten());
  process.exit(1);
}

export const config = parsed.data;
