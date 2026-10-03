import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  virtualPatients,
  patientScenarios,
  patientStateTransitions,
  nursingActions,
  patientResponses,
  simulationSessions,
  simulationActions,
  simulationDebriefings,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { NotFoundError, ForbiddenError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";

const logger = createChildLogger("simulation-service");

// ─── Virtual Patients ────────────────────────────────────────────────────────

export async function listPatients(query: { page: number; limit: number }) {
  const { page, limit } = query;
  const offset = (page - 1) * limit;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(virtualPatients);
  const items = await db.select().from(virtualPatients).orderBy(virtualPatients.name).limit(limit).offset(offset);
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getPatientById(id: string) {
  const [item] = await db.select().from(virtualPatients).where(eq(virtualPatients.id, id));
  if (!item) throw new NotFoundError("Virtual Patient");
  return item;
}

export async function createPatient(data: {
  name: string; age: number; gender: string;
  medicalHistory?: string[]; allergies?: string[]; currentMedications?: string[];
  chiefComplaint?: string; createdBy?: string;
}) {
  const [item] = await db.insert(virtualPatients).values({
    name: data.name,
    age: data.age,
    gender: data.gender,
    medicalHistory: data.medicalHistory ?? null,
    allergies: data.allergies ?? null,
    currentMedications: data.currentMedications ?? null,
    chiefComplaint: data.chiefComplaint ?? null,
    createdBy: data.createdBy ?? null,
  }).returning();

  await logAudit({ action: "CREATE", resource: "virtual_patient", resourceId: item.id, metadata: { name: data.name } });

  return item;
}

export async function updatePatient(id: string, data: Record<string, unknown>) {
  const [existing] = await db.select().from(virtualPatients).where(eq(virtualPatients.id, id));
  if (!existing) throw new NotFoundError("Virtual Patient");
  const [item] = await db.update(virtualPatients).set({ ...data, updatedAt: new Date() }).where(eq(virtualPatients.id, id)).returning();

  await logAudit({ action: "UPDATE", resource: "virtual_patient", resourceId: item.id });

  return item;
}

export async function deletePatient(id: string) {
  const [existing] = await db.select().from(virtualPatients).where(eq(virtualPatients.id, id));
  if (!existing) throw new NotFoundError("Virtual Patient");

  const scenarios = await db.select().from(patientScenarios).where(eq(patientScenarios.patientId, id));
  if (scenarios.length > 0) throw new Error("Cannot delete patient with existing scenarios. Remove scenarios first.");

  await db.delete(virtualPatients).where(eq(virtualPatients.id, id));

  await logAudit({ action: "DELETE", resource: "virtual_patient", resourceId: id });

  return { deleted: true };
}

// ─── Patient Scenarios ───────────────────────────────────────────────────────

export async function listScenarios(query: { difficulty?: string; category?: string; patientId?: string; page: number; limit: number }) {
  const { difficulty, category, patientId, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (difficulty) conditions.push(eq(patientScenarios.difficulty, difficulty));
  if (category) conditions.push(eq(patientScenarios.category, category));
  if (patientId) conditions.push(eq(patientScenarios.patientId, patientId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(patientScenarios).where(where);
  const items = await db.select().from(patientScenarios).where(where).orderBy(desc(patientScenarios.createdAt)).limit(limit).offset(offset);
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getScenarioById(id: string) {
  const [item] = await db.select().from(patientScenarios).where(eq(patientScenarios.id, id));
  if (!item) throw new NotFoundError("Patient Scenario");
  const transitions = await db.select().from(patientStateTransitions).where(eq(patientStateTransitions.scenarioId, id)).orderBy(patientStateTransitions.sortOrder);
  const responses = await db.select().from(patientResponses).where(eq(patientResponses.scenarioId, id));
  const actions = await db.select().from(nursingActions);
  return { ...item, transitions, responses, actions };
}

export async function createScenario(data: {
  patientId: string; title: string; description?: string; difficulty?: string;
  category: string; initialVitalSigns: Record<string, unknown>; initialSymptoms: string[];
  initialConsciousness?: string; learningObjectives?: string[];
  timeLimitMinutes?: number; maxScore?: number; createdBy?: string;
}) {
  const [item] = await db.insert(patientScenarios).values({
    patientId: data.patientId,
    title: data.title,
    description: data.description ?? null,
    difficulty: data.difficulty ?? "MEDIUM",
    category: data.category,
    initialVitalSigns: data.initialVitalSigns,
    initialSymptoms: data.initialSymptoms,
    initialConsciousness: data.initialConsciousness ?? "ALERT",
    learningObjectives: data.learningObjectives ?? null,
    timeLimitMinutes: data.timeLimitMinutes ?? 30,
    maxScore: data.maxScore ?? 100,
    createdBy: data.createdBy ?? null,
  }).returning();

  await logAudit({ action: "CREATE", resource: "patient_scenario", resourceId: item.id, metadata: { title: data.title, category: data.category } });

  return item;
}

export async function updateScenario(id: string, data: Record<string, unknown>) {
  const [existing] = await db.select().from(patientScenarios).where(eq(patientScenarios.id, id));
  if (!existing) throw new NotFoundError("Patient Scenario");
  const [item] = await db.update(patientScenarios).set({ ...data, updatedAt: new Date() }).where(eq(patientScenarios.id, id)).returning();

  await logAudit({ action: "UPDATE", resource: "patient_scenario", resourceId: item.id });

  return item;
}

export async function deleteScenario(id: string) {
  const [existing] = await db.select().from(patientScenarios).where(eq(patientScenarios.id, id));
  if (!existing) throw new NotFoundError("Patient Scenario");

  await db.delete(patientStateTransitions).where(eq(patientStateTransitions.scenarioId, id));
  await db.delete(patientResponses).where(eq(patientResponses.scenarioId, id));
  await db.delete(patientScenarios).where(eq(patientScenarios.id, id));

  await logAudit({ action: "DELETE", resource: "patient_scenario", resourceId: id });

  return { deleted: true };
}

// ─── State Transitions ───────────────────────────────────────────────────────

export async function listTransitions(scenarioId: string) {
  const items = await db.select().from(patientStateTransitions).where(eq(patientStateTransitions.scenarioId, scenarioId)).orderBy(patientStateTransitions.sortOrder);
  return items;
}

export async function createTransition(scenarioId: string, data: {
  triggerAction: string; newVitalSigns?: Record<string, unknown>;
  newSymptoms?: string[]; newConsciousness?: string;
  deteriorationLevel?: number; description?: string; sortOrder?: number;
}) {
  const [item] = await db.insert(patientStateTransitions).values({
    scenarioId,
    triggerAction: data.triggerAction,
    newVitalSigns: data.newVitalSigns ?? null,
    newSymptoms: data.newSymptoms ?? null,
    newConsciousness: data.newConsciousness ?? null,
    deteriorationLevel: data.deteriorationLevel ?? 0,
    description: data.description ?? null,
    sortOrder: data.sortOrder ?? 0,
  }).returning();

  await logAudit({ action: "CREATE", resource: "state_transition", resourceId: item.id, metadata: { scenarioId, triggerAction: data.triggerAction } });

  return item;
}

export async function deleteTransition(id: string) {
  const [existing] = await db.select().from(patientStateTransitions).where(eq(patientStateTransitions.id, id));
  if (!existing) throw new NotFoundError("State Transition");
  await db.delete(patientStateTransitions).where(eq(patientStateTransitions.id, id));
}

// ─── Nursing Actions ─────────────────────────────────────────────────────────

export async function listActions() {
  const items = await db.select().from(nursingActions).orderBy(nursingActions.category, nursingActions.name);
  return items;
}

export async function getActionById(id: string) {
  const [item] = await db.select().from(nursingActions).where(eq(nursingActions.id, id));
  if (!item) throw new NotFoundError("Nursing Action");
  return item;
}

export async function createAction(data: { name: string; description?: string; category: string; points?: number; isApplicableTo?: string[] }) {
  const [item] = await db.insert(nursingActions).values({
    name: data.name,
    description: data.description ?? null,
    category: data.category,
    points: data.points ?? 10,
    isApplicableTo: data.isApplicableTo ?? null,
  }).returning();

  await logAudit({ action: "CREATE", resource: "nursing_action", resourceId: item.id, metadata: { name: data.name, category: data.category } });

  return item;
}

// ─── Patient Responses ───────────────────────────────────────────────────────

export async function listResponses(scenarioId: string) {
  const items = await db.select().from(patientResponses).where(eq(patientResponses.scenarioId, scenarioId));
  return items;
}

export async function createResponse(scenarioId: string, data: {
  actionId: string; responseText: string; vitalSignsChange?: Record<string, unknown>;
  symptomChange?: string[]; pointsAwarded?: number; feedback?: string;
}) {
  const [item] = await db.insert(patientResponses).values({
    scenarioId,
    actionId: data.actionId,
    responseText: data.responseText,
    vitalSignsChange: data.vitalSignsChange ?? null,
    symptomChange: data.symptomChange ?? null,
    pointsAwarded: data.pointsAwarded ?? 0,
    feedback: data.feedback ?? null,
  }).returning();
  return item;
}

// ─── Simulation Sessions ─────────────────────────────────────────────────────

export async function listSessions(query: { studentId?: string; scenarioId?: string; page: number; limit: number }) {
  const { studentId, scenarioId, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (studentId) conditions.push(eq(simulationSessions.studentId, studentId));
  if (scenarioId) conditions.push(eq(simulationSessions.scenarioId, scenarioId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(simulationSessions).where(where);
  const items = await db.select().from(simulationSessions).where(where).orderBy(desc(simulationSessions.startedAt)).limit(limit).offset(offset);
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getSessionById(id: string) {
  const [session] = await db.select().from(simulationSessions).where(eq(simulationSessions.id, id));
  if (!session) throw new NotFoundError("Simulation Session");
  const actions = await db.select().from(simulationActions).where(eq(simulationActions.sessionId, id)).orderBy(simulationActions.performedAt);
  const [debriefing] = await db.select().from(simulationDebriefings).where(eq(simulationDebriefings.sessionId, id));
  return { ...session, actions, debriefing: debriefing ?? null };
}

export async function startSession(studentId: string, scenarioId: string) {
  const [scenario] = await db.select().from(patientScenarios).where(eq(patientScenarios.id, scenarioId));
  if (!scenario) throw new NotFoundError("Patient Scenario");

  const [session] = await db.insert(simulationSessions).values({
    scenarioId,
    studentId,
    currentVitalSigns: scenario.initialVitalSigns,
    currentSymptoms: scenario.initialSymptoms,
    currentConsciousness: scenario.initialConsciousness,
    deteriorationLevel: 0,
    status: "IN_PROGRESS",
  }).returning();

  await logAudit({ userId: studentId, action: "CREATE", resource: "simulation_session", resourceId: session.id, metadata: { scenarioId } });

  return session;
}

export async function performAction(sessionId: string, studentId: string, actionId: string, notes?: string) {
  const [session] = await db.select().from(simulationSessions).where(eq(simulationSessions.id, sessionId));
  if (!session) throw new NotFoundError("Simulation Session");
  if (session.studentId !== studentId) throw new ForbiddenError("Not your session");
  if (session.status !== "IN_PROGRESS") throw new ForbiddenError("Session not in progress");

  const [action] = await db.select().from(nursingActions).where(eq(nursingActions.id, actionId));
  if (!action) throw new NotFoundError("Nursing Action");

  const [response] = await db.select().from(patientResponses).where(
    and(eq(patientResponses.scenarioId, session.scenarioId), eq(patientResponses.actionId, actionId))
  );

  let pointsAwarded = 0;
  let newVitalSigns = session.currentVitalSigns;
  let newSymptoms = session.currentSymptoms;
  let newConsciousness = session.currentConsciousness;
  let deteriorationLevel = session.deteriorationLevel;

  if (response) {
    pointsAwarded = response.pointsAwarded;
    if (response.vitalSignsChange) {
      newVitalSigns = { ...(newVitalSigns as Record<string, unknown>), ...(response.vitalSignsChange as Record<string, unknown>) };
    }
    if (response.symptomChange) {
      newSymptoms = response.symptomChange;
    }
  }

  const [transition] = await db.select().from(patientStateTransitions).where(
    and(eq(patientStateTransitions.scenarioId, session.scenarioId), eq(patientStateTransitions.triggerAction, action.name))
  );

  if (transition) {
    if (transition.newVitalSigns) newVitalSigns = transition.newVitalSigns;
    if (transition.newSymptoms) newSymptoms = transition.newSymptoms;
    if (transition.newConsciousness) newConsciousness = transition.newConsciousness;
    deteriorationLevel = transition.deteriorationLevel;
  }

  await db.insert(simulationActions).values({
    sessionId,
    actionId,
    responseId: response?.id ?? null,
    pointsAwarded,
    notes: notes ?? null,
  });

  await db.update(simulationSessions).set({
    currentVitalSigns: newVitalSigns,
    currentSymptoms: newSymptoms,
    currentConsciousness: newConsciousness,
    deteriorationLevel,
    score: session.score + pointsAwarded,
    updatedAt: new Date(),
  }).where(eq(simulationSessions.id, sessionId));

  return { pointsAwarded, response: response?.responseText ?? "No specific response", feedback: response?.feedback ?? null };
}

export async function completeSession(sessionId: string, studentId: string) {
  const [session] = await db.select().from(simulationSessions).where(eq(simulationSessions.id, sessionId));
  if (!session) throw new NotFoundError("Simulation Session");
  if (session.studentId !== studentId) throw new ForbiddenError("Not your session");

  const now = new Date();
  const timeSpentSeconds = Math.floor((now.getTime() - session.startedAt.getTime()) / 1000);

  const [updated] = await db.update(simulationSessions).set({
    status: "COMPLETED",
    completedAt: now,
    timeSpentSeconds,
    updatedAt: now,
  }).where(eq(simulationSessions.id, sessionId)).returning();

  await logAudit({ userId: studentId, action: "UPDATE", resource: "simulation_session", resourceId: updated.id, metadata: { status: "COMPLETED", timeSpentSeconds } });

  return updated;
}

// ─── Debriefings ─────────────────────────────────────────────────────────────

export async function createDebriefing(sessionId: string, data: {
  instructorId?: string; overallRating?: number; strengths?: string;
  improvements?: string; clinicalReasoningScore?: number; technicalSkillsScore?: number;
  communicationScore?: number; timeManagementScore?: number; notes?: string;
}) {
  const [item] = await db.insert(simulationDebriefings).values({
    sessionId,
    instructorId: data.instructorId ?? null,
    overallRating: data.overallRating ?? null,
    strengths: data.strengths ?? null,
    improvements: data.improvements ?? null,
    clinicalReasoningScore: data.clinicalReasoningScore ?? null,
    technicalSkillsScore: data.technicalSkillsScore ?? null,
    communicationScore: data.communicationScore ?? null,
    timeManagementScore: data.timeManagementScore ?? null,
    notes: data.notes ?? null,
  }).returning();

  await logAudit({ userId: data.instructorId, action: "CREATE", resource: "simulation_debriefing", resourceId: item.id, metadata: { sessionId } });

  return item;
}

export async function getDebriefing(sessionId: string) {
  const [item] = await db.select().from(simulationDebriefings).where(eq(simulationDebriefings.sessionId, sessionId));
  if (!item) throw new NotFoundError("Debriefing");
  return item;
}
