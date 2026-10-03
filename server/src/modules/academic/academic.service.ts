import { eq, and, desc, sql, aliasedTable, ne } from "drizzle-orm";
import { db } from "../../database/index.js";
import {
  programs,
  academicYears,
  semesters,
  yearLevels,
  sections,
  courses,
  courseEnrollments,
  learningOutcomes,
  users,
  studentSections,
} from "../../database/schema/index.js";
import { logAudit } from "../../services/audit.service.js";
import { NotFoundError, ConflictError } from "../../middleware/error-handler.js";
import { createChildLogger } from "../../utils/logger.js";

const logger = createChildLogger("academic-service");

function buildSearchCondition(
  field: { name: string },
  search: string
) {
  return sql`lower(${field}) LIKE lower(${`%${search}%`})`;
}

// ─── Programs ────────────────────────────────────────────────────────────────

export async function listPrograms(query: {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}) {
  const { page, limit, search, isActive } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [sql`${programs.deletedAt} IS NULL`];

  if (search) conditions.push(buildSearchCondition(programs.name, search));
  if (isActive !== undefined) conditions.push(eq(programs.isActive, isActive));

  const where = and(...conditions);
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(programs)
    .where(where);

  const items = await db
    .select()
    .from(programs)
    .where(where)
    .orderBy(desc(programs.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) },
  };
}

export async function getProgramById(id: string) {
  const [item] = await db.select().from(programs).where(eq(programs.id, id));
  if (!item) throw new NotFoundError("Program");
  return item;
}

export async function createProgram(data: { name: string; code: string; description?: string }, createdBy?: string) {
  const [existing] = await db.select().from(programs).where(eq(programs.code, data.code));
  if (existing) throw new ConflictError("Program code already exists");

  const [item] = await db.insert(programs).values(data).returning();
  await logAudit({ userId: createdBy, action: "CREATE_PROGRAM", resource: "PROGRAM", resourceId: item.id });
  logger.info({ id: item.id }, "Program created");
  return item;
}

