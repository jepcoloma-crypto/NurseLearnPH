import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import path from "path";
import { config } from "./config/index.js";
import { swaggerSpec } from "./config/swagger.js";
import { requestLogger } from "./middleware/request-logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createChildLogger } from "./utils/logger.js";
import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import academicRoutes from "./modules/academic/academic.routes.js";
import learningRoutes from "./modules/learning/learning.routes.js";
import assessmentRoutes from "./modules/assessment/assessment.routes.js";
import clinicalRoutes from "./modules/clinical/clinical.routes.js";
import nursingProcessRoutes from "./modules/nursing-process/nursing-process.routes.js";
import skillsLabRoutes from "./modules/skills-lab/skills-lab.routes.js";
import clinicalRleRoutes from "./modules/clinical-rle/clinical-rle.routes.js";
import competencyRoutes from "./modules/competency/competency.routes.js";
import adaptiveRoutes from "./modules/adaptive/adaptive.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import portfolioRoutes from "./modules/portfolio/portfolio.routes.js";
import nleRoutes from "./modules/nle/nle.routes.js";
import simulationRoutes from "./modules/simulation/simulation.routes.js";
import aiTutorRoutes from "./modules/ai-tutor/ai-tutor.routes.js";
import aiContentRoutes from "./modules/ai-content/ai-content.routes.js";
import researchRoutes from "./modules/research/research.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import searchRoutes from "./modules/search/search.routes.js";
import announcementsRoutes from "./modules/announcements/announcements.routes.js";
import notificationsRoutes from "./modules/notifications/notifications.routes.js";

const logger = createChildLogger("app");
const app = express();

// Trust X-Forwarded-For only from a loopback peer (nginx proxy_pass to
// 127.0.0.1 per DEPLOY.md §6). Without this, req.ip is the proxy's IP for
// every user — all visitors would share ONE rate-limit bucket (100 req/min
// globally, 5 logins/min) and audit logs would record 127.0.0.1 for everyone.
// "loopback" keeps direct (non-proxy) deployments spoof-proof: XFF from a
// remote peer is ignored.
app.set("trust proxy", "loopback");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: config.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Global rate limiter: 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later" },
});
app.use("/api", globalLimiter);

// Swagger API documentation
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: ".swagger-ui .topbar { display: none }",
  customSiteTitle: "NurseLearn PH API Documentation",
}));
app.get("/api/docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: "0.1.0",
  });
});

app.get("/api/info", (_req, res) => {
  res.json({
    name: "NurseLearn PH",
    version: "0.1.0",
    phase: 22,
    description:
      "Nursing Competency, Clinical Reasoning & Learning Platform",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/academic", academicRoutes);
app.use("/api/learning", learningRoutes);
app.use("/api/assessment", assessmentRoutes);
app.use("/api/clinical", clinicalRoutes);
app.use("/api/nursing-process", nursingProcessRoutes);
app.use("/api/skills-lab", skillsLabRoutes);
app.use("/api/clinical-rle", clinicalRleRoutes);
app.use("/api/competency", competencyRoutes);
app.use("/api/adaptive", adaptiveRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/nle", nleRoutes);
app.use("/api/simulation", simulationRoutes);
app.use("/api/ai-tutor", aiTutorRoutes);
app.use("/api/ai-content", aiContentRoutes);
app.use("/api/research", researchRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/announcements", announcementsRoutes);
app.use("/api/notifications", notificationsRoutes);

// Serve uploaded files
app.use("/storage", express.static(path.resolve(process.cwd(), "../storage")));

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: "Route not found",
      code: "NOT_FOUND",
    },
  });
});

app.use(errorHandler);

export default app;
