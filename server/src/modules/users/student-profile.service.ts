import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  users,
  courseEnrollments,
  courses,
  sections,
  assessments,
  assessmentAttempts,
  clinicalCases,
  caseAttempts,
  skills,
  skillAssessments,
  carePlans,
  carePlanDiagnoses,
  clinicalRotations,
  rotationStudents,
  attendanceRecords,
  clinicalLogs,
  instructorEvaluations,
} from "../../database/schema/index.js";
import { NotFoundError } from "../../middleware/error-handler.js";

export async function getStudentProfile(studentId: string) {
  // Verify student exists
  const [student] = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, studentId));
  if (!student) throw new NotFoundError("Student");

  // Enrollments
  const studentEnrollments = await db
    .select({
      courseId: courses.id,
      courseName: courses.name,
      courseCode: courses.code,
      sectionName: sections.name,
    })
    .from(courseEnrollments)
    .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
    .leftJoin(sections, eq(courseEnrollments.sectionId, sections.id))
    .where(eq(courseEnrollments.studentId, studentId));

  const courseIds = [...new Set(studentEnrollments.map((e) => e.courseId))];

  // ─── Assessments ──────────────────────────────────────────────────────────
  const assessmentList = await db
    .select({
      id: assessments.id,
      title: assessments.title,
      courseId: assessments.courseId,
      passingScore: assessments.passingScore,
    })
    .from(assessments)
    .where(courseIds.length > 0 ? sql`${assessments.courseId} IN ${courseIds}` : sql`1 = 0`);

  const studentAttempts = await db
    .select({
      assessmentId: assessmentAttempts.assessmentId,
      score: assessmentAttempts.score,
      status: assessmentAttempts.status,
      submittedAt: assessmentAttempts.submittedAt,
    })
    .from(assessmentAttempts)
    .where(eq(assessmentAttempts.studentId, studentId))
    .orderBy(desc(assessmentAttempts.submittedAt));

  // ─── Clinical Cases ───────────────────────────────────────────────────────
  const caseList = await db
    .select({
      id: clinicalCases.id,
      title: clinicalCases.title,
      courseId: clinicalCases.courseId,
    })
    .from(clinicalCases)
    .where(courseIds.length > 0 ? sql`${clinicalCases.courseId} IN ${courseIds}` : sql`1 = 0`);

  const studentCaseAttempts = await db
    .select({
      caseId: caseAttempts.caseId,
      score: caseAttempts.score,
      totalPoints: caseAttempts.totalPoints,
      status: caseAttempts.status,
      completedAt: caseAttempts.completedAt,
    })
    .from(caseAttempts)
    .where(eq(caseAttempts.studentId, studentId))
    .orderBy(desc(caseAttempts.completedAt));

  // ─── Skills ───────────────────────────────────────────────────────────────
  const skillList = await db
    .select({
      id: skills.id,
      name: skills.name,
      category: skills.category,
    })
    .from(skills);

  const studentSkillAttempts = await db
    .select({
      skillId: skillAssessments.skillId,
      score: skillAssessments.score,
      isCompetent: skillAssessments.isCompetent,
      submittedAt: skillAssessments.completedAt,
    })
    .from(skillAssessments)
    .where(eq(skillAssessments.studentId, studentId))
    .orderBy(desc(skillAssessments.completedAt));

  // ─── Care Plans ───────────────────────────────────────────────────────────
  const studentCarePlans = await db
    .select({
      id: carePlans.id,
      title: carePlans.title,
      status: carePlans.status,
      courseId: carePlans.courseId,
      createdAt: carePlans.createdAt,
      evaluatedAt: carePlans.evaluatedAt,
      evaluationNotes: carePlans.evaluationNotes,
    })
    .from(carePlans)
    .where(eq(carePlans.studentId, studentId))
    .orderBy(desc(carePlans.createdAt));

  // ─── Rotations & Attendance ───────────────────────────────────────────────
  const studentRotationAssignments = await db
    .select({ rotationId: rotationStudents.rotationId })
    .from(rotationStudents)
    .where(eq(rotationStudents.studentId, studentId));

  const rotationIds = studentRotationAssignments.map((r) => r.rotationId);

  let rotationData: Array<Record<string, unknown>> = [];
  let totalRotationHours = 0;
  if (rotationIds.length > 0) {
    rotationData = await db
      .select({
        id: clinicalRotations.id,
        title: clinicalRotations.title,
        facility: clinicalRotations.facility,
        department: clinicalRotations.department,
        startDate: clinicalRotations.startDate,
        endDate: clinicalRotations.endDate,
        requiredHours: clinicalRotations.requiredHours,
        status: clinicalRotations.status,
      })
      .from(clinicalRotations)
      .where(sql`${clinicalRotations.id} IN ${rotationIds}`);

    const [hoursResult] = await db
      .select({ totalHours: sql<number>`coalesce(sum(${attendanceRecords.hoursLogged}), 0)::int` })
      .from(attendanceRecords)
      .where(sql`${attendanceRecords.rotationId} IN ${rotationIds} AND ${attendanceRecords.studentId} = ${studentId}`);

    totalRotationHours = hoursResult?.totalHours ?? 0;
  }

  // Get hours per rotation
  const hoursPerRotation: Record<string, number> = {};
  for (const rid of rotationIds) {
    const [h] = await db
      .select({ totalHours: sql<number>`coalesce(sum(${attendanceRecords.hoursLogged}), 0)::int` })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.rotationId, rid), eq(attendanceRecords.studentId, studentId)));
    hoursPerRotation[rid] = h?.totalHours ?? 0;
  }

  // ─── Clinical Logs ────────────────────────────────────────────────────────
  const studentLogs = await db
    .select({
      id: clinicalLogs.id,
      rotationId: clinicalLogs.rotationId,
      date: clinicalLogs.date,
      patientCount: clinicalLogs.patientCount,
      procedures: clinicalLogs.procedures,
      reflections: clinicalLogs.reflections,
      reviewedAt: clinicalLogs.reviewedAt,
      feedback: clinicalLogs.feedback,
      createdAt: clinicalLogs.createdAt,
    })
    .from(clinicalLogs)
    .where(sql`${clinicalLogs.rotationId} IN ${rotationIds}`)
    .orderBy(desc(clinicalLogs.date));

  // ─── Evaluations ──────────────────────────────────────────────────────────
  const studentEvaluations = await db
    .select({
      id: instructorEvaluations.id,
      rotationId: instructorEvaluations.rotationId,
      type: instructorEvaluations.type,
      overallScore: instructorEvaluations.overallScore,
      clinicalPerformance: instructorEvaluations.clinicalPerformance,
      professionalBehavior: instructorEvaluations.professionalBehavior,
      communicationSkills: instructorEvaluations.communicationSkills,
      criticalThinking: instructorEvaluations.criticalThinking,
      strengths: instructorEvaluations.strengths,
      areasForImprovement: instructorEvaluations.areasForImprovement,
      comments: instructorEvaluations.comments,
      evaluatedAt: instructorEvaluations.evaluatedAt,
    })
    .from(instructorEvaluations)
    .where(sql`${instructorEvaluations.rotationId} IN ${rotationIds} AND ${instructorEvaluations.studentId} = ${studentId}`)
    .orderBy(desc(instructorEvaluations.evaluatedAt));

  // ─── Compute Summary ──────────────────────────────────────────────────────
  const assessmentScores = studentAttempts
    .filter((a) => a.score !== null)
    .map((a) => a.score as number);
  const assessmentAvg = assessmentScores.length > 0
    ? Math.round(assessmentScores.reduce((s, v) => s + v, 0) / assessmentScores.length)
    : null;

  const completedCases = studentCaseAttempts.filter((a) => a.status === "COMPLETED");
  const caseScores = completedCases.map((a) => {
    const total = a.totalPoints ?? 0;
    const score = a.score ?? 0;
    return total > 0 ? Math.round((score / total) * 100) : 0;
  });
  const caseAvg = caseScores.length > 0
    ? Math.round(caseScores.reduce((s, v) => s + v, 0) / caseScores.length)
    : null;

  const skillsCompetent = studentSkillAttempts.filter((s) => s.isCompetent).length;
  const requiredHoursTotal = rotationData.reduce((sum, r) => sum + (Number(r.requiredHours) || 120), 0);

  const summary = {
    assessmentAvg,
    assessmentsAttempted: studentAttempts.length,
    assessmentsTotal: assessmentList.length,
    casesAttempted: new Set(studentCaseAttempts.map((a) => a.caseId)).size,
    casesCompleted: new Set(completedCases.map((a) => a.caseId)).size,
    casesTotal: caseList.length,
    caseAvg,
    skillsCompetent,
    skillsTotal: skillList.length,
    carePlansTotal: studentCarePlans.length,
    carePlansApproved: studentCarePlans.filter((p) => p.status === "APPROVED").length,
    carePlansCompleted: studentCarePlans.filter((p) => p.status === "COMPLETED").length,
    rotationHours: totalRotationHours,
    rotationRequired: requiredHoursTotal,
    clinicalLogsCount: studentLogs.length,
    evaluationsCount: studentEvaluations.length,
  };

  // ─── Build Timeline ───────────────────────────────────────────────────────
  type TimelineEntry = { date: string; type: string; description: string; score?: number | null; courseId?: string; link?: string };
  const timeline: TimelineEntry[] = [];

  // Assessment attempts
  for (const a of studentAttempts) {
    const assessment = assessmentList.find((ass) => ass.id === a.assessmentId);
    timeline.push({
      date: String(a.submittedAt ?? ""),
      type: "ASSESSMENT",
      description: `Completed assessment: ${assessment?.title ?? "Unknown"}`,
      score: a.score,
      courseId: assessment?.courseId,
    });
  }

  // Case attempts
  for (const a of studentCaseAttempts) {
    const clinicalCase = caseList.find((c) => c.id === a.caseId);
    const total = a.totalPoints ?? 0;
    const score = a.score ?? 0;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    timeline.push({
      date: String(a.completedAt ?? ""),
      type: "CASE",
      description: `Completed case: ${clinicalCase?.title ?? "Unknown"}`,
      score: pct,
      courseId: clinicalCase?.courseId,
      link: `/cases/${a.caseId}`,
    });
  }

  // Skills
  for (const s of studentSkillAttempts) {
    const skill = skillList.find((sk) => sk.id === s.skillId);
    timeline.push({
      date: String(s.submittedAt ?? ""),
      type: "SKILL",
      description: s.isCompetent
        ? `Skill competency achieved: ${skill?.name ?? "Unknown"}`
        : `Skill attempt: ${skill?.name ?? "Unknown"} (Score: ${s.score})`,
      score: s.score,
      link: "/skills",
    });
  }

  // Care plans
  for (const cp of studentCarePlans) {
    const course = studentEnrollments.find((e) => e.courseId === cp.courseId);
    if (cp.status === "SUBMITTED") {
      timeline.push({ date: String(cp.createdAt ?? ""), type: "CARE_PLAN", description: `Care plan submitted: ${cp.title}`, courseId: cp.courseId, link: `/care-plans/${cp.id}` });
    }
    if (cp.evaluatedAt) {
      timeline.push({ date: String(cp.evaluatedAt ?? ""), type: "CARE_PLAN", description: `Care plan ${cp.status.toLowerCase()}: ${cp.title}`, courseId: cp.courseId, link: `/care-plans/${cp.id}` });
    }
  }

  // Attendance
  if (rotationIds.length > 0) {
    const attRecords = await db
      .select({ date: attendanceRecords.date, status: attendanceRecords.status, hoursLogged: attendanceRecords.hoursLogged, rotationId: attendanceRecords.rotationId })
      .from(attendanceRecords)
      .where(sql`${attendanceRecords.rotationId} IN ${rotationIds} AND ${attendanceRecords.studentId} = ${studentId}`)
      .orderBy(desc(attendanceRecords.date));

    for (const a of attRecords) {
      const rot = rotationData.find((r) => r.id === a.rotationId);
      timeline.push({
        date: String(a.date ?? ""),
        type: "ATTENDANCE",
        description: `${a.status} — ${a.hoursLogged} hrs at ${rot?.title ?? "rotation"}`,
      });
    }
  }

  // Clinical logs
  for (const l of studentLogs) {
    const rot = rotationData.find((r) => r.id === l.rotationId);
    timeline.push({
      date: String(l.date ?? ""),
      type: "LOG",
      description: `Clinical log submitted (${l.patientCount ?? 0} patients) — ${rot?.title ?? "rotation"}`,
      link: `/my-rotations`,
    });
    if (l.reviewedAt) {
      timeline.push({
        date: String(l.reviewedAt ?? ""),
        type: "LOG_REVIEW",
        description: `Clinical log reviewed — ${rot?.title ?? "rotation"}`,
        link: `/my-rotations`,
      });
    }
  }

  // Evaluations
  for (const e of studentEvaluations) {
    const rot = rotationData.find((r) => r.id === e.rotationId);
    timeline.push({
      date: String(e.evaluatedAt ?? ""),
      type: "EVALUATION",
      description: `${e.type} evaluation — Score: ${e.overallScore ?? "—"}% — ${rot?.title ?? "rotation"}`,
      score: e.overallScore,
    });
  }

  // Sort timeline by date descending
  timeline.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db2 = b.date ? new Date(b.date).getTime() : 0;
    return db2 - da;
  });

  return {
    student,
    enrollments: studentEnrollments,
    summary,
    timeline: timeline.slice(0, 100), // Limit to 100 most recent
    assessments: assessmentList.map((ass) => ({
      ...ass,
      attempts: studentAttempts.filter((a) => a.assessmentId === ass.id),
    })),
    cases: caseList.map((c) => ({
      ...c,
      attempts: studentCaseAttempts.filter((a) => a.caseId === c.id),
    })),
    skills: skillList.map((sk) => ({
      ...sk,
      attempts: studentSkillAttempts.filter((a) => a.skillId === sk.id),
      isCompetent: studentSkillAttempts.some((a) => a.skillId === sk.id && a.isCompetent),
    })),
    carePlans: studentCarePlans,
    rotations: rotationData.map((r) => ({
      ...r,
      hoursLogged: hoursPerRotation[String(r.id)] ?? 0,
    })),
    clinicalLogs: studentLogs,
    evaluations: studentEvaluations,
  };
}
