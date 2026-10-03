import request from "supertest";
import { sql } from "drizzle-orm";
import app from "../src/app.js";
import { closePool, db } from "../src/database/index.js";
import { auditLogs } from "../src/database/schema/index.js";

const BASE_URL = "";

export { app, BASE_URL };

// Suites write audit rows (LOGIN, REFRESH_TOKEN, fixture activity...). Snapshot
// the clock at file start and strip everything written during this file's run
// on teardown, so the dev database's audit log never regrows from test runs.
// The bound MUST come from Postgres: audit.created_at is defaultNow() (session
// wall time) while a JS Date param is serialized as UTC wall time — a multi-hour
// skew that would swallow pre-existing rows. Compared as a raw naive string via
// sql`` so drizzle can't re-encode it as a Date.
// Safe to run per-file in parallel: every row a file creates is >= its own start
// time, so its own teardown always removes them. No test reads audit rows, so a
// concurrent file clearing in-flight rows can't race an assertion.
const auditRunStartedResult = (await db.execute(
  sql`SELECT now()::timestamp::text AS now`
)) as unknown as { rows: Array<{ now: string }> };
const AUDIT_RUN_STARTED_AT = String(auditRunStartedResult.rows[0].now);

afterAll(async () => {
  await db
    .delete(auditLogs)
    .where(sql`${auditLogs.createdAt} >= ${AUDIT_RUN_STARTED_AT}`);
  await closePool();
});

export const SEED_USERS = {
  admin: { username: "admin", email: "admin@nurselearn.local", password: "admin123" },
  instructor: { username: "instructor", email: "instructor@nurselearn.local", password: "instructor123" },
  coordinator: { username: "coordinator", email: "coordinator@nurselearn.local", password: "coordinator123" },
  clinical: { username: "clinical", email: "clinical@nurselearn.local", password: "clinical123" },
  student: { username: "student", email: "student@nurselearn.local", password: "newpass123" },
  student2: { username: "student2", email: "student2@nurselearn.local", password: "student123" },
};

export const SEED_IDS = {
  courseId: "8ddc7b05-6718-4b22-872c-4a0e1eb6c0cb",
  lessonId: "1854732a-26e1-44aa-8694-73392f14f413",
  instructorId: "2821d07a-3a32-4187-ba60-14b15ca00a33",
};

export async function getStudentId(): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS.student);
  const payload = JSON.parse(Buffer.from(res.body.data.accessToken.split('.')[1], 'base64').toString());
  return payload.userId;
}
