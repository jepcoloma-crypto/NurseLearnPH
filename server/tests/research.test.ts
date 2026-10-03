import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, SEED_USERS } from "./helpers.js";

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

describe("Research Module", () => {
  let instructorToken: string;
  let studentToken: string;
  let coordinatorToken: string;
  let projectId: string;

  beforeAll(async () => {
    instructorToken = await loginAs("instructor");
    studentToken = await loginAs("student");
    coordinatorToken = await loginAs("coordinator");
  });

  // Delete rows created by THIS run so repeated runs don't accumulate.
  // The lifecycle tests create cohorts/studies/participants/pre-post tests/
  // exports under the project, so children are removed first in FK-safe order;
  // the title sweep also catches rows left by earlier or partial runs.
  afterAll(async () => {
    const { db } = await import("../src/database/index.js");
    const {
      researchProjects, researchCohorts, researchStudies,
      researchParticipants, researchPrePostTests, researchDataExports,
    } = await import("../src/database/schema/index.js");
    const { eq, inArray } = await import("drizzle-orm");

    const purge = async (projectIds: string[]) => {
      if (projectIds.length === 0) return;
      const studies = await db.select({ id: researchStudies.id }).from(researchStudies).where(inArray(researchStudies.projectId, projectIds));
      const studyIds = studies.map((st) => st.id);
      if (studyIds.length > 0) {
        await db.delete(researchPrePostTests).where(inArray(researchPrePostTests.studyId, studyIds));
        await db.delete(researchParticipants).where(inArray(researchParticipants.studyId, studyIds));
      }
      await db.delete(researchStudies).where(inArray(researchStudies.projectId, projectIds));
      await db.delete(researchCohorts).where(inArray(researchCohorts.projectId, projectIds));
      await db.delete(researchDataExports).where(inArray(researchDataExports.projectId, projectIds));
      await db.delete(researchProjects).where(inArray(researchProjects.id, projectIds));
    };

    if (projectId) await purge([projectId]);

    const stale = await db.select({ id: researchProjects.id }).from(researchProjects).where(inArray(researchProjects.title, [
      "Effects of Nursing Intervention on Patient Outcomes",
      "Updated Research Title",
      "Ownership intact",
      "Deletable Research Project",
      "Coordinator Owned Project",
    ]));
    await purge(stale.map((row) => row.id));
  });

  describe("Projects", () => {
    it("GET /api/research/projects - should list projects", async () => {
      const res = await request(app)
        .get("/api/research/projects")
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/research/projects - should create a project (instructor)", async () => {
      const res = await request(app)
        .post("/api/research/projects")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          title: "Effects of Nursing Intervention on Patient Outcomes",
          description: "A quasi-experimental study",
          researchType: "QUASI_EXPERIMENTAL",
          startDate: "2026-01-01T00:00:00Z",
          fundingSource: "University Research Grant",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      projectId = res.body.data.id;
    });

    it("GET /api/research/projects/:id - should get a project", async () => {
      const res = await request(app)
        .get(`/api/research/projects/${projectId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(200);
    });

    it("PUT /api/research/projects/:id - should update a project", async () => {
      const res = await request(app)
        .put(`/api/research/projects/${projectId}`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ title: "Updated Research Title" });

      expect(res.status).toBe(200);
    });

    it("PUT /api/research/projects/:id - should reject student", async () => {
      const res = await request(app)
        .put(`/api/research/projects/${projectId}`)
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ title: "Student edit attempt" });

      expect(res.status).toBe(403);
    });

    it("PUT /api/research/projects/:id - should forbid editing another user's project", async () => {
      const clinicalToken = await loginAs("clinical");
      const res = await request(app)
        .put(`/api/research/projects/${projectId}`)
        .set("Authorization", `Bearer ${clinicalToken}`)
        .send({ title: "Not your project" });

      expect(res.status).toBe(403);
    });

    it("PUT /api/research/projects/:id - should let a coordinator edit any project", async () => {
      const res = await request(app)
        .put(`/api/research/projects/${projectId}`)
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({ status: "ACTIVE" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("ACTIVE");
    });

    it("PUT /api/research/projects/:id - should not allow changing the principal investigator", async () => {
      const res = await request(app)
        .put(`/api/research/projects/${projectId}`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ title: "Ownership intact", principalInvestigator: "00000000-0000-0000-0000-000000000000" });

      expect(res.status).toBe(200);

      const get = await request(app)
        .get(`/api/research/projects/${projectId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(get.body.data.title).toBe("Ownership intact");
      expect(get.body.data.principalInvestigator).not.toBe("00000000-0000-0000-0000-000000000000");
    });

    it("POST /api/research/projects - should reject student", async () => {
      const res = await request(app)
        .post("/api/research/projects")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ title: "Test", researchType: "QUALITATIVE" });

      expect(res.status).toBe(403);
    });
  });

  describe("Project Lifecycle", () => {
    let cohortId: string;
    let studyId: string;
    let participantId: string;

    it("GET endpoints - should reject student", async () => {
      const list = await request(app)
        .get("/api/research/projects")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(list.status).toBe(403);

      const detail = await request(app)
        .get(`/api/research/projects/${projectId}`)
        .set("Authorization", `Bearer ${studentToken}`);
      expect(detail.status).toBe(403);
    });

    it("POST /api/research/cohorts - should create and list a cohort", async () => {
      const create = await request(app)
        .post("/api/research/cohorts")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          projectId,
          name: "BSN Year 2 Cohort",
          description: "Second-year participants",
          cohortType: "INTERVENTION",
          targetSize: 40,
        });

      expect(create.status).toBe(201);
      cohortId = create.body.data.id;

      const list = await request(app)
        .get(`/api/research/projects/${projectId}/cohorts`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(list.status).toBe(200);
      expect(list.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("POST /api/research/studies - should create and list a study", async () => {
      const create = await request(app)
        .post("/api/research/studies")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          projectId,
          cohortId,
          title: "Simulation vs Traditional Instruction",
          description: "Pre/post comparison",
          studyDesign: "QUASI_EXPERIMENTAL",
          intervention: "High-fidelity simulation",
          controlGroup: "Traditional instruction",
          outcomeMeasures: ["Competency score", "Critical thinking"],
        });

      expect(create.status).toBe(201);
      studyId = create.body.data.id;

      const list = await request(app)
        .get(`/api/research/projects/${projectId}/studies`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(list.status).toBe(200);
      expect(list.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("POST /api/research/studies/:studyId/enroll - should enroll and list participants", async () => {
      const enroll = await request(app)
        .post(`/api/research/studies/${studyId}/enroll`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ cohortId, groupAssignment: "EXPERIMENTAL" });

      expect(enroll.status).toBe(201);
      participantId = enroll.body.data.id;
      expect(enroll.body.data.anonymousId).toMatch(/^P-/);

      const list = await request(app)
        .get(`/api/research/studies/${studyId}/participants`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(list.status).toBe(200);
      expect(list.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("POST /api/research/pre-post-tests - should record tests and compute analysis", async () => {
      const pre = await request(app)
        .post("/api/research/pre-post-tests")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ participantId, studyId, testType: "PRE", testDate: "2026-03-01T00:00:00Z", score: 7, maxScore: 10 });
      expect(pre.status).toBe(201);

      const post = await request(app)
        .post("/api/research/pre-post-tests")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ participantId, studyId, testType: "POST", testDate: "2026-05-01T00:00:00Z", score: 9, maxScore: 10 });
      expect(post.status).toBe(201);

      const analysis = await request(app)
        .get(`/api/research/studies/${studyId}/analysis`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(analysis.status).toBe(200);
      expect(analysis.body.data.preTest.count).toBeGreaterThanOrEqual(1);
      expect(analysis.body.data.postTest.count).toBeGreaterThanOrEqual(1);
      expect(analysis.body.data.preTest.averageScore).toBe(70);
      expect(analysis.body.data.postTest.averageScore).toBe(90);
      expect(analysis.body.data.improvement).toBe(20);
    });

    it("POST /api/research/exports - should export and list", async () => {
      const create = await request(app)
        .post("/api/research/exports")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ projectId, exportType: "CSV", isAnonymized: true });

      expect(create.status).toBe(201);
      expect(create.body.data.recordCount).toBeGreaterThanOrEqual(1);

      const list = await request(app)
        .get(`/api/research/projects/${projectId}/exports`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(list.status).toBe(200);
      expect(list.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("PUT /api/research/projects/:id - should update dates and IRB fields", async () => {
      const res = await request(app)
        .put(`/api/research/projects/${projectId}`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          startDate: "2026-02-01T00:00:00Z",
          endDate: "2026-06-30T00:00:00Z",
          irbNumber: "IRB-2026-TEST",
          irbApprovalDate: "2026-01-20T00:00:00Z",
        });

      expect(res.status).toBe(200);

      const get = await request(app)
        .get(`/api/research/projects/${projectId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(get.body.data.irbNumber).toBe("IRB-2026-TEST");
      expect(String(get.body.data.endDate)).toContain("2026-06-30");
      expect(String(get.body.data.irbApprovalDate)).toContain("2026-01-20");
    });
  });

  describe("Deletion", () => {
    let delProjectId: string;
    let delCohortId: string;
    let delStudyId: string;
    let delParticipantId: string;
    let coordProjectId: string;

    it("DELETE /api/research/projects/:id - should reject student", async () => {
      const created = await request(app)
        .post("/api/research/projects")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ title: "Deletable Research Project", researchType: "QUALITATIVE" });

      expect(created.status).toBe(201);
      delProjectId = created.body.data.id;

      const res = await request(app)
        .delete(`/api/research/projects/${delProjectId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    it("DELETE /api/research/projects/:id - should reject clinical instructor (role gate)", async () => {
      const clinicalToken = await loginAs("clinical");
      const res = await request(app)
        .delete(`/api/research/projects/${delProjectId}`)
        .set("Authorization", `Bearer ${clinicalToken}`);

      expect(res.status).toBe(403);
    });

    it("DELETE /api/research/projects/:id - should forbid deleting another user's project", async () => {
      const created = await request(app)
        .post("/api/research/projects")
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({ title: "Coordinator Owned Project", researchType: "CORRELATIONAL" });

      expect(created.status).toBe(201);
      coordProjectId = created.body.data.id;

      const res = await request(app)
        .delete(`/api/research/projects/${coordProjectId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(403);
    });

    it("DELETE /api/research/projects/:id - should let a coordinator delete any project", async () => {
      const res = await request(app)
        .delete(`/api/research/projects/${coordProjectId}`)
        .set("Authorization", `Bearer ${coordinatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(coordProjectId);
    });

    it("DELETE /api/research/cohorts/:id - should delete a cohort and unlink studies/participants", async () => {
      const cohort = await request(app)
        .post("/api/research/cohorts")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ projectId: delProjectId, name: "Deletable Cohort", cohortType: "CONTROL" });

      expect(cohort.status).toBe(201);
      delCohortId = cohort.body.data.id;

      const study = await request(app)
        .post("/api/research/studies")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          projectId: delProjectId,
          cohortId: delCohortId,
          title: "Deletable Study",
          studyDesign: "PRE_POST",
        });

      expect(study.status).toBe(201);
      delStudyId = study.body.data.id;

      const enrolled = await request(app)
        .post(`/api/research/studies/${delStudyId}/enroll`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ cohortId: delCohortId, groupAssignment: "CONTROL" });

      expect(enrolled.status).toBe(201);
      delParticipantId = enrolled.body.data.id;

      const res = await request(app)
        .delete(`/api/research/cohorts/${delCohortId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(200);

      const studies = await request(app)
        .get(`/api/research/projects/${delProjectId}/studies`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(studies.status).toBe(200);
      const studyRow = studies.body.data.find((s: { id: string }) => s.id === delStudyId);
      expect(studyRow).toBeTruthy();
      expect(studyRow?.cohortId ?? null).toBeNull();
    });

    it("DELETE /api/research/studies/:id - should delete a study with participants and tests", async () => {
      const pre = await request(app)
        .post("/api/research/pre-post-tests")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ participantId: delParticipantId, studyId: delStudyId, testType: "PRE", testDate: "2026-04-01T00:00:00Z", score: 5, maxScore: 10 });
      expect(pre.status).toBe(201);

      const post = await request(app)
        .post("/api/research/pre-post-tests")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ participantId: delParticipantId, studyId: delStudyId, testType: "POST", testDate: "2026-06-01T00:00:00Z", score: 8, maxScore: 10 });
      expect(post.status).toBe(201);

      const res = await request(app)
        .delete(`/api/research/studies/${delStudyId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(200);

      const participants = await request(app)
        .get(`/api/research/studies/${delStudyId}/participants`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(participants.status).toBe(200);
      expect(participants.body.data.length).toBe(0);

      const analysis = await request(app)
        .get(`/api/research/studies/${delStudyId}/analysis`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(analysis.status).toBe(200);
      expect(analysis.body.data.preTest.count).toBe(0);
      expect(analysis.body.data.postTest.count).toBe(0);
    });

    it("DELETE /api/research/projects/:id - should delete own project and 404 afterwards", async () => {
      const res = await request(app)
        .delete(`/api/research/projects/${delProjectId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(200);

      const get = await request(app)
        .get(`/api/research/projects/${delProjectId}`)
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(get.status).toBe(404);
    });
  });

  describe("Cohorts", () => {
    it("POST /api/research/cohorts - should reject student", async () => {
      const res = await request(app)
        .post("/api/research/cohorts")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          projectId: "00000000-0000-0000-0000-000000000000",
          name: "Test Cohort",
          cohortType: "INTERVENTION",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("Studies", () => {
    it("POST /api/research/studies - should reject student", async () => {
      const res = await request(app)
        .post("/api/research/studies")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          projectId: "00000000-0000-0000-0000-000000000000",
          title: "Test Study",
          studyDesign: "RANDOMIZED_CONTROLLED",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("Data Exports", () => {
    it("POST /api/research/exports - should reject student", async () => {
      const res = await request(app)
        .post("/api/research/exports")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          projectId: "00000000-0000-0000-0000-000000000000",
          exportType: "CSV",
        });

      expect(res.status).toBe(403);
    });
  });
});