export async function updateProgram(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(programs).where(eq(programs.id, id));
  if (!existing || existing.deletedAt) throw new NotFoundError("Program");

  if (data.code && data.code !== existing.code) {
    const [taken] = await db.select().from(programs).where(eq(programs.code, data.code as string));
    if (taken) throw new ConflictError("Program code already exists");
  }

  const [item] = await db.update(programs).set({ ...data, updatedAt: new Date() }).where(eq(programs.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_PROGRAM", resource: "PROGRAM", resourceId: id });
  return item;
}

export async function deleteProgram(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(programs).where(eq(programs.id, id));
  if (!existing || existing.deletedAt) throw new NotFoundError("Program");

  await db.update(programs).set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() }).where(eq(programs.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_PROGRAM", resource: "PROGRAM", resourceId: id });
  logger.info({ id }, "Program soft-deleted");
}

// ─── Academic Years ──────────────────────────────────────────────────────────

export async function listAcademicYears(query: { page: number; limit: number; programId?: string; isActive?: boolean }) {
  const { page, limit, programId, isActive } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (programId) conditions.push(eq(academicYears.programId, programId));
  if (isActive !== undefined) conditions.push(eq(academicYears.isActive, isActive));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(academicYears).where(where);

  const items = await db
    .select({
      id: academicYears.id,
      name: academicYears.name,
      programId: academicYears.programId,
      startDate: academicYears.startDate,
      endDate: academicYears.endDate,
      isActive: academicYears.isActive,
      createdAt: academicYears.createdAt,
      updatedAt: academicYears.updatedAt,
      programName: programs.name,
    })
    .from(academicYears)
    .leftJoin(programs, eq(academicYears.programId, programs.id))
    .where(where)
    .orderBy(desc(academicYears.createdAt))
    .limit(limit)
    .offset(offset);
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getAcademicYearById(id: string) {
  const [item] = await db.select().from(academicYears).where(eq(academicYears.id, id));
  if (!item) throw new NotFoundError("Academic Year");
  return item;
}

export async function createAcademicYear(data: { name: string; programId: string; startDate: string; endDate: string }, createdBy?: string) {
  const [item] = await db.insert(academicYears).values({ ...data, startDate: new Date(data.startDate), endDate: new Date(data.endDate) }).returning();
  await logAudit({ userId: createdBy, action: "CREATE_ACADEMIC_YEAR", resource: "ACADEMIC_YEAR", resourceId: item.id });
  return item;
}

export async function updateAcademicYear(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(academicYears).where(eq(academicYears.id, id));
  if (!existing) throw new NotFoundError("Academic Year");

  const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (data.startDate) updateData.startDate = new Date(data.startDate as string);
  if (data.endDate) updateData.endDate = new Date(data.endDate as string);

  const [item] = await db.update(academicYears).set(updateData).where(eq(academicYears.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_ACADEMIC_YEAR", resource: "ACADEMIC_YEAR", resourceId: id });
  return item;
}

// ─── Semesters ───────────────────────────────────────────────────────────────

export async function listSemesters(query: { page: number; limit: number; academicYearId?: string; isActive?: boolean }) {
  const { page, limit, academicYearId, isActive } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];

  if (academicYearId) conditions.push(eq(semesters.academicYearId, academicYearId));
  if (isActive !== undefined) conditions.push(eq(semesters.isActive, isActive));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(semesters).where(where);

  const items = await db
    .select({
      id: semesters.id,
      name: semesters.name,
      academicYearId: semesters.academicYearId,
      startDate: semesters.startDate,
      endDate: semesters.endDate,
      isActive: semesters.isActive,
      createdAt: semesters.createdAt,
      updatedAt: semesters.updatedAt,
      academicYearName: academicYears.name,
    })
    .from(semesters)
    .leftJoin(academicYears, eq(semesters.academicYearId, academicYears.id))
    .where(where)
    .orderBy(desc(semesters.createdAt))
    .limit(limit)
    .offset(offset);
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getSemesterById(id: string) {
  const [item] = await db.select().from(semesters).where(eq(semesters.id, id));
  if (!item) throw new NotFoundError("Semester");
  return item;
}

export async function createSemester(data: { name: string; academicYearId: string; startDate: string; endDate: string }, createdBy?: string) {
  const [item] = await db.insert(semesters).values({ ...data, startDate: new Date(data.startDate), endDate: new Date(data.endDate) }).returning();
  await logAudit({ userId: createdBy, action: "CREATE_SEMESTER", resource: "SEMESTER", resourceId: item.id });
  return item;
}

export async function updateSemester(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(semesters).where(eq(semesters.id, id));
  if (!existing) throw new NotFoundError("Semester");

  const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (data.startDate) updateData.startDate = new Date(data.startDate as string);
  if (data.endDate) updateData.endDate = new Date(data.endDate as string);

  const [item] = await db.update(semesters).set(updateData).where(eq(semesters.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_SEMESTER", resource: "SEMESTER", resourceId: id });
  return item;
}

// ─── Year Levels ─────────────────────────────────────────────────────────────

export async function listYearLevels(query: { page: number; limit: number; programId?: string }) {
  const { page, limit, programId } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (programId) conditions.push(eq(yearLevels.programId, programId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(yearLevels).where(where);

  const items = await db
    .select({
      id: yearLevels.id,
      name: yearLevels.name,
      programId: yearLevels.programId,
      order: yearLevels.order,
      createdAt: yearLevels.createdAt,
      programName: programs.name,
    })
    .from(yearLevels)
    .leftJoin(programs, eq(yearLevels.programId, programs.id))
    .where(where)
    .orderBy(yearLevels.order)
    .limit(limit)
    .offset(offset);
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getYearLevelById(id: string) {
  const [item] = await db.select().from(yearLevels).where(eq(yearLevels.id, id));
  if (!item) throw new NotFoundError("Year Level");
  return item;
}

export async function createYearLevel(data: { name: string; programId: string; order: number }, createdBy?: string) {
  const [item] = await db.insert(yearLevels).values(data).returning();
  await logAudit({ userId: createdBy, action: "CREATE_YEAR_LEVEL", resource: "YEAR_LEVEL", resourceId: item.id });
  return item;
}

export async function updateYearLevel(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(yearLevels).where(eq(yearLevels.id, id));
  if (!existing) throw new NotFoundError("Year Level");

  const [item] = await db.update(yearLevels).set(data).where(eq(yearLevels.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_YEAR_LEVEL", resource: "YEAR_LEVEL", resourceId: id });
  return item;
}

export async function deleteYearLevel(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(yearLevels).where(eq(yearLevels.id, id));
  if (!existing) throw new NotFoundError("Year Level");

  await db.delete(yearLevels).where(eq(yearLevels.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_YEAR_LEVEL", resource: "YEAR_LEVEL", resourceId: id });
}

export async function deleteSemester(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(semesters).where(eq(semesters.id, id));
  if (!existing) throw new NotFoundError("Semester");

  await db.delete(semesters).where(eq(semesters.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_SEMESTER", resource: "SEMESTER", resourceId: id });
}

export async function deleteAcademicYear(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(academicYears).where(eq(academicYears.id, id));
  if (!existing) throw new NotFoundError("Academic Year");

  await db.delete(academicYears).where(eq(academicYears.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_ACADEMIC_YEAR", resource: "ACADEMIC_YEAR", resourceId: id });
}

// ─── Sections ────────────────────────────────────────────────────────────────

export async function listSections(query: { page: number; limit: number; yearLevelId?: string; semesterId?: string }) {
  const { page, limit, yearLevelId, semesterId } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [];
  if (yearLevelId) conditions.push(eq(sections.yearLevelId, yearLevelId));
  if (semesterId) conditions.push(eq(sections.semesterId, semesterId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(sections).where(where);

  const items = await db
    .select({
      id: sections.id,
      name: sections.name,
      yearLevelId: sections.yearLevelId,
      semesterId: sections.semesterId,
      createdAt: sections.createdAt,
      yearLevelName: yearLevels.name,
      semesterName: semesters.name,
    })
    .from(sections)
    .leftJoin(yearLevels, eq(sections.yearLevelId, yearLevels.id))
    .leftJoin(semesters, eq(sections.semesterId, semesters.id))
    .where(where)
    .orderBy(desc(sections.createdAt))
    .limit(limit)
    .offset(offset);
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getSectionById(id: string) {
  const [item] = await db.select().from(sections).where(eq(sections.id, id));
  if (!item) throw new NotFoundError("Section");
  return item;
}

export async function createSection(data: { name: string; yearLevelId: string; semesterId: string }, createdBy?: string) {
  const [item] = await db.insert(sections).values(data).returning();
  await logAudit({ userId: createdBy, action: "CREATE_SECTION", resource: "SECTION", resourceId: item.id });
  return item;
}

export async function updateSection(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(sections).where(eq(sections.id, id));
  if (!existing) throw new NotFoundError("Section");

  const [item] = await db.update(sections).set(data).where(eq(sections.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_SECTION", resource: "SECTION", resourceId: id });
  return item;
}

export async function deleteSection(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(sections).where(eq(sections.id, id));
  if (!existing) throw new NotFoundError("Section");

  await db.delete(sections).where(eq(sections.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_SECTION", resource: "SECTION", resourceId: id });
}

// ─── Courses ─────────────────────────────────────────────────────────────────

export async function listCourses(query: { page: number; limit: number; programId?: string; yearLevelId?: string; semesterId?: string; instructorId?: string; search?: string; isActive?: boolean; studentId?: string }) {
  const { page, limit, programId, yearLevelId, semesterId, instructorId, search, isActive, studentId } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [sql`${courses.deletedAt} IS NULL`];

  if (programId) conditions.push(eq(courses.programId, programId));
  if (yearLevelId) conditions.push(eq(courses.yearLevelId, yearLevelId));
  if (semesterId) conditions.push(eq(courses.semesterId, semesterId));
  if (instructorId) conditions.push(eq(courses.instructorId, instructorId));
  if (isActive !== undefined) conditions.push(eq(courses.isActive, isActive));
  // Students may only see courses they are actively enrolled in
  if (studentId) {
    conditions.push(sql`${courses.id} IN (SELECT ${courseEnrollments.courseId} FROM ${courseEnrollments} WHERE ${courseEnrollments.studentId} = ${studentId} AND ${courseEnrollments.isActive} = true)`);
  }
  if (search) conditions.push(sql`(${buildSearchCondition(courses.name, search)} OR ${buildSearchCondition(courses.code, search)})`);

  const where = and(...conditions);
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(courses).where(where);

  const items = await db
    .select({
      id: courses.id,
      name: courses.name,
      code: courses.code,
      description: courses.description,
      programId: courses.programId,
      yearLevelId: courses.yearLevelId,
      semesterId: courses.semesterId,
      instructorId: courses.instructorId,
      credits: courses.credits,
      isActive: courses.isActive,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
      instructorFirstName: users.firstName,
      instructorLastName: users.lastName,
      instructorEmail: users.email,
      studentCount: sql<number>`(SELECT count(*)::int FROM ${courseEnrollments} ce WHERE ce.course_id = ${courses.id} AND ce.is_active = true)`,
    })
    .from(courses)
    .leftJoin(users, eq(courses.instructorId, users.id))
    .where(where)
    .orderBy(desc(courses.createdAt))
    .limit(limit)
    .offset(offset);
  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getCourseById(id: string) {
  const [item] = await db
    .select({
      id: courses.id,
      name: courses.name,
      code: courses.code,
      description: courses.description,
      programId: courses.programId,
      yearLevelId: courses.yearLevelId,
      semesterId: courses.semesterId,
      instructorId: courses.instructorId,
      credits: courses.credits,
      isActive: courses.isActive,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
      instructorFirstName: users.firstName,
      instructorLastName: users.lastName,
      instructorEmail: users.email,
    })
    .from(courses)
    .leftJoin(users, eq(courses.instructorId, users.id))
    .where(eq(courses.id, id));
  if (!item) throw new NotFoundError("Course");
  return item;
}

export async function createCourse(data: { name: string; code: string; description?: string; programId: string; yearLevelId: string; semesterId: string; instructorId?: string; credits?: number }, createdBy?: string) {
  const [existing] = await db.select().from(courses).where(eq(courses.code, data.code));
  if (existing) throw new ConflictError("Course code already exists");

  const [item] = await db.insert(courses).values(data).returning();
  await logAudit({ userId: createdBy, action: "CREATE_COURSE", resource: "COURSE", resourceId: item.id });
  return item;
}

export async function updateCourse(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(courses).where(eq(courses.id, id));
  if (!existing || existing.deletedAt) throw new NotFoundError("Course");

  if (data.code && data.code !== existing.code) {
    const [taken] = await db.select().from(courses).where(eq(courses.code, data.code as string));
    if (taken) throw new ConflictError("Course code already exists");
  }

  if (data.instructorId === "") data.instructorId = null;

  const [item] = await db.update(courses).set({ ...data, updatedAt: new Date() }).where(eq(courses.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_COURSE", resource: "COURSE", resourceId: id });
  return item;
}

export async function deleteCourse(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(courses).where(eq(courses.id, id));
  if (!existing || existing.deletedAt) throw new NotFoundError("Course");

  await db.update(courses).set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() }).where(eq(courses.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_COURSE", resource: "COURSE", resourceId: id });
}

// ─── Course Enrollments ──────────────────────────────────────────────────────

export async function listEnrollments(query: { page: number; limit: number; courseId?: string; sectionId?: string; studentId?: string; instructorId?: string }) {
  const { page, limit, courseId, sectionId, studentId, instructorId } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [eq(courseEnrollments.isActive, true)];

  if (courseId) conditions.push(eq(courseEnrollments.courseId, courseId));
  if (sectionId) conditions.push(eq(courseEnrollments.sectionId, sectionId));
  if (studentId) conditions.push(eq(courseEnrollments.studentId, studentId));
  if (instructorId) conditions.push(eq(courses.instructorId, instructorId));

  const where = and(...conditions);
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(courseEnrollments).innerJoin(courses, eq(courseEnrollments.courseId, courses.id)).where(where);

  const instructorUsers = aliasedTable(users, "instructor_users");

  const items = await db
    .select({
      id: courseEnrollments.id,
      studentId: courseEnrollments.studentId,
      courseId: courseEnrollments.courseId,
      sectionId: courseEnrollments.sectionId,
      enrolledAt: courseEnrollments.enrolledAt,
      isActive: courseEnrollments.isActive,
      studentFirstName: users.firstName,
      studentLastName: users.lastName,
      studentEmail: users.email,
      courseName: courses.name,
      courseCode: courses.code,
      instructorId: courses.instructorId,
      instructorFirstName: instructorUsers.firstName,
      instructorLastName: instructorUsers.lastName,
      instructorEmail: instructorUsers.email,
      sectionName: sections.name,
      yearLevelId: sections.yearLevelId,
      yearLevelName: yearLevels.name,
      semesterId: sections.semesterId,
      semesterName: semesters.name,
    })
    .from(courseEnrollments)
    .innerJoin(users, eq(courseEnrollments.studentId, users.id))
    .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
    .leftJoin(instructorUsers, eq(courses.instructorId, instructorUsers.id))
    .leftJoin(sections, eq(courseEnrollments.sectionId, sections.id))
    .leftJoin(yearLevels, eq(sections.yearLevelId, yearLevels.id))
    .leftJoin(semesters, eq(sections.semesterId, semesters.id))
    .where(where)
    .orderBy(desc(courseEnrollments.enrolledAt))
    .limit(limit)
    .offset(offset);

  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function enrollStudent(data: { studentId: string; courseId: string; sectionId: string }, createdBy?: string) {
  const [existing] = await db
    .select()
    .from(courseEnrollments)
    .where(
      and(
        eq(courseEnrollments.studentId, data.studentId),
        eq(courseEnrollments.courseId, data.courseId),
        eq(courseEnrollments.isActive, true)
      )
    );
  if (existing) throw new ConflictError("Student already enrolled in this course");

  const [item] = await db.insert(courseEnrollments).values(data).returning();

  // Auto-populate student_sections if not already assigned to this section
  const [existingSection] = await db
    .select()
    .from(studentSections)
    .where(
      and(
        eq(studentSections.studentId, data.studentId),
        eq(studentSections.sectionId, data.sectionId),
        eq(studentSections.isActive, true)
      )
    );

  if (!existingSection) {
    // Find the most recent active academic year
    const [currentAcademicYear] = await db
      .select()
      .from(academicYears)
      .where(eq(academicYears.isActive, true))
      .orderBy(desc(academicYears.startDate))
      .limit(1);

    if (currentAcademicYear) {
      const [newSectionAssignment] = await db
        .insert(studentSections)
        .values({
          studentId: data.studentId,
          sectionId: data.sectionId,
          academicYearId: currentAcademicYear.id,
        })
        .returning();

      await logAudit({
        userId: createdBy,
        action: "ASSIGN_STUDENT_SECTION",
        resource: "STUDENT_SECTION",
        resourceId: newSectionAssignment.id,
      });
    }
  }

  await logAudit({ userId: createdBy, action: "ENROLL_STUDENT", resource: "COURSE_ENROLLMENT", resourceId: item.id });
  return item;
}

export async function unenrollStudent(id: string, updatedBy?: string) {
  const [existing] = await db.select().from(courseEnrollments).where(eq(courseEnrollments.id, id));
  if (!existing) throw new NotFoundError("Enrollment");

  await db.update(courseEnrollments).set({ isActive: false }).where(eq(courseEnrollments.id, id));

  // Keep section membership consistent: if this was the student's last active
  // enrollment in the section, remove them from the section roster too
  const [otherInSection] = await db
    .select({ id: courseEnrollments.id })
    .from(courseEnrollments)
    .where(and(
      eq(courseEnrollments.studentId, existing.studentId),
      eq(courseEnrollments.sectionId, existing.sectionId),
      eq(courseEnrollments.isActive, true),
      ne(courseEnrollments.id, id),
    ));
  if (!otherInSection) {
    await db.update(studentSections).set({ isActive: false }).where(and(
      eq(studentSections.studentId, existing.studentId),
      eq(studentSections.sectionId, existing.sectionId),
      eq(studentSections.isActive, true),
    ));
  }

  await logAudit({ userId: updatedBy, action: "UNENROLL_STUDENT", resource: "COURSE_ENROLLMENT", resourceId: id });
}

export async function updateEnrollmentSection(id: string, newSectionId: string, updatedBy?: string) {
  const [existing] = await db.select().from(courseEnrollments).where(eq(courseEnrollments.id, id));
  if (!existing) throw new NotFoundError("Enrollment");
  if (!existing.isActive) throw new ConflictError("Cannot modify an inactive enrollment");

  const [targetSection] = await db.select().from(sections).where(eq(sections.id, newSectionId));
  if (!targetSection) throw new NotFoundError("Section");
  if (existing.sectionId === newSectionId) return existing;

  const [updated] = await db.update(courseEnrollments).set({ sectionId: newSectionId }).where(eq(courseEnrollments.id, id)).returning();

  // Keep student_sections consistent: if this was the student's only active
  // enrollment in the old section, deactivate the old section assignment
  const [otherInOldSection] = await db
    .select({ id: courseEnrollments.id })
    .from(courseEnrollments)
    .where(and(
      eq(courseEnrollments.studentId, existing.studentId),
      eq(courseEnrollments.sectionId, existing.sectionId),
      eq(courseEnrollments.isActive, true),
      ne(courseEnrollments.id, id),
    ));
  if (!otherInOldSection) {
    await db.update(studentSections)
      .set({ isActive: false })
      .where(and(
        eq(studentSections.studentId, existing.studentId),
        eq(studentSections.sectionId, existing.sectionId),
        eq(studentSections.isActive, true),
      ));
  }

  // Ensure an active section assignment exists in the new section
  const [sectionInNew] = await db
    .select({ id: studentSections.id })
    .from(studentSections)
    .where(and(
      eq(studentSections.studentId, existing.studentId),
      eq(studentSections.sectionId, newSectionId),
      eq(studentSections.isActive, true),
    ));
  if (!sectionInNew) {
    const [currentAcademicYear] = await db
      .select()
      .from(academicYears)
      .where(eq(academicYears.isActive, true))
      .orderBy(desc(academicYears.startDate))
      .limit(1);
    if (currentAcademicYear) {
      await db.insert(studentSections).values({
        studentId: existing.studentId,
        sectionId: newSectionId,
        academicYearId: currentAcademicYear.id,
      });
    }
  }

  await logAudit({ userId: updatedBy, action: "UPDATE_ENROLLMENT", resource: "COURSE_ENROLLMENT", resourceId: id, metadata: { sectionId: newSectionId } });
  return updated;
}

// ─── Learning Outcomes ───────────────────────────────────────────────────────

export async function listLearningOutcomes(courseId: string) {
  return db.select().from(learningOutcomes).where(eq(learningOutcomes.courseId, courseId)).orderBy(learningOutcomes.code);
}

export async function createLearningOutcome(data: { courseId: string; code: string; description: string }, createdBy?: string) {
  const [item] = await db.insert(learningOutcomes).values(data).returning();
  await logAudit({ userId: createdBy, action: "CREATE_LEARNING_OUTCOME", resource: "LEARNING_OUTCOME", resourceId: item.id });
  return item;
}

export async function updateLearningOutcome(id: string, data: Record<string, unknown>, updatedBy?: string) {
  const [existing] = await db.select().from(learningOutcomes).where(eq(learningOutcomes.id, id));
  if (!existing) throw new NotFoundError("Learning Outcome");

  const [item] = await db.update(learningOutcomes).set(data).where(eq(learningOutcomes.id, id)).returning();
  await logAudit({ userId: updatedBy, action: "UPDATE_LEARNING_OUTCOME", resource: "LEARNING_OUTCOME", resourceId: id });
  return item;
}

export async function deleteLearningOutcome(id: string, deletedBy?: string) {
  const [existing] = await db.select().from(learningOutcomes).where(eq(learningOutcomes.id, id));
  if (!existing) throw new NotFoundError("Learning Outcome");

  await db.delete(learningOutcomes).where(eq(learningOutcomes.id, id));
  await logAudit({ userId: deletedBy, action: "DELETE_LEARNING_OUTCOME", resource: "LEARNING_OUTCOME", resourceId: id });
}

// ─── Student Sections ────────────────────────────────────────────────────────

export async function listStudentSections(query: { page: number; limit: number; sectionId?: string; studentId?: string; academicYearId?: string }) {
  const { page, limit, sectionId, studentId, academicYearId } = query;
  const offset = (page - 1) * limit;
  const conditions: ReturnType<typeof sql>[] = [eq(studentSections.isActive, true)];

  if (sectionId) conditions.push(eq(studentSections.sectionId, sectionId));
  if (studentId) conditions.push(eq(studentSections.studentId, studentId));
  if (academicYearId) conditions.push(eq(studentSections.academicYearId, academicYearId));

  const where = and(...conditions);
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(studentSections).where(where);

  const items = await db
    .select({
      id: studentSections.id,
      studentId: studentSections.studentId,
      sectionId: studentSections.sectionId,
      academicYearId: studentSections.academicYearId,
      enrolledAt: studentSections.enrolledAt,
      isActive: studentSections.isActive,
      studentFirstName: users.firstName,
      studentLastName: users.lastName,
      studentEmail: users.email,
      sectionName: sections.name,
      academicYearName: academicYears.name,
    })
    .from(studentSections)
    .innerJoin(users, eq(studentSections.studentId, users.id))
    .innerJoin(sections, eq(studentSections.sectionId, sections.id))
    .innerJoin(academicYears, eq(studentSections.academicYearId, academicYears.id))
    .where(where)
    .orderBy(desc(studentSections.enrolledAt))
    .limit(limit)
    .offset(offset);

  return { items, pagination: { page, limit, total: countResult.count, totalPages: Math.ceil(countResult.count / limit) } };
}

export async function getStudentsBySection(sectionId: string) {
  return db
    .select({
      id: studentSections.id,
      studentId: studentSections.studentId,
      enrolledAt: studentSections.enrolledAt,
      studentFirstName: users.firstName,
      studentLastName: users.lastName,
      studentEmail: users.email,
    })
    .from(studentSections)
    .innerJoin(users, eq(studentSections.studentId, users.id))
    .where(and(eq(studentSections.sectionId, sectionId), eq(studentSections.isActive, true)))
    .orderBy(users.lastName);
}

export async function assignStudentSection(data: { studentId: string; sectionId: string; academicYearId: string }, createdBy?: string) {
  const [existing] = await db
    .select()
    .from(studentSections)
    .where(
      and(
        eq(studentSections.studentId, data.studentId),
        eq(studentSections.sectionId, data.sectionId),
        eq(studentSections.academicYearId, data.academicYearId),
        eq(studentSections.isActive, true)
      )
    );
  if (existing) throw new ConflictError("Student already assigned to this section for this academic year");

  const [item] = await db.insert(studentSections).values(data).returning();
  await logAudit({ userId: createdBy, action: "ASSIGN_STUDENT_SECTION", resource: "STUDENT_SECTION", resourceId: item.id });
  return item;
}

export async function removeStudentSection(id: string, updatedBy?: string) {
  const [existing] = await db.select().from(studentSections).where(eq(studentSections.id, id));
  if (!existing) throw new NotFoundError("Student section assignment");

  await db.update(studentSections).set({ isActive: false }).where(eq(studentSections.id, id));

  // Full removal: also deactivate the student's enrollments in courses of this
  // section so they don't keep course access through a stale roster entry
  const removedEnrollments = await db
    .update(courseEnrollments)
    .set({ isActive: false })
    .where(and(
      eq(courseEnrollments.studentId, existing.studentId),
      eq(courseEnrollments.sectionId, existing.sectionId),
      eq(courseEnrollments.isActive, true),
    ))
    .returning({ id: courseEnrollments.id });

  await logAudit({ userId: updatedBy, action: "REMOVE_STUDENT_SECTION", resource: "STUDENT_SECTION", resourceId: id, metadata: { enrollmentsRemoved: removedEnrollments.length } });
}
