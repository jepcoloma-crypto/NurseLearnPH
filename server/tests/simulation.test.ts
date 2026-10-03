import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { like, and, eq } from "drizzle-orm";
import { app, SEED_USERS } from "./helpers.js";
import { db } from "../src/database/index.js";
import {
  virtualPatients,
  patientScenarios,
  patientStateTransitions,
  simulationSessions,
} from "../src/database/schema/index.js";

async function loginAs(role: keyof typeof SEED_USERS): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send(SEED_USERS[role]);
  return res.body.data.accessToken;
}

// Resolved in beforeAll: seed generates fresh random UUIDs, so hardcoded ids
// break on every reseed or fresh install.
const SEED_SIM = {
  patientId: "",
  scenarioId: "",
};

describe("Simulation Module", () => {
  let instructorToken: string;
  let studentToken: string;

  beforeAll(async () => {
    instructorToken = await loginAs("instructor");
    studentToken = await loginAs("student");

    const [patient] = await db
      .select()
      .from(virtualPatients)
      .where(eq(virtualPatients.name, "Juan dela Cruz"));
    const [scenario] = await db
      .select()
      .from(patientScenarios)
      .where(eq(patientScenarios.title, "Acute Coronary Syndrome"));
    if (!patient || !scenario) {
      throw new Error(
        "Seed simulation data missing (virtual patient / scenario) — run `npm run db:seed` first."
      );
    }
    SEED_SIM.patientId = patient.id;
    SEED_SIM.scenarioId = scenario.id;
  });

  // Clean up test-created patients, scenarios, and extra transitions
  afterAll(async () => {
    // Delete test scenarios first (CASCADE cleans responses + transitions)
    await db
      .delete(patientScenarios)
      .where(like(patientScenarios.title, "Test Scenario%"));
    // Delete test patients
    await db
      .delete(virtualPatients)
      .where(like(virtualPatients.name, "Test Patient%"));
    // Clean up test-created transitions on seed scenario
    await db
      .delete(patientStateTransitions)
      .where(
        like(patientStateTransitions.triggerAction, "MISSING_MEDICATION%")
      );
    // Sessions started against the SEED scenario don't cascade with the test
    // scenario deletes — remove them directly (also discards crashed-run
    // leftovers, which linger as IN_PROGRESS rows in the student's list).
    const payload = JSON.parse(Buffer.from(studentToken.split(".")[1], "base64").toString());
    await db
      .delete(simulationSessions)
      .where(
        and(
          eq(simulationSessions.scenarioId, SEED_SIM.scenarioId),
          eq(simulationSessions.studentId, payload.userId)
        )
      );
  });

  describe("Virtual Patients", () => {
    it("GET /api/simulation/patients - should list patients", async () => {
      const res = await request(app)
        .get("/api/simulation/patients")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/simulation/patients/:id - should get patient", async () => {
      const res = await request(app)
        .get(`/api/simulation/patients/${SEED_SIM.patientId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/simulation/patients - should create patient (instructor)", async () => {
      const res = await request(app)
        .post("/api/simulation/patients")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          name: "Test Patient",
          age: 30,
          gender: "Female",
          medicalHistory: ["Hypertension"],
          allergies: ["Penicillin"],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/simulation/patients - should reject student", async () => {
      const res = await request(app)
        .post("/api/simulation/patients")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ name: "Test", age: 30, gender: "Male" });

      expect(res.status).toBe(403);
    });
  });

  describe("Scenarios", () => {
    it("GET /api/simulation/scenarios - should list scenarios", async () => {
      const res = await request(app)
        .get("/api/simulation/scenarios")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/simulation/scenarios/:id - should get scenario", async () => {
      const res = await request(app)
        .get(`/api/simulation/scenarios/${SEED_SIM.scenarioId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /api/simulation/scenarios - should create scenario (instructor)", async () => {
      const res = await request(app)
        .post("/api/simulation/scenarios")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          patientId: SEED_SIM.patientId,
          title: "Test Scenario",
          description: "Test scenario description",
          difficulty: "EASY",
          category: "Emergency",
          initialVitalSigns: { heartRate: 80, bloodPressure: "120/80" },
          initialSymptoms: ["Chest pain"],
          initialConsciousness: "ALERT",
          timeLimitMinutes: 30,
          maxScore: 100,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe("State Transitions", () => {
    it("GET /api/simulation/scenarios/:scenarioId/transitions - should list", async () => {
      const res = await request(app)
        .get(`/api/simulation/scenarios/${SEED_SIM.scenarioId}/transitions`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it("POST /api/simulation/scenarios/:scenarioId/transitions - should create (instructor)", async () => {
      const res = await request(app)
        .post(`/api/simulation/scenarios/${SEED_SIM.scenarioId}/transitions`)
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          fromState: "INITIAL",
          toState: "WORSENING",
          triggerAction: "MISSING_MEDICATION",
          newVitalSigns: { heartRate: 120 },
          newSymptoms: ["Sweating"],
        });

      expect(res.status).toBe(201);
    });
  });

  describe("Nursing Actions", () => {
    it("GET /api/simulation/actions - should list actions", async () => {
      const res = await request(app)
        .get("/api/simulation/actions")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe("Patient Responses", () => {
    it("GET /api/simulation/scenarios/:scenarioId/responses - should list", async () => {
      const res = await request(app)
        .get(`/api/simulation/scenarios/${SEED_SIM.scenarioId}/responses`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe("Simulation Sessions", () => {
    it("POST /api/simulation/sessions/start - should start session (student)", async () => {
      const res = await request(app)
        .post("/api/simulation/sessions/start")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ scenarioId: SEED_SIM.scenarioId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("IN_PROGRESS");
    });

    it("POST /api/simulation/sessions/start - should reject instructor", async () => {
      const res = await request(app)
        .post("/api/simulation/sessions/start")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ scenarioId: SEED_SIM.scenarioId });

      expect(res.status).toBe(403);
    });

    it("GET /api/simulation/sessions - should list sessions", async () => {
      const res = await request(app)
        .get("/api/simulation/sessions")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe("Validation", () => {
    it("should reject patient without name", async () => {
      const res = await request(app)
        .post("/api/simulation/patients")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ age: 30, gender: "Male" });

      expect(res.status).toBe(400);
    });

    it("should reject session start without scenarioId", async () => {
      const res = await request(app)
        .post("/api/simulation/sessions/start")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
