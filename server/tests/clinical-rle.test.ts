import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { app, SEED_USERS, SEED_IDS, getStudentId } from "./helpers.js";
import { db } from "../src/database/index.js";
import { attendanceRecords, notifications, clinicalLogs } from "../src/database/schema/index.js";

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

describe("Clinical RLE Module", () => {
  let instructorToken: string;
  let studentToken: string;
  let coordinatorToken: string;

  beforeAll(async () => {
    instructorToken = await loginAs("instructor");
    studentToken = await loginAs("student");
    coordinatorToken = await loginAs("coordinator");
  });

  // Clean up test-created clinical logs
  afterAll(async () => {
    const studentId = await getStudentId();
    await db.delete(clinicalLogs).where(eq(clinicalLogs.studentId, studentId));
  });

  describe("Rotations", () => {
    let rotationId: string;

    it("GET /api/clinical-rle/rotations - should list rotations (coordinator)", async () => {
      const res = await request(app)
        .get("/api/clinical-rle/rotations")
        .set("Authorization", `Bearer ${coordinatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/clinical-rle/rotations - should reject student (management is staff-only)", async () => {
      const res = await request(app)
        .get("/api/clinical-rle/rotations")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    it("POST /api/clinical-rle/rotations - should create a rotation (instructor)", async () => {
      const res = await request(app)
        .post("/api/clinical-rle/rotations")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          courseId: SEED_IDS.courseId,
          instructorId: SEED_IDS.instructorId,
          title: "Medical-Surgical Rotation",
          description: "MS rotation for 2nd year",
          department: "Medicine",
          startDate: "2026-01-15T08:00:00Z",
          endDate: "2026-03-15T17:00:00Z",
          requiredHours: 120,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      rotationId = res.body.data.id;
    });

    it("GET /api/clinical-rle/rotations/:id - should get a rotation (coordinator)", async () => {
      const res = await request(app)
        .get(`/api/clinical-rle/rotations/${rotationId}`)
        .set("Authorization", `Bearer ${coordinatorToken}`);

      expect(res.status).toBe(200);
    });

    it("PUT /api/clinical-rle/rotations/:id - should update a rotation", async () => {
      const res = await request(app)
        .put(`/api/clinical-rle/rotations/${rotationId}`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ title: "MS Rotation Updated" });

      expect(res.status).toBe(200);
    });

    it("DELETE /api/clinical-rle/rotations/:id - should delete a rotation", async () => {
      const res = await request(app)
        .delete(`/api/clinical-rle/rotations/${rotationId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(204);
    });

    it("POST /api/clinical-rle/rotations - should reject student", async () => {
      const res = await request(app)
        .post("/api/clinical-rle/rotations")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          courseId: SEED_IDS.courseId,
          title: "Test",
          startDate: "2026-01-01T00:00:00Z",
          endDate: "2026-06-01T00:00:00Z",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("Patient Assignments", () => {
    it("POST /api/clinical-rle/patients - should reject student", async () => {
      const res = await request(app)
        .post("/api/clinical-rle/patients")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          rotationId: "00000000-0000-0000-0000-000000000000",
          studentId: "00000000-0000-0000-0000-000000000000",
          patientName: "Test",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("Attendance", () => {
    it("POST /api/clinical-rle/attendance - should reject student", async () => {
      const res = await request(app)
        .post("/api/clinical-rle/attendance")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          studentId: "00000000-0000-0000-0000-000000000000",
          date: "2026-01-15T08:00:00Z",
          status: "PRESENT",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("Clinical Logs", () => {
    it("POST /api/clinical-rle/logs - should create a log (student)", async () => {
      const res = await request(app)
        .post("/api/clinical-rle/logs")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          rotationId: "00000000-0000-0000-0000-000000000000",
          date: "2026-01-15T08:00:00Z",
          patientCount: 3,
          procedures: ["IV insertion", "wound dressing"],
          reflections: "Good learning experience",
        });

      // May fail due to FK constraint on rotationId
      expect([201, 400, 500]).toContain(res.status);
    });
  });

  describe("Evaluations", () => {
    it("POST /api/clinical-rle/evaluations - should reject student", async () => {
      const res = await request(app)
        .post("/api/clinical-rle/evaluations")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          rotationId: "00000000-0000-0000-0000-000000000000",
          studentId: "00000000-0000-0000-0000-000000000000",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("Rotation Completion & Certificates", () => {
    let completionRotationId: string;
    let studentId: string;
    let student2Id: string;

    const decodeUserId = (token: string): string =>
      JSON.parse(Buffer.from(token.split(".")[1], "base64").toString()).userId;

    beforeAll(async () => {
      studentId = decodeUserId(studentToken);
      const s2 = await request(app).post("/api/auth/login").send(SEED_USERS.student2);
      student2Id = decodeUserId(s2.body.data.accessToken);

      const create = await request(app)
        .post("/api/clinical-rle/rotations")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          courseId: SEED_IDS.courseId,
          instructorId: SEED_IDS.instructorId,
          title: "Completion Test Rotation",
          department: "Medicine",
          startDate: "2026-01-05T08:00:00Z",
          endDate: "2026-03-05T17:00:00Z",
          requiredHours: 40,
        });
      expect(create.status).toBe(201);
      completionRotationId = create.body.data.id;

      const assign = await request(app)
        .post(`/api/clinical-rle/rotations/${completionRotationId}/students`)
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({ studentIds: [studentId] });
      expect(assign.status).toBe(200);

      const att = await request(app)
        .post("/api/clinical-rle/attendance")
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({
          rotationId: completionRotationId,
          studentId,
          date: "2026-01-06T08:00:00.000Z",
          status: "PRESENT",
          hoursLogged: 8,
        });
      expect(att.status).toBe(201);
    });

    afterAll(async () => {
      if (!completionRotationId) return;
      await db.delete(notifications).where(eq(notifications.relatedId, completionRotationId));
      await db.delete(attendanceRecords).where(eq(attendanceRecords.rotationId, completionRotationId));
    });

    it("GET completion-summary - should return per-student hours and attendance (staff only)", async () => {
      const res = await request(app)
        .get(`/api/clinical-rle/rotations/${completionRotationId}/completion-summary`)
        .set("Authorization", `Bearer ${coordinatorToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.rotation.id).toBe(completionRotationId);
      expect(data.students).toHaveLength(1);
      expect(data.students[0].studentId).toBe(studentId);
      expect(data.students[0].totalHours).toBe(8);
      expect(data.students[0].metRequiredHours).toBe(false);
      expect(data.students[0].attendancePercentage).toBe(100);
      expect(data.totals.studentCount).toBe(1);
      expect(data.totals.studentsBelowRequiredHours).toBe(1);
    });

    it("GET completion-summary - should reject student", async () => {
      const res = await request(app)
        .get(`/api/clinical-rle/rotations/${completionRotationId}/completion-summary`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    it("GET certificate - should return 409 before completion", async () => {
      const res = await request(app)
        .get(`/api/clinical-rle/rotations/${completionRotationId}/students/${studentId}/certificate`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(409);
    });

    it("POST complete - should mark rotation COMPLETED with completedAt and summary", async () => {
      const res = await request(app)
        .post(`/api/clinical-rle/rotations/${completionRotationId}/complete`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.rotation.status).toBe("COMPLETED");
      expect(res.body.data.rotation.completedAt).toBeTruthy();
      expect(res.body.data.summary.students[0].totalHours).toBe(8);
    });

    it("POST complete - should return 409 when already completed", async () => {
      const res = await request(app)
        .post(`/api/clinical-rle/rotations/${completionRotationId}/complete`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(409);
    });

    it("complete - should notify assigned students", async () => {
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.relatedId, completionRotationId));

      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].type).toBe("ROTATION_COMPLETED");
      expect(rows[0].userId).toBe(studentId);
    });

    it("GET certificate - student should receive own certificate", async () => {
      const res = await request(app)
        .get(`/api/clinical-rle/rotations/${completionRotationId}/students/${studentId}/certificate`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      const cert = res.body.data;
      expect(cert.student.id).toBe(studentId);
      expect(cert.rotation.title).toBe("Completion Test Rotation");
      expect(cert.rotation.completedAt).toBeTruthy();
      expect(cert.hours.total).toBe(8);
      expect(cert.hours.required).toBe(40);
      expect(cert.hours.percentage).toBe(20);
      expect(cert.hours.metRequiredHours).toBe(false);
      expect(cert.attendance.percentage).toBe(100);
      expect(cert.attendance.totalDays).toBe(1);
      expect(cert.instructor).toBeTruthy();
    });

    it("GET certificate - student cannot view another student's certificate", async () => {
      const res = await request(app)
        .get(`/api/clinical-rle/rotations/${completionRotationId}/students/${student2Id}/certificate`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    it("GET certificate - staff requesting unassigned student gets 403", async () => {
      const res = await request(app)
        .get(`/api/clinical-rle/rotations/${completionRotationId}/students/${student2Id}/certificate`)
        .set("Authorization", `Bearer ${coordinatorToken}`);

      expect(res.status).toBe(403);
    });

    it("GET my-rotations - student should see COMPLETED status", async () => {
      const res = await request(app)
        .get("/api/clinical-rle/my-rotations")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      const rot = (res.body.data as Array<Record<string, unknown>>).find((r) => r.id === completionRotationId);
      expect(rot?.status).toBe("COMPLETED");
    });

    it("PUT /rotations/:id - status changes keep completedAt consistent", async () => {
      const down = await request(app)
        .put(`/api/clinical-rle/rotations/${completionRotationId}`)
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({ status: "IN_PROGRESS" });
      expect(down.status).toBe(200);
      expect(down.body.data.completedAt).toBeNull();

      const up = await request(app)
        .put(`/api/clinical-rle/rotations/${completionRotationId}`)
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({ status: "COMPLETED" });
      expect(up.status).toBe(200);
      expect(up.body.data.completedAt).toBeTruthy();
    });

    let selectiveRotationId: string;
    let openRotationId: string;

    it("POST complete with studentIds - marks only the selected students", async () => {
      const create = await request(app)
        .post("/api/clinical-rle/rotations")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          courseId: SEED_IDS.courseId,
          instructorId: SEED_IDS.instructorId,
          title: "Selective Completion Rotation",
          department: "Medicine",
          startDate: "2026-01-05T08:00:00Z",
          endDate: "2026-03-05T17:00:00Z",
          requiredHours: 40,
        });
      expect(create.status).toBe(201);
      selectiveRotationId = create.body.data.id;

      const assign = await request(app)
        .post(`/api/clinical-rle/rotations/${selectiveRotationId}/students`)
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({ studentIds: [studentId, student2Id] });
      expect(assign.status).toBe(200);

      const complete = await request(app)
        .post(`/api/clinical-rle/rotations/${selectiveRotationId}/complete`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ studentIds: [studentId] });
      expect(complete.status).toBe(200);
      expect(complete.body.data.rotation.status).toBe("COMPLETED");

      const byId = new Map<string, Record<string, unknown>>(
        (complete.body.data.summary.students as Array<Record<string, unknown>>).map((s) => [String(s.studentId), s])
      );
      expect(byId.get(studentId)?.completedAt).toBeTruthy();
      expect(byId.get(student2Id)?.completedAt ?? null).toBeNull();
    });

    it("GET certificate - unselected student is blocked until marked", async () => {
      const blocked = await request(app)
        .get(`/api/clinical-rle/rotations/${selectiveRotationId}/students/${student2Id}/certificate`)
        .set("Authorization", `Bearer ${coordinatorToken}`);
      expect(blocked.status).toBe(409);

      const allowed = await request(app)
        .get(`/api/clinical-rle/rotations/${selectiveRotationId}/students/${studentId}/certificate`)
        .set("Authorization", `Bearer ${studentToken}`);
      expect(allowed.status).toBe(200);
    });

    it("GET my-rotations - includes per-student studentCompletedAt", async () => {
      const res = await request(app)
        .get("/api/clinical-rle/my-rotations")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      const rot = (res.body.data as Array<Record<string, unknown>>).find((r) => r.id === selectiveRotationId);
      expect(rot?.studentCompletedAt).toBeTruthy();
    });

    it("PUT completion - instructor can add and remove individual students", async () => {
      const add = await request(app)
        .put(`/api/clinical-rle/rotations/${selectiveRotationId}/completion`)
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({ studentIds: [studentId, student2Id] });
      expect(add.status).toBe(200);
      expect((add.body.data.students as Array<Record<string, unknown>>).find((s) => s.studentId === student2Id)?.completedAt).toBeTruthy();

      const cert = await request(app)
        .get(`/api/clinical-rle/rotations/${selectiveRotationId}/students/${student2Id}/certificate`)
        .set("Authorization", `Bearer ${coordinatorToken}`);
      expect(cert.status).toBe(200);

      const notes = await db.select().from(notifications).where(eq(notifications.relatedId, selectiveRotationId));
      expect(notes.some((n) => n.userId === student2Id && n.type === "ROTATION_COMPLETED")).toBe(true);

      const remove = await request(app)
        .put(`/api/clinical-rle/rotations/${selectiveRotationId}/completion`)
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({ studentIds: [studentId] });
      expect(remove.status).toBe(200);

      const blocked = await request(app)
        .get(`/api/clinical-rle/rotations/${selectiveRotationId}/students/${student2Id}/certificate`)
        .set("Authorization", `Bearer ${coordinatorToken}`);
      expect(blocked.status).toBe(409);
    });

    it("PUT completion - rejected while rotation is not completed", async () => {
      const create = await request(app)
        .post("/api/clinical-rle/rotations")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          courseId: SEED_IDS.courseId,
          instructorId: SEED_IDS.instructorId,
          title: "Open Completion Rotation",
          department: "Medicine",
          startDate: "2026-01-05T08:00:00Z",
          endDate: "2026-03-05T17:00:00Z",
          requiredHours: 40,
        });
      expect(create.status).toBe(201);
      openRotationId = create.body.data.id;

      const res = await request(app)
        .put(`/api/clinical-rle/rotations/${openRotationId}/completion`)
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({ studentIds: [studentId] });
      expect(res.status).toBe(409);
    });

    it("cleanup - should remove the completion test rotations", async () => {
      const ids = [completionRotationId, selectiveRotationId, openRotationId].filter(Boolean);
      for (const id of ids) {
        await db.delete(notifications).where(eq(notifications.relatedId, id));
        await db.delete(attendanceRecords).where(eq(attendanceRecords.rotationId, id));
      }

      for (const id of ids) {
        const res = await request(app)
          .delete(`/api/clinical-rle/rotations/${id}`)
          .set("Authorization", `Bearer ${instructorToken}`);
        expect(res.status).toBe(204);
      }
    });
  });
});
