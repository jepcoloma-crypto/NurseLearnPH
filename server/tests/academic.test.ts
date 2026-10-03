import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { like, and, eq, isNotNull } from "drizzle-orm";
import { app, SEED_USERS, SEED_IDS, getStudentId } from "./helpers.js";
import { db } from "../src/database/index.js";
import { programs, courses, studentSections } from "../src/database/schema/index.js";

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

describe("Academic Module", () => {
  let adminToken: string;
  let coordinatorToken: string;
  let instructorToken: string;
  let studentToken: string;
  let studentId: string;

  beforeAll(async () => {
    adminToken = await loginAs("admin");
    coordinatorToken = await loginAs("coordinator");
    instructorToken = await loginAs("instructor");
    studentToken = await loginAs("student");
    const payload = JSON.parse(Buffer.from(studentToken.split('.')[1], 'base64').toString());
    studentId = payload.userId;
  });

  describe("Programs", () => {
    let programId: string;

    afterAll(async () => {
      // The API only soft-deletes programs, so test rows would pile up
      // invisibly with every run. Hard-delete this run's program plus any
      // BSP-<timestamp> leftovers from earlier crashed runs.
      await db
        .delete(programs)
        .where(
          and(isNotNull(programs.deletedAt), like(programs.code, "BSP-%"))
        );
      if (programId) {
        await db.delete(programs).where(eq(programs.id, programId));
      }
    });

    it("GET /api/academic/programs - should list programs (admin)", async () => {
      const res = await request(app)
        .get("/api/academic/programs")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/academic/programs - should create a program (admin)", async () => {
      const res = await request(app)
        .post("/api/academic/programs")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Bachelor of Science in Pharmacy",
          code: `BSP-${Date.now()}`,
          description: "Pharmacy program",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      programId = res.body.data.id;
    });

    it("GET /api/academic/programs/:id - should get a program", async () => {
      const res = await request(app)
        .get(`/api/academic/programs/${programId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it("PUT /api/academic/programs/:id - should update a program", async () => {
      const res = await request(app)
        .put(`/api/academic/programs/${programId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "BSP Updated" });

      expect(res.status).toBe(200);
    });

    it("DELETE /api/academic/programs/:id - should delete a program", async () => {
      if (!programId) return;
      const res = await request(app)
        .delete(`/api/academic/programs/${programId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect([200, 204]).toContain(res.status);
    });

    it("GET /api/academic/programs - should reject instructor", async () => {
      const res = await request(app)
        .get("/api/academic/programs")
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(403);
    });

    it("GET /api/academic/programs - should reject student", async () => {
      const res = await request(app)
        .get("/api/academic/programs")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe("Academic Years", () => {
    it("GET /api/academic/academic-years - should list academic years", async () => {
      const res = await request(app)
        .get("/api/academic/academic-years")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Semesters", () => {
    it("GET /api/academic/semesters - should list semesters", async () => {
      const res = await request(app)
        .get("/api/academic/semesters")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Year Levels", () => {
    it("GET /api/academic/year-levels - should list year levels", async () => {
      const res = await request(app)
        .get("/api/academic/year-levels")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Sections", () => {
    it("GET /api/academic/sections - should list sections", async () => {
      const res = await request(app)
        .get("/api/academic/sections")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Courses", () => {
    it("GET /api/academic/courses - should list courses", async () => {
      const res = await request(app)
        .get("/api/academic/courses")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Enrollments", () => {
    it("GET /api/academic/enrollments - should list enrollments", async () => {
      const res = await request(app)
        .get("/api/academic/enrollments")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/academic/enrollments - should include instructor info", async () => {
      const res = await request(app)
        .get("/api/academic/enrollments")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const item = res.body.items?.[0];
      if (item) {
        expect(item).toHaveProperty("courseName");
        expect(item).toHaveProperty("courseCode");
      }
    });

    it("POST /api/academic/enrollments - should reject student", async () => {
      const res = await request(app)
        .post("/api/academic/enrollments")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          studentId: "00000000-0000-0000-0000-000000000000",
          courseId: "00000000-0000-0000-0000-000000000000",
          sectionId: "00000000-0000-0000-0000-000000000000",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("Course Instructor Assignment", () => {
    let instructorUserId: string;
    let testCourseId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send(SEED_USERS.instructor);
      const payload = JSON.parse(Buffer.from(res.body.data.accessToken.split('.')[1], 'base64').toString());
      instructorUserId = payload.userId;

      // Work on a test-owned course: the seed leaves every course without an
      // assigned instructor, and the announcements suite temporarily assigns
      // itself to the seed course — mutating NUR101 here would race it.
      const progRes = await request(app)
        .get("/api/academic/programs?page=1&limit=1")
        .set("Authorization", `Bearer ${adminToken}`);
      const programId = progRes.body.data?.items?.[0]?.id ?? progRes.body.items?.[0]?.id ?? "";
      const ylRes = await request(app)
        .get("/api/academic/year-levels?page=1&limit=1")
        .set("Authorization", `Bearer ${adminToken}`);
      const yearLevelId = ylRes.body.data?.items?.[0]?.id ?? ylRes.body.items?.[0]?.id ?? "";
      const semRes = await request(app)
        .get("/api/academic/semesters?page=1&limit=1")
        .set("Authorization", `Bearer ${adminToken}`);
      const semesterId = semRes.body.data?.items?.[0]?.id ?? semRes.body.items?.[0]?.id ?? "";
      const createRes = await request(app)
        .post("/api/academic/courses")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: `Instructor Assignment Test ${Date.now()}`,
          code: `TIA-${Date.now()}`,
          programId,
          yearLevelId,
          semesterId,
        });
      expect(createRes.status).toBe(201);
      testCourseId = createRes.body.data.id;
    });

    afterAll(async () => {
      // The API only soft-deletes courses, so hard-delete this run's row.
      if (testCourseId) {
        await db.delete(courses).where(eq(courses.id, testCourseId));
      }
    });

    it("GET /api/academic/courses - should include instructor info", async () => {
      const res = await request(app)
        .get("/api/academic/courses")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const item = res.body.items?.[0];
      if (item) {
        expect(item).toHaveProperty("instructorId");
        expect(item).toHaveProperty("instructorFirstName");
        expect(item).toHaveProperty("instructorLastName");
      }
    });

    it("GET /api/academic/courses/:id - should include instructor info", async () => {
      const res = await request(app)
        .get(`/api/academic/courses/${SEED_IDS.courseId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("instructorFirstName");
      expect(res.body.data).toHaveProperty("instructorLastName");
    });

    it("PUT /api/academic/courses/:id - should update instructor", async () => {
      const res = await request(app)
        .put(`/api/academic/courses/${testCourseId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ instructorId: instructorUserId });

      expect(res.status).toBe(200);
      expect(res.body.data.instructorId).toBe(instructorUserId);
    });

    it("PUT /api/academic/courses/:id - should clear instructor", async () => {
      // An empty string clears the assignment (the service maps "" to null).
      const res = await request(app)
        .put(`/api/academic/courses/${testCourseId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ description: "Updated description", instructorId: "" });

      expect(res.status).toBe(200);
      expect(res.body.data.instructorId).toBeNull();
      expect(res.body.data.description).toBe("Updated description");
    });
  });

  describe("Student Sections", () => {
    let sectionId: string;
    let academicYearId: string;
    let studentSectionId: string;

    beforeAll(async () => {
      const secRes = await request(app)
        .get("/api/academic/sections?page=1&limit=50")
        .set("Authorization", `Bearer ${adminToken}`);
      sectionId = secRes.body.data?.items?.[0]?.id ?? secRes.body.items?.[0]?.id ?? "";

      if (!sectionId) {
        const ylRes = await request(app)
          .get("/api/academic/year-levels?page=1&limit=1")
          .set("Authorization", `Bearer ${adminToken}`);
        const yearLevelId = ylRes.body.data?.items?.[0]?.id ?? ylRes.body.items?.[0]?.id ?? "";
        const semRes = await request(app)
          .get("/api/academic/semesters?page=1&limit=1")
          .set("Authorization", `Bearer ${adminToken}`);
        const semesterId = semRes.body.data?.items?.[0]?.id ?? semRes.body.items?.[0]?.id ?? "";
        const createRes = await request(app)
          .post("/api/academic/sections")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ name: `Test Section ${Date.now()}`, yearLevelId, semesterId });
        sectionId = createRes.body.data?.id ?? "";
      }

      const ayRes = await request(app)
        .get("/api/academic/academic-years?page=1&limit=50")
        .set("Authorization", `Bearer ${adminToken}`);
      academicYearId = ayRes.body.data?.items?.[0]?.id ?? ayRes.body.items?.[0]?.id ?? "";
    });

    it("GET /api/academic/student-sections - should list assignments", async () => {
      const res = await request(app)
        .get("/api/academic/student-sections")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/academic/student-sections - should assign student to section", async () => {
      const res = await request(app)
        .post("/api/academic/student-sections")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ studentId, sectionId, academicYearId });

      expect([201, 409]).toContain(res.status);
      if (res.status === 201) {
        studentSectionId = res.body.data.id;
      } else {
        const listRes = await request(app)
          .get(`/api/academic/student-sections?studentId=${studentId}`)
          .set("Authorization", `Bearer ${adminToken}`);
        studentSectionId = listRes.body.items?.[0]?.id;
      }
    });

    it("GET /api/academic/sections/:sectionId/students - should list section students", async () => {
      const res = await request(app)
        .get(`/api/academic/sections/${sectionId}/students`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("DELETE /api/academic/student-sections/:id - should remove assignment", async () => {
      if (!studentSectionId) return;
      const res = await request(app)
        .delete(`/api/academic/student-sections/${studentSectionId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it("POST /api/academic/student-sections - should reject student", async () => {
      const res = await request(app)
        .post("/api/academic/student-sections")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ studentId, sectionId, academicYearId });

      expect(res.status).toBe(403);
    });

    afterAll(async () => {
      // DELETE soft-deletes the assignment (is_active = false), so every run
      // would pile up a dead row — hard-delete this run's row plus any
      // inactive leftovers for this student/section pair.
      if (studentSectionId) {
        await db.delete(studentSections).where(eq(studentSections.id, studentSectionId));
      }
      if (studentId && sectionId) {
        await db
          .delete(studentSections)
          .where(
            and(
              eq(studentSections.studentId, studentId),
              eq(studentSections.sectionId, sectionId),
              eq(studentSections.isActive, false)
            )
          );
      }
    });
  });
});
