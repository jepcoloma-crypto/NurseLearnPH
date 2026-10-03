import app from "./app.js";
import { config } from "./config/index.js";
import { testConnection, closePool } from "./database/index.js";
import { createChildLogger } from "./utils/logger.js";

const logger = createChildLogger("server");

async function main() {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.fatal("Failed to connect to database. Exiting.");
    process.exit(1);
  }

  const server = app.listen(config.PORT, () => {
    logger.info(
      `NurseLearn PH server running on http://localhost:${config.PORT}`
    );
    logger.info(`Environment: ${config.NODE_ENV}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await closePool();
      logger.info("Server shut down.");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
