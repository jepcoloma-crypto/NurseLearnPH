import nodemailer from "nodemailer";
import { Resend } from "resend";
import { config } from "../config/index.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("email-service");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth:
    process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
});

let resendClient: Resend | null = null;
function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * Send an email. Provider priority:
 *   1. Resend   — when RESEND_API_KEY is set (any environment except test)
 *   2. SMTP     — when SMTP_HOST is set (nodemailer)
 *   3. Dry-run  — otherwise; the email is logged instead of sent
 *
 * Never sends real mail when NODE_ENV=test, even if keys are configured.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; dryRun?: boolean }> {
  if (process.env.NODE_ENV === "test") {
    logger.info({ to, subject }, "[Email - Dry Run] Tests never send real mail");
    return { success: true, dryRun: true };
  }

  const from = process.env.RESEND_FROM || "NurseLearn PH <onboarding@resend.com>";

  if (process.env.RESEND_API_KEY) {
    try {
      const { data, error } = await getResendClient().emails.send({
        from,
        to: [to],
        subject,
        html,
      });
      if (error) {
        throw new Error(error.message);
      }
      logger.info({ to, subject, id: data?.id }, "Email sent (Resend)");
      return { success: true };
    } catch (err) {
      logger.error({ err, to, subject }, "Failed to send email (Resend)");
      throw err;
    }
  }

  if (process.env.SMTP_HOST) {
    try {
      const result = await transporter.sendMail({
        from: process.env.SMTP_FROM || "NurseLearn PH <noreply@nurselearn.local>",
        to,
        subject,
        html,
      });
      logger.info({ to, subject, messageId: result.messageId }, "Email sent");
      return { success: true };
    } catch (err) {
      logger.error({ err, to, subject }, "Failed to send email");
      throw err;
    }
  }

  logger.info(
    { to, subject, htmlLength: html.length },
    "[Email - Dry Run] No mail provider configured, logging instead"
  );
  return { success: true, dryRun: true };
}
