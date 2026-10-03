import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  users,
  skills,
  skillChecklists,
  skillStations,
  skillAssessments,
  skillAssessmentItems,
  studentSkills,
  courses,
  courseEnrollments,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { NotFoundError, ForbiddenError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";

const logger = createChildLogger("skills-lab-service");

// ─── Skills ──────────────────────────────────────────────────────────────────

export async function listSkills(query: {
  courseId?: string;
  category?: string;
  difficulty?: string;
  instructorId?: string;
  showAll?: boolean;
  page: number;
  limit: number;
}) {
  const { courseId, category, difficulty, instructorId, showAll, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (!showAll && !instructorId) conditions.push(eq(skills.isActive, true));
  if (courseId) conditions.push(eq(skills.courseId, courseId));
  if (category) conditions.push(eq(skills.category, category));
  if (difficulty) conditions.push(eq(skills.difficulty, difficulty));

  if (instructorId) {
    // Get course IDs owned by this instructor, then filter skills by those courses
    const instructorCourses = await db.select({ id: courses.id }).from(courses).where(eq(courses.instructorId, instructorId));
    const courseIds = instructorCourses.map((c) => c.id);
    if (courseIds.length === 0) {
      return { items: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }
    conditions.push(sql`${skills.courseId} IN ${courseIds}`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(skills).where(where);
  const items = await db.select().from(skills).where(where).orderBy(skills.name).limit(limit).offset(offset);
  return {
    items,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getSkillById(id: string) {
  const [item] = await db.select().from(skills).where(eq(skills.id, id));
  if (!item) throw new NotFoundError("Skill");

  const checklists = await db.select().from(skillChecklists).where(eq(skillChecklists.skillId, id)).orderBy(skillChecklists.stepNumber);
  return { ...item, checklists };
}

export async function createSkill(
  data: {
    courseId: string;
    name: string;
    description?: string;
    category?: string;
    difficulty?: string;
    estimatedMinutes?: number;
    equipment?: string[];
  },
  createdBy?: string
) {
  const [item] = await db
    .insert(skills)
    .values({
      courseId: data.courseId,
      name: data.name,
      description: data.description ?? null,
      category: data.category ?? null,
      difficulty: data.difficulty ?? "BEGINNER",
      estimatedMinutes: data.estimatedMinutes ?? 30,
      equipment: data.equipment ?? null,
      createdBy: createdBy ?? null,
    })
    .returning();

  await logAudit({ userId: createdBy, action: "CREATE_SKILL", resource: "SKILL", resourceId: item.id });
  return item;
}

export async function updateSkill(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(skills).where(eq(skills.id, id));
  if (!existing) throw new NotFoundError("Skill");

  const [item] = await db.update(skills).set({ ...data, updatedAt: new Date() }).where(eq(skills.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_SKILL", resource: "SKILL", resourceId: id });
  return item;
}

export async function deleteSkill(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(skills).where(eq(skills.id, id));
  if (!existing) throw new NotFoundError("Skill");

  // Delete related records first (skill_assessments, student_skills)
  await db.delete(skillAssessments).where(eq(skillAssessments.skillId, id));
  await db.delete(studentSkills).where(eq(studentSkills.skillId, id));
  // skill_checklists has onDelete: cascade, so it will be auto-deleted

  await db.delete(skills).where(eq(skills.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_SKILL", resource: "SKILL", resourceId: id });
}

export async function toggleSkillStatus(id: string, toggledBy?: string) {
  const [existing] = await db.select().from(skills).where(eq(skills.id, id));
  if (!existing) throw new NotFoundError("Skill");

  const newStatus = !existing.isActive;
  await db.update(skills).set({ isActive: newStatus, updatedAt: new Date() }).where(eq(skills.id, id));
  await logAudit({ userId: toggledBy, action: "TOGGLE_SKILL_STATUS", resource: "SKILL", resourceId: id });
  return { ...existing, isActive: newStatus };
}

// ─── Checklists ──────────────────────────────────────────────────────────────

export async function addChecklist(skillId: string, data: { stepNumber: number; description: string; isCritical?: boolean }) {
  const [item] = await db
    .insert(skillChecklists)
    .values({
      skillId,
      stepNumber: data.stepNumber,
      description: data.description,
      isCritical: data.isCritical ?? false,
    })
    .returning();

  return item;
}

export async function removeChecklist(id: string) {
  const [existing] = await db.select().from(skillChecklists).where(eq(skillChecklists.id, id));
  if (!existing) throw new NotFoundError("Skill Checklist");

  await db.delete(skillChecklists).where(eq(skillChecklists.id, id));
}

// ─── Stations ────────────────────────────────────────────────────────────────

export async function listStations(query: { page: number; limit: number }) {
  const { page, limit } = query;
  const offset = (page - 1) * limit;

  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(skillStations);
  const items = await db.select().from(skillStations).orderBy(skillStations.name).limit(limit).offset(offset);

  return {
    items,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getStationById(id: string) {
  const [item] = await db.select().from(skillStations).where(eq(skillStations.id, id));
  if (!item) throw new NotFoundError("Skill Station");
  return item;
}

export async function createStation(data: { name: string; description?: string; location?: string; capacity?: number }, createdBy?: string) {
  const [item] = await db
    .insert(skillStations)
    .values({
      name: data.name,
      description: data.description ?? null,
      location: data.location ?? null,
      capacity: data.capacity ?? 1,
    })
    .returning();

  await logAudit({ userId: createdBy, action: "CREATE_STATION", resource: "SKILL_STATION", resourceId: item.id });
  return item;
}

export async function updateStation(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(skillStations).where(eq(skillStations.id, id));
  if (!existing) throw new NotFoundError("Skill Station");

  const [item] = await db.update(skillStations).set(data).where(eq(skillStations.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_STATION", resource: "SKILL_STATION", resourceId: id });
  return item;
}

export async function deleteStation(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(skillStations).where(eq(skillStations.id, id));
  if (!existing) throw new NotFoundError("Skill Station");

  await db.delete(skillStations).where(eq(skillStations.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_STATION", resource: "SKILL_STATION", resourceId: id });
}

// ─── Assessments ─────────────────────────────────────────────────────────────

export async function listAssessments(query: {
  skillId?: string;
  studentId?: string;
  instructorId?: string;
  status?: string;
  page: number;
  limit: number;
}) {
  const { skillId, studentId, instructorId, status, page, limit } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (skillId) conditions.push(eq(skillAssessments.skillId, skillId));
  if (studentId) conditions.push(eq(skillAssessments.studentId, studentId));
  if (instructorId) conditions.push(eq(skillAssessments.instructorId, instructorId));
  if (status) conditions.push(eq(skillAssessments.status, status as "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(skillAssessments).where(where);

  const items = await db.select().from(skillAssessments).where(where).orderBy(desc(skillAssessments.createdAt)).limit(limit).offset(offset);
  return {
    items,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getAssessmentById(id: string) {
  const [item] = await db.select().from(skillAssessments).where(eq(skillAssessments.id, id));
  if (!item) throw new NotFoundError("Skill Assessment");

  const items = await db.select().from(skillAssessmentItems).where(eq(skillAssessmentItems.assessmentId, id));
  return { ...item, items };
}

export async function createAssessment(
  data: {
    skillId: string;
    stationId?: string;
    studentId: string;
    instructorId: string;
    scheduledAt?: string;
  },
  createdBy?: string
) {
  const [skill] = await db.select().from(skills).where(eq(skills.id, data.skillId));
  if (!skill) throw new NotFoundError("Skill");

  const checklists = await db.select().from(skillChecklists).where(eq(skillChecklists.skillId, data.skillId));

  const [assessment] = await db
    .insert(skillAssessments)
    .values({
      skillId: data.skillId,
      stationId: data.stationId ?? null,
      studentId: data.studentId,
      instructorId: data.instructorId,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      maxScore: checklists.length * 10,
    })
    .returning();

  if (checklists.length > 0) {
    await db.insert(skillAssessmentItems).values(
      checklists.map((cl) => ({
        assessmentId: assessment.id,
        checklistId: cl.id,
        isCompleted: false,
        pointsAwarded: 0,
      }))
    );
  }

  await logAudit({ userId: createdBy, action: "CREATE_SKILL_ASSESSMENT", resource: "SKILL_ASSESSMENT", resourceId: assessment.id });
  return assessment;
}

export async function updateAssessment(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(skillAssessments).where(eq(skillAssessments.id, id));
  if (!existing) throw new NotFoundError("Skill Assessment");

  const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (data.status === "IN_PROGRESS") updateData.startedAt = new Date();
  if (data.status === "COMPLETED") updateData.completedAt = new Date();

  const [item] = await db.update(skillAssessments).set(updateData).where(eq(skillAssessments.id, id)).returning();

  if (data.status === "COMPLETED" && data.score !== undefined) {
    const [skill] = await db.select().from(skills).where(eq(skills.id, item.skillId));
    if (skill) {
      const existingStudentSkill = (await db.select().from(studentSkills).where(and(eq(studentSkills.studentId, item.studentId), eq(studentSkills.skillId, item.skillId))))[0];

      const isCompetent = typeof data.isCompetent === "boolean" ? data.isCompetent : false;

      if (existingStudentSkill) {
        const newBestScore = Math.max(existingStudentSkill.bestScore ?? 0, data.score as number);
        await db
          .update(studentSkills)
          .set({
            bestScore: newBestScore,
            attemptsCount: existingStudentSkill.attemptsCount + 1,
            isCompetent: isCompetent || existingStudentSkill.isCompetent,
            lastAssessedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(studentSkills.id, existingStudentSkill.id));
      } else {
        await db.insert(studentSkills).values({
          studentId: item.studentId,
          skillId: item.skillId,
          isCompetent,
          bestScore: data.score as number,
          attemptsCount: 1,
          lastAssessedAt: new Date(),
        });
      }
    }
  }

  await logAudit({ userId: updatedBy, action: "UPDATE_SKILL_ASSESSMENT", resource: "SKILL_ASSESSMENT", resourceId: id });
  return item;
}

export async function submitChecklist(assessmentId: string, items: Array<{ checklistId: string; isCompleted: boolean; notes?: string; pointsAwarded?: number }>) {
  const [assessment] = await db.select().from(skillAssessments).where(eq(skillAssessments.id, assessmentId));
  if (!assessment) throw new NotFoundError("Skill Assessment");

  let totalPoints = 0;

  for (const item of items) {
    await db
      .update(skillAssessmentItems)
      .set({
        isCompleted: item.isCompleted,
        notes: item.notes ?? null,
        pointsAwarded: item.pointsAwarded ?? 0,
      })
      .where(and(eq(skillAssessmentItems.assessmentId, assessmentId), eq(skillAssessmentItems.checklistId, item.checklistId)));

    totalPoints += item.pointsAwarded ?? 0;
  }

  return { assessmentId, totalPoints };
}

// ─── Instructor Assessment from Pending Request ──────────────────────────────

export async function createAssessmentFromRequest(studentSkillId: string, instructorId: string) {
  // Find the student skill record with pending request
  const [studentSkill] = await db.select().from(studentSkills).where(eq(studentSkills.id, studentSkillId));
  if (!studentSkill) throw new NotFoundError("Student Skill record");
  if (studentSkill.status !== "PENDING_ASSESSMENT") throw new ForbiddenError("Skill is not pending assessment");

  // Get checklists for this skill
  const checklists = await db.select().from(skillChecklists).where(eq(skillChecklists.skillId, studentSkill.skillId)).orderBy(skillChecklists.stepNumber);
  const checkedItems = (studentSkill.checkedItems as string[] | null) ?? [];

  // Create assessment
  const [assessment] = await db
    .insert(skillAssessments)
    .values({
      skillId: studentSkill.skillId,
      studentId: studentSkill.studentId,
      instructorId,
      studentSkillId: studentSkill.id,
      status: "IN_PROGRESS",
      startedAt: new Date(),
      maxScore: checklists.length * 10,
    })
    .returning();

  // Pre-populate assessment items — student's checked items marked as completed
  if (checklists.length > 0) {
    await db.insert(skillAssessmentItems).values(
      checklists.map((cl) => ({
        assessmentId: assessment.id,
        checklistId: cl.id,
        isCompleted: checkedItems.includes(cl.id),
        pointsAwarded: checkedItems.includes(cl.id) ? 10 : 0,
      }))
    );
  }

  await logAudit({ userId: instructorId, action: "CREATE_ASSESSMENT_FROM_REQUEST", resource: "SKILL_ASSESSMENT", resourceId: assessment.id });
  return assessment;
}

export async function getAssessmentDetails(assessmentId: string) {
  const [assessment] = await db.select().from(skillAssessments).where(eq(skillAssessments.id, assessmentId));
  if (!assessment) throw new NotFoundError("Skill Assessment");

  const items = await db
    .select({
      id: skillAssessmentItems.id,
      checklistId: skillAssessmentItems.checklistId,
      isCompleted: skillAssessmentItems.isCompleted,
      notes: skillAssessmentItems.notes,
      pointsAwarded: skillAssessmentItems.pointsAwarded,
      stepNumber: skillChecklists.stepNumber,
      description: skillChecklists.description,
      isCritical: skillChecklists.isCritical,
    })
    .from(skillAssessmentItems)
    .innerJoin(skillChecklists, eq(skillAssessmentItems.checklistId, skillChecklists.id))
    .where(eq(skillAssessmentItems.assessmentId, assessmentId))
    .orderBy(skillChecklists.stepNumber);

  const [skill] = await db.select().from(skills).where(eq(skills.id, assessment.skillId));
  const [student] = await db.select({ firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(eq(users.id, assessment.studentId));

  // Get student's original checked items from practice
  let studentCheckedItems: string[] = [];
  if (assessment.studentSkillId) {
    const [studentSkill] = await db.select({ checkedItems: studentSkills.checkedItems }).from(studentSkills).where(eq(studentSkills.id, assessment.studentSkillId));
    studentCheckedItems = (studentSkill?.checkedItems as string[] | null) ?? [];
  }

  return {
    ...assessment,
    skill,
    student,
    items,
    studentCheckedItems,
  };
}

export async function gradeAndCompleteAssessment(
  assessmentId: string,
  items: Array<{ checklistId: string; isCompleted: boolean; notes?: string; pointsAwarded?: number }>,
  overallFeedback: string,
  isCompetent: boolean
) {
  const [assessment] = await db.select().from(skillAssessments).where(eq(skillAssessments.id, assessmentId));
  if (!assessment) throw new NotFoundError("Skill Assessment");

  let totalPoints = 0;

  // Grade each item
  for (const item of items) {
    await db
      .update(skillAssessmentItems)
      .set({
        isCompleted: item.isCompleted,
        notes: item.notes ?? null,
        pointsAwarded: item.pointsAwarded ?? 0,
      })
      .where(and(eq(skillAssessmentItems.assessmentId, assessmentId), eq(skillAssessmentItems.checklistId, item.checklistId)));

    totalPoints += item.pointsAwarded ?? 0;
  }

  // Calculate score as percentage
  const score = assessment.maxScore > 0 ? Math.round((totalPoints / assessment.maxScore) * 100) : 0;

  // Complete the assessment
  const [updated] = await db
    .update(skillAssessments)
    .set({
      status: "COMPLETED",
      completedAt: new Date(),
      score,
      isCompetent,
      feedback: overallFeedback,
      updatedAt: new Date(),
    })
    .where(eq(skillAssessments.id, assessmentId))
    .returning();

  // Update studentSkills record
  if (assessment.studentSkillId) {
    const [existing] = await db.select().from(studentSkills).where(eq(studentSkills.id, assessment.studentSkillId));
    if (existing) {
      const newBest = Math.max(existing.bestScore ?? 0, score);
      await db
        .update(studentSkills)
        .set({
          status: isCompetent ? "COMPLETED" : "PRACTICED",
          isCompetent,
          bestScore: newBest,
          lastAssessedAt: new Date(),
          signedOffBy: assessment.instructorId,
          signedOffAt: isCompetent ? new Date() : null,
          requestedAssessment: false,
          updatedAt: new Date(),
        })
        .where(eq(studentSkills.id, assessment.studentSkillId));
    }
  }

  await logAudit({ userId: assessment.instructorId, action: "GRADE_SKILL_ASSESSMENT", resource: "SKILL_ASSESSMENT", resourceId: assessmentId });
  return { ...updated, totalPoints, score, isCompetent };
}

// ─── Student Skills ──────────────────────────────────────────────────────────

export async function getStudentSkills(studentId: string) {
  const items = await db.select().from(studentSkills).where(eq(studentSkills.studentId, studentId));
  return items;
}

export async function getStudentSkillsWithDetails(studentId: string) {
  // Get all courses the student is enrolled in
  const enrollments = await db.select({ courseId: courseEnrollments.courseId })
    .from(courseEnrollments)
    .where(eq(courseEnrollments.studentId, studentId));
  const courseIds = enrollments.map((e) => e.courseId);

  // Get all active skills from enrolled courses (students only see published/active)
  const allSkills = courseIds.length > 0
    ? await db.select().from(skills).where(and(inArray(skills.courseId, courseIds), eq(skills.isActive, true)))
    : [];

  // Get existing student skill records
  const existingRecords = await db.select().from(studentSkills).where(eq(studentSkills.studentId, studentId));
  const recordMap = new Map(existingRecords.map((r) => [r.skillId, r]));

  // Merge: every skill from enrolled courses + any existing practice records
  const enriched = await Promise.all(
    allSkills.map(async (skill) => {
      const existing = recordMap.get(skill.id);
      const checklists = await db.select().from(skillChecklists)
        .where(eq(skillChecklists.skillId, skill.id))
        .orderBy(skillChecklists.stepNumber);
      return {
        id: existing?.id ?? null,
        studentId,
        skillId: skill.id,
        status: existing?.status ?? "NOT_STARTED",
        isCompetent: existing?.isCompetent ?? false,
        bestScore: existing?.bestScore ?? 0,
        attemptsCount: existing?.attemptsCount ?? 0,
        checkedItems: existing?.checkedItems ?? null,
        lastPracticeAt: existing?.lastPracticeAt ?? null,
        requestedAssessment: existing?.requestedAssessment ?? false,
        lastAssessedAt: existing?.lastAssessedAt ?? null,
        signedOffBy: existing?.signedOffBy ?? null,
        signedOffAt: existing?.signedOffAt ?? null,
        createdAt: existing?.createdAt ?? null,
        updatedAt: existing?.updatedAt ?? null,
        skill,
        checklists,
      };
    })
  );
  return enriched;
}

export async function practiceSkill(studentId: string, skillId: string, checkedItems: string[]) {
  // Upsert student skill record
  const [existing] = await db.select().from(studentSkills).where(and(eq(studentSkills.studentId, studentId), eq(studentSkills.skillId, skillId)));

  if (existing) {
    const newCount = existing.attemptsCount + 1;
    // Calculate score: % of critical items checked
    const allChecklists = await db.select().from(skillChecklists).where(eq(skillChecklists.skillId, skillId));
    const criticalItems = allChecklists.filter((c) => c.isCritical);
    const checkedCritical = criticalItems.filter((c) => checkedItems.includes(c.id));
    const score = criticalItems.length > 0 ? Math.round((checkedCritical.length / criticalItems.length) * 100) : 100;
    const newBest = Math.max(existing.bestScore ?? 0, score);

    const [item] = await db
      .update(studentSkills)
      .set({
        status: "PRACTICED",
        attemptsCount: newCount,
        bestScore: newBest,
        checkedItems: checkedItems,
        lastPracticeAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(studentSkills.id, existing.id))
      .returning();

    await logAudit({ userId: studentId, action: "PRACTICE_SKILL", resource: "STUDENT_SKILL", resourceId: item.id });
    return item;
  } else {
    const allChecklists = await db.select().from(skillChecklists).where(eq(skillChecklists.skillId, skillId));
    const criticalItems = allChecklists.filter((c) => c.isCritical);
    const checkedCritical = criticalItems.filter((c) => checkedItems.includes(c.id));
    const score = criticalItems.length > 0 ? Math.round((checkedCritical.length / criticalItems.length) * 100) : 100;

    const [item] = await db
      .insert(studentSkills)
      .values({
        studentId,
        skillId,
        status: "PRACTICED",
        attemptsCount: 1,
        bestScore: score,
        checkedItems: checkedItems,
        lastPracticeAt: new Date(),
      })
      .returning();

    await logAudit({ userId: studentId, action: "PRACTICE_SKILL", resource: "STUDENT_SKILL", resourceId: item.id });
    return item;
  }
}

export async function requestAssessment(studentId: string, skillId: string) {
  const [existing] = await db.select().from(studentSkills).where(and(eq(studentSkills.studentId, studentId), eq(studentSkills.skillId, skillId)));
  if (!existing) throw new NotFoundError("Student Skill record");

  const [item] = await db
    .update(studentSkills)
    .set({
      status: "PENDING_ASSESSMENT",
      requestedAssessment: true,
      updatedAt: new Date(),
    })
    .where(eq(studentSkills.id, existing.id))
    .returning();

  await logAudit({ userId: studentId, action: "REQUEST_ASSESSMENT", resource: "STUDENT_SKILL", resourceId: item.id });
  return item;
}

export async function getPendingAssessments() {
  const items = await db
    .select({
      id: studentSkills.id,
      studentId: studentSkills.studentId,
      skillId: studentSkills.skillId,
      status: studentSkills.status,
      bestScore: studentSkills.bestScore,
      attemptsCount: studentSkills.attemptsCount,
      checkedItems: studentSkills.checkedItems,
      requestedAssessment: studentSkills.requestedAssessment,
      lastPracticeAt: studentSkills.lastPracticeAt,
      studentFirstName: users.firstName,
      studentLastName: users.lastName,
      skillName: skills.name,
      skillCategory: skills.category,
    })
    .from(studentSkills)
    .innerJoin(users, eq(studentSkills.studentId, users.id))
    .innerJoin(skills, eq(studentSkills.skillId, skills.id))
    .where(eq(studentSkills.status, "PENDING_ASSESSMENT"))
    .orderBy(desc(studentSkills.lastPracticeAt));

  return items;
}

export async function signOffSkill(studentId: string, skillId: string, signedOffBy: string) {
  const [existing] = await db.select().from(studentSkills).where(and(eq(studentSkills.studentId, studentId), eq(studentSkills.skillId, skillId)));
  if (!existing) throw new NotFoundError("Student Skill record");

  const [item] = await db
    .update(studentSkills)
    .set({
      status: "COMPLETED",
      isCompetent: true,
      requestedAssessment: false,
      signedOffBy,
      signedOffAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(studentSkills.id, existing.id))
    .returning();

  await logAudit({ userId: signedOffBy, action: "SIGN_OFF_SKILL", resource: "STUDENT_SKILL", resourceId: item.id });
  return item;
}
