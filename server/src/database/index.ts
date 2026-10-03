import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../config/index.js";
import { createChildLogger } from "../utils/logger.js";
import * as schema from "./schema/index.js";

const logger = createChildLogger("database");

const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected database pool error");
});

export const db = drizzle(pool, { schema });

export async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW() as now");
    client.release();
    logger.info(
      { timestamp: result.rows[0].now },
      "Database connection successful"
    );
    return true;
  } catch (err) {
    logger.error({ err }, "Database connection failed");
    return false;
  }
}

export async function closePool() {
  await pool.end();
  logger.info("Database pool closed");
}
