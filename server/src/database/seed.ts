import { eq, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import { db, closePool } from "./index.js";
import {
  users,
  permissions,
  rolePermissions,
  programs,
  academicYears,
  semesters,
  yearLevels,
  sections,
  courses,
  topics,
  lessons,
  learningMaterials,
  learningActivities,
  questions,
  questionOptions,
  assessments,
  assessmentQuestions,
  clinicalCases,
  caseStages,
  caseOptions,
  nursingDiagnoses,
  skills,
  skillChecklists,
  skillStations,
  clinicalRotations,
  competencyFrameworks,
  competencies,
  competencyIndicators,
  prerequisiteRules,
  portfolios,
  portfolioItems,
  reflections,
  clinicalExperienceLogs,
  achievements,
  portfolioFeedback,
  nleCategories,
  nleQuestionBank,
  nleQuestionOptions,
  nleExams,
  virtualPatients,
  patientScenarios,
  patientStateTransitions,
  nursingActions,
  patientResponses,
  aiHints,
  aiSocraticQuestions,
  aiGeneratedQuestions,
  aiGeneratedCases,
  aiGeneratedStudyGuides,
  researchProjects,
  researchCohorts,
  researchStudies,
} from "./schema/index.js";
import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("seed");

const ALL_PERMISSIONS = [
  "student:view-own-profile",
  "student:view-own-results",
  "student:take-assessment",
  "student:view-competency",
  "student:submit-reflection",
  "student:view-clinical-hours",
  "instructor:create-assessment",
  "instructor:grade-assessment",
  "instructor:evaluate-skill",
  "instructor:view-student-analytics",
  "instructor:create-lesson",
  "instructor:create-case",
  "instructor:view-class-analytics",
  "clinical:evaluate-student",
  "clinical:log-attendance",
  "clinical:view-clinical-data",
  "coordinator:manage-courses",
  "coordinator:view-program-analytics",
  "coordinator:manage-enrollments",
  "admin:manage-users",
  "admin:manage-roles",
  "admin:manage-system",
  "admin:view-audit-logs",
  "admin:manage-permissions",
  "admin:manage-programs",
  "admin:backup-database",
];

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  STUDENT: [
    "student:view-own-profile",
    "student:view-own-results",
    "student:take-assessment",
    "student:view-competency",
    "student:submit-reflection",
    "student:view-clinical-hours",
  ],
  INSTRUCTOR: [
    "instructor:create-assessment",
    "instructor:grade-assessment",
    "instructor:evaluate-skill",
    "instructor:view-student-analytics",
    "instructor:create-lesson",
    "instructor:create-case",
    "instructor:view-class-analytics",
    "student:view-own-profile",
    "student:view-own-results",
  ],
  CLINICAL_INSTRUCTOR: [
    "clinical:evaluate-student",
    "clinical:log-attendance",
    "clinical:view-clinical-data",
    "instructor:view-student-analytics",
    "student:view-own-profile",
  ],
  PROGRAM_COORDINATOR: [
    "coordinator:manage-courses",
    "coordinator:view-program-analytics",
    "coordinator:manage-enrollments",
    "instructor:create-assessment",
    "instructor:grade-assessment",
    "instructor:view-student-analytics",
    "instructor:create-lesson",
    "instructor:view-class-analytics",
    "student:view-own-profile",
  ],
  ADMIN: [...ALL_PERMISSIONS],
};

const SEED_USERS = [
  { username: "admin", email: "admin@nurselearn.local", password: "admin123", firstName: "Admin", lastName: "User", role: "ADMIN" as const },
  { username: "coordinator", email: "coordinator@nurselearn.local", password: "coordinator123", firstName: "Ana", lastName: "Reyes", role: "PROGRAM_COORDINATOR" as const },
  { username: "instructor", email: "instructor@nurselearn.local", password: "instructor123", firstName: "Maria", lastName: "Santos", role: "INSTRUCTOR" as const },
  // Research-module showcase account (owns the 30 demo projects below)
  { username: "instructor1", email: "instructor1@nurselearn.local", password: "instructor123", firstName: "Lucia", lastName: "Cruz", role: "INSTRUCTOR" as const },
  { username: "clinical", email: "clinical@nurselearn.local", password: "clinical123", firstName: "Jose", lastName: "Garcia", role: "CLINICAL_INSTRUCTOR" as const },
  { username: "student", email: "student@nurselearn.local", password: "newpass123", firstName: "Juan", lastName: "Dela Cruz", role: "STUDENT" as const },
  { username: "student2", email: "student2@nurselearn.local", password: "student123", firstName: "Maria", lastName: "Clara", role: "STUDENT" as const },
];

// 30 demo research projects (10 topics × 3 methodologies) owned by instructor1.
const DEMO_RESEARCH_PROJECTS: Array<{
  title: string;
  researchType: string;
  status: string;
  startDate: string;
  fundingSource: string;
}> = [
  { title: "Student Engagement in the BSN Curriculum: A Longitudinal Assessment", researchType: "QUASI_EXPERIMENTAL", status: "PLANNING", startDate: "2025-01-01", fundingSource: "University Research Grant" },
  { title: "Clinical Competency Assessment: A Longitudinal Assessment", researchType: "EXPERIMENTAL", status: "ACTIVE", startDate: "2025-01-22", fundingSource: "DOST-SEI Grant" },
  { title: "Medication Safety Practices: A Longitudinal Assessment", researchType: "CORRELATIONAL", status: "COMPLETED", startDate: "2025-02-12", fundingSource: "CHED Research Fund" },
  { title: "Hand Hygiene Compliance: A Longitudinal Assessment", researchType: "QUALITATIVE", status: "CLOSED", startDate: "2025-03-05", fundingSource: "University Research Grant" },
  { title: "Pain Management Approaches: A Longitudinal Assessment", researchType: "MIXED_METHODS", status: "PLANNING", startDate: "2025-03-26", fundingSource: "DOST-SEI Grant" },
  { title: "Nursing Informatics Adoption: A Longitudinal Assessment", researchType: "QUASI_EXPERIMENTAL", status: "ACTIVE", startDate: "2025-04-16", fundingSource: "CHED Research Fund" },
  { title: "Patient Education Effectiveness: A Longitudinal Assessment", researchType: "EXPERIMENTAL", status: "COMPLETED", startDate: "2025-05-07", fundingSource: "University Research Grant" },
  { title: "Shift Work and Fatigue: A Longitudinal Assessment", researchType: "CORRELATIONAL", status: "CLOSED", startDate: "2025-05-28", fundingSource: "DOST-SEI Grant" },
  { title: "Mental Health Screening: A Longitudinal Assessment", researchType: "QUALITATIVE", status: "PLANNING", startDate: "2025-06-18", fundingSource: "CHED Research Fund" },
  { title: "Falls Prevention Strategies: A Longitudinal Assessment", researchType: "MIXED_METHODS", status: "ACTIVE", startDate: "2025-07-09", fundingSource: "University Research Grant" },
  { title: "Student Engagement in the BSN Curriculum: A Cross-Sectional Survey", researchType: "QUASI_EXPERIMENTAL", status: "COMPLETED", startDate: "2025-07-30", fundingSource: "DOST-SEI Grant" },
  { title: "Clinical Competency Assessment: A Cross-Sectional Survey", researchType: "EXPERIMENTAL", status: "CLOSED", startDate: "2025-08-20", fundingSource: "CHED Research Fund" },
  { title: "Medication Safety Practices: A Cross-Sectional Survey", researchType: "CORRELATIONAL", status: "PLANNING", startDate: "2025-09-10", fundingSource: "University Research Grant" },
  { title: "Hand Hygiene Compliance: A Cross-Sectional Survey", researchType: "QUALITATIVE", status: "ACTIVE", startDate: "2025-10-01", fundingSource: "DOST-SEI Grant" },
  { title: "Pain Management Approaches: A Cross-Sectional Survey", researchType: "MIXED_METHODS", status: "COMPLETED", startDate: "2025-10-22", fundingSource: "CHED Research Fund" },
  { title: "Nursing Informatics Adoption: A Cross-Sectional Survey", researchType: "QUASI_EXPERIMENTAL", status: "CLOSED", startDate: "2025-11-12", fundingSource: "University Research Grant" },
  { title: "Patient Education Effectiveness: A Cross-Sectional Survey", researchType: "EXPERIMENTAL", status: "PLANNING", startDate: "2025-12-03", fundingSource: "DOST-SEI Grant" },
  { title: "Shift Work and Fatigue: A Cross-Sectional Survey", researchType: "CORRELATIONAL", status: "ACTIVE", startDate: "2025-12-24", fundingSource: "CHED Research Fund" },
  { title: "Mental Health Screening: A Cross-Sectional Survey", researchType: "QUALITATIVE", status: "COMPLETED", startDate: "2026-01-14", fundingSource: "University Research Grant" },
  { title: "Falls Prevention Strategies: A Cross-Sectional Survey", researchType: "MIXED_METHODS", status: "CLOSED", startDate: "2026-02-04", fundingSource: "DOST-SEI Grant" },
  { title: "Student Engagement in the BSN Curriculum: A Mixed-Methods Exploration", researchType: "QUASI_EXPERIMENTAL", status: "PLANNING", startDate: "2026-02-25", fundingSource: "CHED Research Fund" },
  { title: "Clinical Competency Assessment: A Mixed-Methods Exploration", researchType: "EXPERIMENTAL", status: "ACTIVE", startDate: "2026-03-18", fundingSource: "University Research Grant" },
  { title: "Medication Safety Practices: A Mixed-Methods Exploration", researchType: "CORRELATIONAL", status: "COMPLETED", startDate: "2026-04-08", fundingSource: "DOST-SEI Grant" },
  { title: "Hand Hygiene Compliance: A Mixed-Methods Exploration", researchType: "QUALITATIVE", status: "CLOSED", startDate: "2026-04-29", fundingSource: "CHED Research Fund" },
  { title: "Pain Management Approaches: A Mixed-Methods Exploration", researchType: "MIXED_METHODS", status: "PLANNING", startDate: "2026-05-20", fundingSource: "University Research Grant" },
  { title: "Nursing Informatics Adoption: A Mixed-Methods Exploration", researchType: "QUASI_EXPERIMENTAL", status: "ACTIVE", startDate: "2026-06-10", fundingSource: "DOST-SEI Grant" },
  { title: "Patient Education Effectiveness: A Mixed-Methods Exploration", researchType: "EXPERIMENTAL", status: "COMPLETED", startDate: "2026-07-01", fundingSource: "CHED Research Fund" },
  { title: "Shift Work and Fatigue: A Mixed-Methods Exploration", researchType: "CORRELATIONAL", status: "CLOSED", startDate: "2026-07-22", fundingSource: "University Research Grant" },
  { title: "Mental Health Screening: A Mixed-Methods Exploration", researchType: "QUALITATIVE", status: "PLANNING", startDate: "2026-08-12", fundingSource: "DOST-SEI Grant" },
  { title: "Falls Prevention Strategies: A Mixed-Methods Exploration", researchType: "MIXED_METHODS", status: "ACTIVE", startDate: "2026-09-02", fundingSource: "CHED Research Fund" },
];

const BSN_PROGRAM = {
  name: "Bachelor of Science in Nursing",
  code: "BSN",
  description: "4-year nursing program producing competent, socially responsible nurses.",
};

const BSN_YEAR_LEVELS = [
  { name: "1st Year", order: 1 },
  { name: "2nd Year", order: 2 },
  { name: "3rd Year", order: 3 },
  { name: "4th Year", order: 4 },
];

const BSN_COURSES: Array<{
  name: string;
  code: string;
  yearLevel: number;
  semester: number;
  credits: number;
}> = [
  { name: "Fundamentals of Nursing", code: "NUR101", yearLevel: 1, semester: 1, credits: 3 },
  { name: "Anatomy and Physiology", code: "BIO101", yearLevel: 1, semester: 1, credits: 4 },
  { name: "Health Assessment", code: "NUR102", yearLevel: 1, semester: 2, credits: 3 },
  { name: "Microbiology", code: "BIO102", yearLevel: 1, semester: 2, credits: 3 },
  { name: "Medical-Surgical Nursing I", code: "NUR201", yearLevel: 2, semester: 1, credits: 5 },
  { name: "Pharmacology", code: "NUR202", yearLevel: 2, semester: 1, credits: 3 },
  { name: "Maternal and Child Nursing", code: "NUR203", yearLevel: 2, semester: 2, credits: 5 },
  { name: "Community Health Nursing", code: "NUR301", yearLevel: 3, semester: 1, credits: 4 },
  { name: "Medical-Surgical Nursing II", code: "NUR302", yearLevel: 3, semester: 1, credits: 5 },
  { name: "Mental Health Nursing", code: "NUR303", yearLevel: 3, semester: 2, credits: 4 },
  { name: "Nursing Leadership and Management", code: "NUR401", yearLevel: 4, semester: 1, credits: 3 },
  { name: "Clinical Internship", code: "NUR402", yearLevel: 4, semester: 2, credits: 12 },
];

async function seed() {
  logger.info("Starting Phase 9 seed...");

  try {
    // Seed permissions
    logger.info("Seeding permissions...");
    for (const permName of ALL_PERMISSIONS) {
      const [existing] = await db.select().from(permissions).where(eq(permissions.name, permName));
      if (!existing) {
        await db.insert(permissions).values({ name: permName, description: `Permission: ${permName}` });
      }
    }
    logger.info(`Seeded ${ALL_PERMISSIONS.length} permissions`);

    // Seed role-permission mappings
    logger.info("Seeding role-permission mappings...");
    for (const [role, permNames] of Object.entries(ROLE_PERMISSION_MAP)) {
      for (const permName of permNames) {
        const [perm] = await db.select().from(permissions).where(eq(permissions.name, permName));
        if (perm) {
          const [existingMapping] = await db.select().from(rolePermissions).where(eq(rolePermissions.role, role as "ADMIN" | "PROGRAM_COORDINATOR" | "INSTRUCTOR" | "CLINICAL_INSTRUCTOR" | "STUDENT"));
          if (!existingMapping) {
            await db.insert(rolePermissions).values({ role: role as "ADMIN" | "PROGRAM_COORDINATOR" | "INSTRUCTOR" | "CLINICAL_INSTRUCTOR" | "STUDENT", permissionId: perm.id });
          }
        }
      }
    }
    logger.info("Role-permission mappings seeded");

    // Seed users
    logger.info("Seeding users...");
    for (const userData of SEED_USERS) {
      const [existing] = await db.select().from(users).where(eq(users.username, userData.username));
      if (!existing) {
        const passwordHash = await bcrypt.hash(userData.password, 12);
        await db.insert(users).values({ username: userData.username, email: userData.email, passwordHash, firstName: userData.firstName, lastName: userData.lastName, role: userData.role, isActive: true, emailVerifiedAt: new Date() });
        logger.info(`Created user: ${userData.username} (${userData.role})`);
      }
    }

    // Seed BSN Program
    logger.info("Seeding BSN program...");
    let bsnProgram = (await db.select().from(programs).where(eq(programs.code, "BSN")))[0];
    if (!bsnProgram) {
      [bsnProgram] = await db.insert(programs).values(BSN_PROGRAM).returning();
      logger.info("BSN program created");
    }

    // Seed Academic Year
    let currentAY = (await db.select().from(academicYears).where(eq(academicYears.programId, bsnProgram.id)))[0];
    if (!currentAY) {
      [currentAY] = await db.insert(academicYears).values({
        name: "2025-2026",
        programId: bsnProgram.id,
        startDate: new Date("2025-06-01"),
        endDate: new Date("2026-04-30"),
        isActive: true,
      }).returning();
      logger.info("Academic year 2025-2026 created");
    }

    // Seed Semesters
    const semesterData = [
      { name: "1st Semester", startDate: "2025-06-01", endDate: "2025-10-31" },
      { name: "2nd Semester", startDate: "2025-11-01", endDate: "2026-04-30" },
    ];
    const semesterIds: string[] = [];
    for (const sem of semesterData) {
      let [existing] = await db.select().from(semesters).where(
        and(eq(semesters.academicYearId, currentAY.id), eq(semesters.name, sem.name))
      );
      if (!existing) {
        [existing] = await db.insert(semesters).values({
          name: sem.name,
          academicYearId: currentAY.id,
          startDate: new Date(sem.startDate),
          endDate: new Date(sem.endDate),
          isActive: true,
        }).returning();
      }
      semesterIds.push(existing.id);
    }
    logger.info("Semesters seeded");

    // Seed Year Levels
    const yearLevelIds: string[] = [];
    for (const yl of BSN_YEAR_LEVELS) {
      let [existing] = await db.select().from(yearLevels).where(
        and(eq(yearLevels.programId, bsnProgram.id), eq(yearLevels.name, yl.name))
      );
      if (!existing) {
        [existing] = await db.insert(yearLevels).values({ name: yl.name, programId: bsnProgram.id, order: yl.order }).returning();
      }
      yearLevelIds.push(existing.id);
    }
    logger.info("Year levels seeded");

    // Seed Sections
    for (let i = 0; i < yearLevelIds.length; i++) {
      for (const semIdx of [0, 1]) {
        const sectionName = `BSN ${BSN_YEAR_LEVELS[i].name} - ${semesterData[semIdx].name.charAt(0)}`;
        const existing = (await db.select().from(sections).where(
          and(eq(sections.yearLevelId, yearLevelIds[i]), eq(sections.semesterId, semesterIds[semIdx]))
        ))[0];
        if (!existing) {
          await db.insert(sections).values({
            name: sectionName,
            yearLevelId: yearLevelIds[i],
            semesterId: semesterIds[semIdx],
          });
        }
      }
    }
    logger.info("Sections seeded");

    // Seed Courses
    // Courses intentionally start with NO assigned instructor and NO student
    // enrollments — coordinators assign both after install, and the app's
    // Unenroll flow manages enrollment state from there. Students likewise
    // start out of every section; staff assign them after install.
    logger.info("Seeding courses...");
    const instructorUser = (await db.select().from(users).where(eq(users.username, "instructor")))[0];
    const courseIds: string[] = [];
    for (const course of BSN_COURSES) {
      let [existing] = await db.select().from(courses).where(eq(courses.code, course.code));
      if (!existing) {
        [existing] = await db.insert(courses).values({
          name: course.name,
          code: course.code,
          programId: bsnProgram.id,
          yearLevelId: yearLevelIds[course.yearLevel - 1],
          semesterId: semesterIds[course.semester - 1],
          credits: course.credits,
          isActive: true,
        }).returning();
        logger.info(`Created course: ${course.code} - ${course.name}`);
      }
      courseIds.push(existing.id);
    }

    // Seed Learning Content for Fundamentals of Nursing (NUR101)
    logger.info("Seeding learning content...");
    const nur101 = courseIds[0] ? (await db.select().from(courses).where(eq(courses.id, courseIds[0])))[0] : null;
    if (nur101) {
      // Topics
      let [topic1] = await db.select().from(topics).where(eq(topics.name, "Introduction to Nursing"));
      if (!topic1) {
        [topic1] = await db.insert(topics).values({
          courseId: nur101.id,
          name: "Introduction to Nursing",
          description: "History, philosophy, and principles of nursing practice",
          order: 1,
        }).returning();
      }

      let [topic2] = await db.select().from(topics).where(eq(topics.name, "Patient Assessment"));
      if (!topic2) {
        [topic2] = await db.insert(topics).values({
          courseId: nur101.id,
          name: "Patient Assessment",
          description: "Comprehensive health assessment techniques",
          order: 2,
        }).returning();
      }

      // Lessons for Topic 1
      let [lesson1] = await db.select().from(lessons).where(eq(lessons.title, "History of Nursing"));
      if (!lesson1) {
        [lesson1] = await db.insert(lessons).values({
          topicId: topic1.id,
          title: "History of Nursing",
          content: "Nursing has evolved from ancient times through Florence Nightingale to modern practice. This lesson covers key milestones in nursing history and how they shaped current practice.",
          order: 1,
        }).returning();

        await db.insert(learningMaterials).values({
          lessonId: lesson1.id,
          title: "Florence Nightingale: Founder of Modern Nursing",
          type: "TEXT",
          content: "Florence Nightingale (1820-1910) revolutionized nursing during the Crimean War. Her emphasis on sanitation, hygiene, and patient care transformed nursing into a respected profession.",
          order: 1,
          isRequired: true,
        });

        await db.insert(learningActivities).values({
          lessonId: lesson1.id,
          title: "Reflection: Nursing Philosophy",
          type: "REFLECTION",
          description: "Write a 200-word reflection on what nursing means to you and how the history of nursing inspires your practice.",
          instructions: "Consider the following:\n1. What drew you to nursing?\n2. How do historical nursing principles apply today?\n3. What values do you want to embody as a nurse?",
          points: 10,
          order: 1,
          isRequired: true,
        });
      }

      let [lesson2] = await db.select().from(lessons).where(eq(lessons.title, "Nursing Ethics and Values"));
      if (!lesson2) {
        [lesson2] = await db.insert(lessons).values({
          topicId: topic1.id,
          title: "Nursing Ethics and Values",
          content: "Core ethical principles in nursing: autonomy, beneficence, non-maleficence, justice, fidelity, and veracity.",
          order: 2,
        }).returning();

        await db.insert(learningMaterials).values({
          lessonId: lesson2.id,
          title: "Code of Ethics for Nurses",
          type: "DOCUMENT",
          content: "The Philippine Code of Ethics for Nurses (Board Resolution No. 220, Series of 2004) outlines the ethical standards and professional conduct expected of all Filipino nurses.",
          order: 1,
          isRequired: true,
        });

        await db.insert(learningActivities).values({
          lessonId: lesson2.id,
          title: "Case Study: Ethical Dilemma",
          type: "CASE_STUDY",
          description: "A 75-year-old patient with terminal cancer refuses further treatment. The family insists on continuing aggressive therapy.",
          instructions: "Analyze the ethical dilemma using the four principles of biomedical ethics. What should the nurse's role be in this situation?",
          config: { difficulty: "intermediate", estimatedTime: "30 minutes" },
          points: 15,
          order: 1,
          isRequired: true,
        });
      }

      // Lessons for Topic 2
      let [lesson3] = await db.select().from(lessons).where(eq(lessons.title, "Vital Signs Assessment"));
      if (!lesson3) {
        [lesson3] = await db.insert(lessons).values({
          topicId: topic2.id,
          title: "Vital Signs Assessment",
          content: "Temperature, pulse, respiration, blood pressure, and pain assessment. Normal ranges and factors affecting vital signs.",
          order: 1,
        }).returning();

        await db.insert(learningMaterials).values({
          lessonId: lesson3.id,
          title: "Vital Signs Reference Guide",
          type: "TEXT",
          content: "Normal vital signs for adults:\n- Temperature: 36.1-37.2°C\n- Pulse: 60-100 bpm\n- Respiration: 12-20 breaths/min\n- Blood Pressure: <120/80 mmHg\n- Pain: 0-10 scale",
          order: 1,
          isRequired: true,
        });

        await db.insert(learningActivities).values({
          lessonId: lesson3.id,
          title: "Practice: Vital Signs Measurement",
          type: "PRACTICE",
          description: "Practice measuring vital signs on a simulated patient scenario.",
          instructions: "Record the following vital signs and determine if they are within normal range:\n- Temp: 37.8°C\n- Pulse: 88 bpm\n- Resp: 18 breaths/min\n- BP: 130/85 mmHg\n- Pain: 3/10",
          points: 20,
          order: 1,
          isRequired: true,
        });
      }
    }

    // Topics for Anatomy and Physiology (BIO101)
    const bio101 = courseIds[1] ? (await db.select().from(courses).where(eq(courses.id, courseIds[1])))[0] : null;
    if (bio101) {
      let [topic3] = await db.select().from(topics).where(eq(topics.name, "Body Systems Overview"));
      if (!topic3) {
        [topic3] = await db.insert(topics).values({
          courseId: bio101.id,
          name: "Body Systems Overview",
          description: "Introduction to major body systems and their functions",
          order: 1,
        }).returning();

        const [bioLesson1] = await db.insert(lessons).values({
          topicId: topic3.id,
          title: "Cardiovascular System",
          content: "The cardiovascular system includes the heart, blood vessels, and blood. It is responsible for transporting oxygen, nutrients, and waste products throughout the body.",
          order: 1,
        }).returning();

        await db.insert(learningMaterials).values({
          lessonId: bioLesson1.id,
          title: "Cardiovascular System Diagram",
          type: "IMAGE",
          url: "/images/cardiovascular-system.png",
          order: 1,
          isRequired: true,
        });

        await db.insert(learningActivities).values({
          lessonId: bioLesson1.id,
          title: "Quiz: Cardiovascular Basics",
          type: "QUIZ",
          description: "Test your knowledge of the cardiovascular system.",
          config: {
            questions: [
              { q: "What is the main function of the heart?", options: ["Pump blood", "Filter blood", "Produce blood cells"], answer: 0 },
              { q: "Which type of blood vessel carries blood away from the heart?", options: ["Veins", "Capillaries", "Arteries"], answer: 2 },
            ],
          },
          points: 10,
          order: 1,
          isRequired: true,
        });
      }
    }

    logger.info("Phase 3 learning content seeded");

    // Seed Question Bank for Fundamentals of Nursing
    logger.info("Seeding question bank...");
    if (nur101) {
      // Question 1: MC - History
      let [q1] = await db.select().from(questions).where(eq(questions.stem, "Who is considered the founder of modern nursing?"));
      if (!q1) {
        [q1] = await db.insert(questions).values({
          courseId: nur101.id,
          type: "MC",
          difficulty: "EASY",
          stem: "Who is considered the founder of modern nursing?",
          explanation: "Florence Nightingale is widely regarded as the founder of modern nursing due to her work during the Crimean War.",
          points: 1,
          createdBy: instructorUser?.id,
        }).returning();

        await db.insert(questionOptions).values([
          { questionId: q1.id, text: "Florence Nightingale", isCorrect: true, order: 0 },
          { questionId: q1.id, text: "Clara Barton", isCorrect: false, order: 1 },
          { questionId: q1.id, text: "Mary Seacole", isCorrect: false, order: 2 },
          { questionId: q1.id, text: "Dorothea Orem", isCorrect: false, order: 3 },
        ]);
      }

      // Question 2: MC - Ethics
      let [q2] = await db.select().from(questions).where(eq(questions.stem, "Which ethical principle refers to 'doing good' for the patient?"));
      if (!q2) {
        [q2] = await db.insert(questions).values({
          courseId: nur101.id,
          type: "MC",
          difficulty: "MEDIUM",
          stem: "Which ethical principle refers to 'doing good' for the patient?",
          explanation: "Beneficence is the ethical principle of acting in the best interest of the patient.",
          points: 1,
          createdBy: instructorUser?.id,
        }).returning();

        await db.insert(questionOptions).values([
          { questionId: q2.id, text: "Autonomy", isCorrect: false, order: 0 },
          { questionId: q2.id, text: "Beneficence", isCorrect: true, order: 1 },
          { questionId: q2.id, text: "Non-maleficence", isCorrect: false, order: 2 },
          { questionId: q2.id, text: "Justice", isCorrect: false, order: 3 },
        ]);
      }

      // Question 3: TF - Vital Signs
      let [q3] = await db.select().from(questions).where(eq(questions.stem, "Normal adult body temperature ranges from 36.1°C to 37.2°C."));
      if (!q3) {
        [q3] = await db.insert(questions).values({
          courseId: nur101.id,
          type: "TF",
          difficulty: "EASY",
          stem: "Normal adult body temperature ranges from 36.1°C to 37.2°C.",
          explanation: "This is the accepted normal range for oral body temperature in adults.",
          points: 1,
          createdBy: instructorUser?.id,
        }).returning();

        await db.insert(questionOptions).values([
          { questionId: q3.id, text: "True", isCorrect: true, order: 0 },
          { questionId: q3.id, text: "False", isCorrect: false, order: 1 },
        ]);
      }

      // Question 4: MC - Vital Signs
      let [q4] = await db.select().from(questions).where(eq(questions.stem, "What is the normal range for adult resting heart rate?"));
      if (!q4) {
        [q4] = await db.insert(questions).values({
          courseId: nur101.id,
          type: "MC",
          difficulty: "EASY",
          stem: "What is the normal range for adult resting heart rate?",
          explanation: "Normal resting heart rate for adults is 60-100 beats per minute.",
          points: 1,
          createdBy: instructorUser?.id,
        }).returning();

        await db.insert(questionOptions).values([
          { questionId: q4.id, text: "40-60 bpm", isCorrect: false, order: 0 },
          { questionId: q4.id, text: "60-100 bpm", isCorrect: true, order: 1 },
          { questionId: q4.id, text: "100-120 bpm", isCorrect: false, order: 2 },
          { questionId: q4.id, text: "120-140 bpm", isCorrect: false, order: 3 },
        ]);
      }

      // Create Quiz for NUR101
      let [quiz1] = await db.select().from(assessments).where(eq(assessments.title, "Fundamentals of Nursing - Midterm Quiz"));
      if (!quiz1) {
        [quiz1] = await db.insert(assessments).values({
          courseId: nur101.id,
          title: "Fundamentals of Nursing - Midterm Quiz",
          description: "Test your knowledge of nursing history, ethics, and vital signs assessment.",
          type: "QUIZ",
          timeLimitMinutes: 30,
          passingScore: 75,
          maxAttempts: 3,
          isPublished: true,
          createdBy: instructorUser?.id,
        }).returning();

        await db.insert(assessmentQuestions).values([
          { assessmentId: quiz1.id, questionId: q1.id, order: 0, points: 1 },
          { assessmentId: quiz1.id, questionId: q2.id, order: 1, points: 1 },
          { assessmentId: quiz1.id, questionId: q3.id, order: 2, points: 1 },
          { assessmentId: quiz1.id, questionId: q4.id, order: 3, points: 1 },
        ]);
      }
    }

    // Questions for Anatomy and Physiology
    if (bio101) {
      let [q5] = await db.select().from(questions).where(eq(questions.stem, "Which chamber of the heart pumps blood to the lungs?"));
      if (!q5) {
        [q5] = await db.insert(questions).values({
          courseId: bio101.id,
          type: "MC",
          difficulty: "MEDIUM",
          stem: "Which chamber of the heart pumps blood to the lungs?",
          explanation: "The right ventricle pumps deoxygenated blood to the lungs via the pulmonary artery.",
          points: 1,
          createdBy: instructorUser?.id,
        }).returning();

        await db.insert(questionOptions).values([
          { questionId: q5.id, text: "Left atrium", isCorrect: false, order: 0 },
          { questionId: q5.id, text: "Right atrium", isCorrect: false, order: 1 },
          { questionId: q5.id, text: "Left ventricle", isCorrect: false, order: 2 },
          { questionId: q5.id, text: "Right ventricle", isCorrect: true, order: 3 },
        ]);
      }

      let [q6] = await db.select().from(questions).where(eq(questions.stem, "What is the largest artery in the human body?"));
      if (!q6) {
        [q6] = await db.insert(questions).values({
          courseId: bio101.id,
          type: "MC",
          difficulty: "EASY",
          stem: "What is the largest artery in the human body?",
          explanation: "The aorta is the largest artery, carrying oxygenated blood from the left ventricle to the body.",
          points: 1,
          createdBy: instructorUser?.id,
        }).returning();

        await db.insert(questionOptions).values([
          { questionId: q6.id, text: "Pulmonary artery", isCorrect: false, order: 0 },
          { questionId: q6.id, text: "Carotid artery", isCorrect: false, order: 1 },
          { questionId: q6.id, text: "Aorta", isCorrect: true, order: 2 },
          { questionId: q6.id, text: "Femoral artery", isCorrect: false, order: 3 },
        ]);
      }

      let [quiz2] = await db.select().from(assessments).where(eq(assessments.title, "Anatomy - Cardiovascular System Quiz"));
      if (!quiz2) {
        [quiz2] = await db.insert(assessments).values({
          courseId: bio101.id,
          title: "Anatomy - Cardiovascular System Quiz",
          description: "Test your understanding of the cardiovascular system.",
          type: "QUIZ",
          timeLimitMinutes: 20,
          passingScore: 70,
          maxAttempts: 2,
          isPublished: true,
          createdBy: instructorUser?.id,
        }).returning();

        await db.insert(assessmentQuestions).values([
          { assessmentId: quiz2.id, questionId: q5.id, order: 0, points: 1 },
          { assessmentId: quiz2.id, questionId: q6.id, order: 1, points: 1 },
        ]);
      }
    }

    logger.info("Phase 4 question bank seeded");

    // Seed Clinical Case
    logger.info("Seeding clinical cases...");
    if (nur101) {
      let [case1] = await db.select().from(clinicalCases).where(eq(clinicalCases.title, "Acute Myocardial Infarction"));
      if (!case1) {
        [case1] = await db.insert(clinicalCases).values({
          courseId: nur101.id,
          title: "Acute Myocardial Infarction",
          description: "A 58-year-old male presents with chest pain and shortness of breath.",
          patientName: "Juan Santos",
          patientAge: 58,
          patientGender: "Male",
          chiefComplaint: "Severe chest pain radiating to the left arm, diaphoresis, and dyspnea for 2 hours.",
          difficulty: "INTERMEDIATE",
          tags: ["cardiac", "emergency", "acute-care"],
          isPublished: true,
          createdBy: instructorUser?.id,
        }).returning();

        // Stage 1: Initial Assessment
        const [stage1] = await db.insert(caseStages).values({
          caseId: case1.id,
          title: "Initial Assessment",
          description: "What is the priority nursing action?",
          patientData: { vitals: { bp: "150/95", hr: 110, rr: 24, temp: 37.2, spo2: 94 } },
          order: 1,
          points: 2,
        }).returning();

        const [opt1a] = await db.insert(caseOptions).values({ stageId: stage1.id, text: "Obtain a 12-lead ECG immediately", isCorrect: true, rationale: "ECG is the gold standard for diagnosing MI and should be obtained within 10 minutes of presentation.", order: 0 }).returning();
        await db.insert(caseOptions).values([
          { stageId: stage1.id, text: "Administer morphine for pain", isCorrect: false, rationale: "While pain management is important, diagnosis takes priority.", order: 1 },
          { stageId: stage1.id, text: "Start IV access and draw labs", isCorrect: false, rationale: "Important but ECG should come first to confirm diagnosis.", order: 2 },
          { stageId: stage1.id, text: "Notify the physician", isCorrect: false, rationale: "Notification is important but should not delay diagnostic workup.", order: 3 },
        ]);

        // Stage 2: Diagnosis Confirmation
        const [stage2] = await db.insert(caseStages).values({
          caseId: case1.id,
          title: "Diagnosis Confirmation",
          description: "The ECG shows ST-segment elevation in leads II, III, and aVF. What is the priority intervention?",
          patientData: { ecg: "ST elevation in II, III, aVF", troponin: "2.5 ng/mL (elevated)" },
          order: 2,
          points: 2,
        }).returning();

        await db.insert(caseOptions).values([
          { stageId: stage2.id, text: "Administer aspirin 325mg chewed", isCorrect: true, rationale: "Aspirin inhibits platelet aggregation and is a critical first-line treatment for STEMI.", order: 0 },
          { stageId: stage2.id, text: "Prepare for PCI", isCorrect: false, rationale: "PCI is definitive treatment but aspirin should be given first.", order: 1 },
          { stageId: stage2.id, text: "Start nitroglycerin drip", isCorrect: false, rationale: "Nitroglycerin helps with pain but aspirin is priority for mortality reduction.", order: 2 },
        ]);

        // Stage 3: Post-Intervention
        const [stage3] = await db.insert(caseStages).values({
          caseId: case1.id,
          title: "Post-Intervention Monitoring",
          description: "After PCI, the patient develops hypotension (BP 85/50). What is the priority action?",
          patientData: { vitals: { bp: "85/50", hr: 55, rr: 18, temp: 36.8, spo2: 96 } },
          order: 3,
          points: 2,
        }).returning();

        await db.insert(caseOptions).values([
          { stageId: stage3.id, text: "Assess for bleeding at access site", isCorrect: true, rationale: "Hypotension post-PCI could indicate bleeding, which is a common complication.", order: 0 },
          { stageId: stage3.id, text: "Administer IV fluids", isCorrect: false, rationale: "Fluids may help but assessing for the cause is priority.", order: 1 },
          { stageId: stage3.id, text: "Place in Trendelenburg position", isCorrect: false, rationale: "Position change is supportive but identifying the cause is essential.", order: 2 },
        ]);

        logger.info("Clinical case created: Acute Myocardial Infarction");
      }
    }

    // Seed Nursing Diagnoses
    // Only when the table is empty (fresh DB): the full 37-diagnosis NANDA-I
    // set comes from scripts/seed-nanda-diagnoses.sql, which replaces these
    // five samples — a per-code upsert would keep re-adding the lone
    // non-NANDA code (00000) on every re-seed and drift to 38.
    logger.info("Seeding nursing diagnoses...");
    const diagnosisData = [
      { code: "00000", name: "Ineffective Cardiac Tissue Perfusion", category: "Cardiovascular", definition: "State in which an individual experiences a decreased blood flow through the coronary arteries." },
      { code: "00001", name: "Acute Pain", category: "Comfort", definition: "Unpleasant sensory and emotional experience arising from actual or potential tissue damage." },
      { code: "00002", name: "Anxiety", category: "Coping", definition: "A state of uneasiness and apprehension about an uncertain future." },
      { code: "00003", name: "Decreased Cardiac Output", category: "Cardiovascular", definition: "Inadequate blood volume pumped from the heart to meet metabolic demands." },
      { code: "00004", name: "Risk for Decreased Tissue Perfusion", category: "Cardiovascular", definition: "At risk for a decrease in blood circulation to a specific area of the body." },
    ];

    const [anyDiagnosis] = await db.select().from(nursingDiagnoses).limit(1);
    if (!anyDiagnosis) {
      await db.insert(nursingDiagnoses).values(diagnosisData);
    }

    logger.info("Phase 5-6 clinical cases and nursing diagnoses seeded");

    // Seed Skills Lab
    logger.info("Seeding skills lab...");
    if (nur101) {
      // Skills
      let [skill1] = await db.select().from(skills).where(eq(skills.name, "Intravenous Therapy"));
      if (!skill1) {
        [skill1] = await db.insert(skills).values({
          courseId: nur101.id,
          name: "Intravenous Therapy",
          description: "Insertion and management of IV catheters for fluid and medication administration.",
          category: "Clinical Skills",
          difficulty: "INTERMEDIATE",
          estimatedMinutes: 45,
          equipment: ["IV catheter", "IV tubing", "Normal saline", "Tape", "Tourniquet", "Alcohol swab"],
          createdBy: instructorUser?.id,
        }).returning();

        await db.insert(skillChecklists).values([
          { skillId: skill1.id, stepNumber: 1, description: "Perform hand hygiene and gather equipment", isCritical: true },
          { skillId: skill1.id, stepNumber: 2, description: "Identify patient and explain procedure", isCritical: true },
          { skillId: skill1.id, stepNumber: 3, description: "Apply tourniquet and assess vein", isCritical: false },
          { skillId: skill1.id, stepNumber: 4, description: "Clean site with alcohol swab", isCritical: true },
          { skillId: skill1.id, stepNumber: 5, description: "Insert catheter at 15-30 degree angle", isCritical: true },
          { skillId: skill1.id, stepNumber: 6, description: "Confirm flashback and advance catheter", isCritical: true },
          { skillId: skill1.id, stepNumber: 7, description: "Remove needle and connect IV tubing", isCritical: false },
          { skillId: skill1.id, stepNumber: 8, description: "Secure catheter and label", isCritical: false },
          { skillId: skill1.id, stepNumber: 9, description: "Document procedure", isCritical: false },
        ]);
      }

      let [skill2] = await db.select().from(skills).where(eq(skills.name, "Wound Dressing Change"));
      if (!skill2) {
        [skill2] = await db.insert(skills).values({
          courseId: nur101.id,
          name: "Wound Dressing Change",
          description: "Proper technique for changing wound dressings maintaining aseptic technique.",
          category: "Clinical Skills",
          difficulty: "BEGINNER",
          estimatedMinutes: 20,
          equipment: ["Sterile gloves", "Gauze", "Adhesive tape", "Saline solution", "Disposal bag"],
          createdBy: instructorUser?.id,
        }).returning();

        await db.insert(skillChecklists).values([
          { skillId: skill2.id, stepNumber: 1, description: "Perform hand hygiene and prepare supplies", isCritical: true },
          { skillId: skill2.id, stepNumber: 2, description: "Explain procedure to patient", isCritical: false },
          { skillId: skill2.id, stepNumber: 3, description: "Remove old dressing using aseptic technique", isCritical: true },
          { skillId: skill2.id, stepNumber: 4, description: "Assess wound for signs of infection", isCritical: true },
          { skillId: skill2.id, stepNumber: 5, description: "Clean wound with saline", isCritical: true },
          { skillId: skill2.id, stepNumber: 6, description: "Apply new sterile dressing", isCritical: true },
          { skillId: skill2.id, stepNumber: 7, description: "Secure dressing and document", isCritical: false },
        ]);
      }

      let [skill3] = await db.select().from(skills).where(eq(skills.name, "Urinary Catheterization"));
      if (!skill3) {
        [skill3] = await db.insert(skills).values({
          courseId: nur101.id,
          name: "Urinary Catheterization",
          description: "Insertion of urinary catheter for urine output monitoring.",
          category: "Clinical Skills",
          difficulty: "INTERMEDIATE",
          estimatedMinutes: 30,
          equipment: ["Foley catheter", "Catheterization tray", "Sterile gloves", "Antiseptic solution", "Lubricant", "Collection bag"],
          createdBy: instructorUser?.id,
        }).returning();

        await db.insert(skillChecklists).values([
          { skillId: skill3.id, stepNumber: 1, description: "Perform hand hygiene and prepare sterile field", isCritical: true },
          { skillId: skill3.id, stepNumber: 2, description: "Position patient and provide privacy", isCritical: false },
          { skillId: skill3.id, stepNumber: 3, description: "Clean periurethral area with antiseptic", isCritical: true },
          { skillId: skill3.id, stepNumber: 4, description: "Insert catheter until urine flows", isCritical: true },
          { skillId: skill3.id, stepNumber: 5, description: "Advance catheter 2-3 inches more", isCritical: true },
          { skillId: skill3.id, stepNumber: 6, description: " Inflate balloon with sterile water", isCritical: true },
          { skillId: skill3.id, stepNumber: 7, description: "Connect to collection bag and document", isCritical: false },
        ]);
      }

      // Stations
      let [station1] = await db.select().from(skillStations).where(eq(skillStations.name, "Skills Lab Room A"));
      if (!station1) {
        await db.insert(skillStations).values({
          name: "Skills Lab Room A",
          description: "Basic skills practice room with mannequins",
          location: "Building 1, Room 101",
          capacity: 8,
        });
      }

      let [station2] = await db.select().from(skillStations).where(eq(skillStations.name, "Skills Lab Room B"));
      if (!station2) {
        await db.insert(skillStations).values({
          name: "Skills Lab Room B",
          description: "Advanced skills room with simulation equipment",
          location: "Building 1, Room 102",
          capacity: 6,
        });
      }
    }

    logger.info("Phase 7 skills lab seeded");

    // Seed Clinical Rotations
    logger.info("Seeding clinical rotations...");
    if (nur101) {
      let [rotation1] = await db.select().from(clinicalRotations).where(eq(clinicalRotations.title, "Medical-Surgical Nursing Rotation"));
      if (!rotation1) {
        [rotation1] = await db.insert(clinicalRotations).values({
          courseId: nur101.id,
          instructorId: instructorUser?.id,
          title: "Medical-Surgical Nursing Rotation",
          description: "Clinical rotation in medical-surgical ward",
          department: "Medical-Surgical Ward",
          startDate: new Date("2025-09-01"),
          endDate: new Date("2025-12-15"),
          requiredHours: 120,
          status: "SCHEDULED",
          createdBy: instructorUser?.id,
        }).returning();
      }

      let [rotation2] = await db.select().from(clinicalRotations).where(eq(clinicalRotations.title, "Community Health Nursing Rotation"));
      if (!rotation2) {
        await db.insert(clinicalRotations).values({
          courseId: nur101.id,
          instructorId: instructorUser?.id,
          title: "Community Health Nursing Rotation",
          description: "Clinical rotation in community health center",
          department: "Community Health Center",
          startDate: new Date("2026-01-10"),
          endDate: new Date("2026-04-30"),
          requiredHours: 80,
          status: "SCHEDULED",
          createdBy: instructorUser?.id,
        });
      }
    }

    // Seed Competency Framework
    logger.info("Seeding competency framework...");
    let [framework1] = await db.select().from(competencyFrameworks).where(eq(competencyFrameworks.name, "BSN Core Competencies"));
    if (!framework1) {
      [framework1] = await db.insert(competencyFrameworks).values({
        name: "BSN Core Competencies",
        description: "Core competencies for Bachelor of Science in Nursing graduates",
        version: "1.0",
        programId: bsnProgram?.id,
        isDefault: true,
        createdBy: instructorUser?.id,
      }).returning();

      // Clinical Practice Competencies
      let [comp1] = await db.select().from(competencies).where(eq(competencies.name, "Patient Assessment"));
      if (!comp1) {
        [comp1] = await db.insert(competencies).values({
          frameworkId: framework1.id,
          name: "Patient Assessment",
          description: "Ability to perform comprehensive patient assessment",
          category: "Clinical Practice",
          targetLevel: "COMPETENT",
        }).returning();

        await db.insert(competencyIndicators).values([
          { competencyId: comp1.id, description: "Performs head-to-toe assessment accurately", measurementMethod: "Skills checklist" },
          { competencyId: comp1.id, description: "Identifies abnormal findings", measurementMethod: "Clinical evaluation" },
          { competencyId: comp1.id, description: "Documents assessment findings completely", measurementMethod: "Chart review" },
        ]);
      }

      let [comp2] = await db.select().from(competencies).where(eq(competencies.name, "Medication Administration"));
      if (!comp2) {
        [comp2] = await db.insert(competencies).values({
          frameworkId: framework1.id,
          name: "Medication Administration",
          description: "Safe and accurate medication administration",
          category: "Clinical Practice",
          targetLevel: "COMPETENT",
        }).returning();

        await db.insert(competencyIndicators).values([
          { competencyId: comp2.id, description: "Follows the 10 rights of medication administration", measurementMethod: "Observation" },
          { competencyId: comp2.id, description: "Calculates dosages accurately", measurementMethod: "Dosage calculation test" },
          { competencyId: comp2.id, description: "Documents medication administration properly", measurementMethod: "Chart review" },
        ]);
      }

      let [comp3] = await db.select().from(competencies).where(eq(competencies.name, "Critical Thinking"));
      if (!comp3) {
        [comp3] = await db.insert(competencies).values({
          frameworkId: framework1.id,
          name: "Critical Thinking",
          description: "Apply critical thinking in clinical decision-making",
          category: "Professional Development",
          targetLevel: "COMPETENT",
        }).returning();

        await db.insert(competencyIndicators).values([
          { competencyId: comp3.id, description: "Analyzes clinical situations effectively", measurementMethod: "Case study analysis" },
          { competencyId: comp3.id, description: "Makes evidence-based decisions", measurementMethod: "Clinical evaluation" },
        ]);
      }

      let [comp4] = await db.select().from(competencies).where(eq(competencies.name, "Communication"));
      if (!comp4) {
        await db.insert(competencies).values({
          frameworkId: framework1.id,
          name: "Communication",
          description: "Effective communication with patients, families, and healthcare team",
          category: "Professional Development",
          targetLevel: "COMPETENT",
        });
      }

      let [comp5] = await db.select().from(competencies).where(eq(competencies.name, "Patient Education"));
      if (!comp5) {
        await db.insert(competencies).values({
          frameworkId: framework1.id,
          name: "Patient Education",
          description: "Educate patients and families on health conditions and self-care",
          category: "Teaching",
          targetLevel: "COMPETENT",
        });
      }
    }

    logger.info("Phase 8-9 clinical rotations and competency framework seeded");

    // ─── Phase 10: Prerequisite Rules ──────────────────────────────────────────

    const [student] = await db.select().from(users).where(eq(users.username, "student"));
    const [nursing] = await db.select().from(courses).where(eq(courses.code, "NUR101"));
    const [medsurg] = await db.select().from(courses).where(eq(courses.code, "NUR201"));
    const [community] = await db.select().from(courses).where(eq(courses.code, "NUR301"));

    if (nursing) {
      // Prerequisite Rules
      if (medsurg && nursing) {
        const existingPrereq = await db.select().from(prerequisiteRules).where(eq(prerequisiteRules.courseId, medsurg.id));
        if (existingPrereq.length === 0) {
          await db.insert(prerequisiteRules).values([
            { courseId: medsurg.id, prerequisiteCourseId: nursing.id, isRequired: true, minimumGrade: "C" },
          ]);
        }
      }

      if (community && nursing) {
        const existingPrereq = await db.select().from(prerequisiteRules).where(eq(prerequisiteRules.courseId, community.id));
        if (existingPrereq.length === 0) {
          await db.insert(prerequisiteRules).values([
            { courseId: community.id, prerequisiteCourseId: nursing.id, isRequired: true, minimumGrade: "B" },
          ]);
        }
      }
    }

    logger.info("Phase 10 prerequisite rules seeded");

    // ─── Phase 11: Student Portfolio ───────────────────────────────────────────

    if (student && nursing) {
      // Portfolio
      let [portfolio] = await db.select().from(portfolios).where(eq(portfolios.studentId, student.id));
      if (!portfolio) {
        [portfolio] = await db.insert(portfolios).values({
          studentId: student.id,
          title: "My Nursing Portfolio",
          description: "A collection of my nursing education achievements and experiences",
          isPublished: true,
        }).returning();

        // Portfolio Items
        await db.insert(portfolioItems).values([
          { portfolioId: portfolio.id, title: "Fundamentals of Nursing Competency", description: "Achieved competency in basic nursing skills", itemType: "COMPETENCY", content: { level: "COMPETENT", skills: ["Vital Signs", "Patient Assessment"] }, order: 1, isPublished: true },
          { portfolioId: portfolio.id, title: "Clinical Skills Checklist", description: "Completed all required clinical skills", itemType: "SKILLS_CHECKLIST", content: { totalSkills: 15, completed: 12 }, order: 2, isPublished: true },
          { portfolioId: portfolio.id, title: "Reflective Practice Journal", description: "Personal reflections on clinical experiences", itemType: "JOURNAL", content: { entries: 8 }, order: 3, isPublished: false },
        ]);
      }

      // Reflections
      const existingReflections = await db.select().from(reflections).where(eq(reflections.studentId, student.id));
      if (existingReflections.length === 0) {
        await db.insert(reflections).values([
          { studentId: student.id, courseId: nursing.id, title: "First Day in Clinical", content: "Today was my first day in the clinical setting. I was nervous but excited to apply what I've learned in class. The patients were welcoming, and my preceptor was very supportive.", reflectionType: "CLINICAL", mood: "EXCITED", tags: ["first-day", "clinical"], isPublished: true },
          { studentId: student.id, courseId: nursing.id, title: "Medication Administration Experience", content: "I administered my first medication today under supervision. I followed the 10 rights of medication administration and double-checked the dosage. The patient responded well.", reflectionType: "CLINICAL", mood: "CONFIDENT", tags: ["medication", "skills"], isPublished: true },
          { studentId: student.id, courseId: nursing.id, title: "Handling Difficult Situations", content: "Today I encountered a challenging situation with an agitated patient. I learned the importance of therapeutic communication and remaining calm under pressure.", reflectionType: "PERSONAL", mood: "GROWTH", tags: ["communication", "challenges"], isPublished: true },
        ]);
      }

      // Clinical Experience Logs
      const existingLogs = await db.select().from(clinicalExperienceLogs).where(eq(clinicalExperienceLogs.studentId, student.id));
      if (existingLogs.length === 0) {
        const now = new Date();
        const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
        await db.insert(clinicalExperienceLogs).values([
          { studentId: student.id, patientCount: 3, proceduresPerformed: ["Vital Signs", "Wound Care"], skillsApplied: ["Assessment", "Communication"], challenges: "Managing multiple patients", learnings: "Time management is crucial", rating: 4, date: daysAgo(7) },
          { studentId: student.id, patientCount: 5, proceduresPerformed: ["IV Insertion", "Medication Admin"], skillsApplied: ["Clinical Reasoning", "Patient Education"], challenges: "Complex patient cases", learnings: "Importance of thorough assessment", rating: 5, date: daysAgo(3) },
          { studentId: student.id, patientCount: 4, proceduresPerformed: ["Physical Assessment", "Documentation"], skillsApplied: ["Critical Thinking", "Teamwork"], challenges: "Interprofessional collaboration", learnings: "Value of interdisciplinary approach", rating: 4, date: daysAgo(1) },
        ]);
      }

      // Achievements
      const existingAchievements = await db.select().from(achievements).where(eq(achievements.studentId, student.id));
      if (existingAchievements.length === 0) {
        await db.insert(achievements).values([
          { studentId: student.id, title: "First Clinical Day", description: "Completed first day in clinical setting", category: "MILESTONE", points: 50 },
          { studentId: student.id, title: "Medication Administration Pro", description: "Successfully administered 10 medications", category: "SKILL", points: 100 },
          { studentId: student.id, title: "Reflection Master", description: "Wrote 5 clinical reflections", category: "ENGAGEMENT", points: 75 },
          { studentId: student.id, title: "Patient Care Star", description: "Received excellent patient feedback", category: "CARE", points: 150 },
        ]);
      }

      // Certificates are intentionally NOT seeded — students start with no
      // completed courses or rotations, so coordinators issue certificates
      // only after real coursework.

      // Portfolio Feedback
      const existingFeedback = await db.select().from(portfolioFeedback);
      if (existingFeedback.length === 0) {
        const [instructor] = await db.select().from(users).where(eq(users.username, "instructor"));
        const [items] = await db.select().from(portfolioItems).where(eq(portfolioItems.portfolioId, portfolio.id));
        if (instructor && items) {
          await db.insert(portfolioFeedback).values([
            { portfolioItemId: items.id, reviewerId: instructor.id, rating: 5, comments: "Excellent clinical skills demonstration", strengths: "Strong patient assessment and communication", improvements: "Continue developing critical thinking" },
          ]);
        }
      }
    }

    logger.info("Phase 12 portfolio seeded");

    // ─── Phase 13: NLE Preparation ──────────────────────────────────────────────

    // NLE Categories
    let [cat1] = await db.select().from(nleCategories).where(eq(nleCategories.code, "FUNDAMENTALS"));
    if (!cat1) {
      [cat1] = await db.insert(nleCategories).values({ name: "Fundamentals of Nursing", code: "FUNDAMENTALS", description: "Basic nursing concepts and skills", sortOrder: 1 }).returning();
    }
    let [cat2] = await db.select().from(nleCategories).where(eq(nleCategories.code, "MEDSURG"));
    if (!cat2) {
      [cat2] = await db.insert(nleCategories).values({ name: "Medical-Surgical Nursing", code: "MEDSURG", description: "Adult health nursing", sortOrder: 2 }).returning();
    }
    let [cat3] = await db.select().from(nleCategories).where(eq(nleCategories.code, "COMMUNITY"));
    if (!cat3) {
      [cat3] = await db.insert(nleCategories).values({ name: "Community Health Nursing", code: "COMMUNITY", description: "Public health and community nursing", sortOrder: 3 }).returning();
    }
    let [cat4] = await db.select().from(nleCategories).where(eq(nleCategories.code, "PEDIATRICS"));
    if (!cat4) {
      [cat4] = await db.insert(nleCategories).values({ name: "Pediatric Nursing", code: "PEDIATRICS", description: "Child health nursing", sortOrder: 4 }).returning();
    }
    let [cat5] = await db.select().from(nleCategories).where(eq(nleCategories.code, "OBSTETRIC"));
    if (!cat5) {
      [cat5] = await db.insert(nleCategories).values({ name: "Obstetric Nursing", code: "OBSTETRIC", description: "Maternal and child health", sortOrder: 5 }).returning();
    }
    let [cat6] = await db.select().from(nleCategories).where(eq(nleCategories.code, "MENTAL"));
    if (!cat6) {
      [cat6] = await db.insert(nleCategories).values({ name: "Mental Health Nursing", code: "MENTAL", description: "Psychiatric and mental health", sortOrder: 6 }).returning();
    }

    // NLE Questions
    const existingNleQuestions = await db.select().from(nleQuestionBank);
    if (existingNleQuestions.length === 0) {
      const [instructor] = await db.select().from(users).where(eq(users.username, "instructor"));

      // Fundamentals questions
      const [q1] = await db.insert(nleQuestionBank).values({
        categoryId: cat1.id,
        questionText: "What is the normal range for adult resting heart rate?",
        questionType: "MC",
        difficulty: "EASY",
        explanation: "Normal adult resting heart rate is 60-100 beats per minute.",
        isHighYield: true,
        createdBy: instructor?.id,
      }).returning();

      await db.insert(nleQuestionOptions).values([
        { questionId: q1.id, optionText: "50-80 bpm", isCorrect: false, order: 0 },
        { questionId: q1.id, optionText: "60-100 bpm", isCorrect: true, order: 1 },
        { questionId: q1.id, optionText: "70-110 bpm", isCorrect: false, order: 2 },
        { questionId: q1.id, optionText: "80-120 bpm", isCorrect: false, order: 3 },
      ]);

      const [q2] = await db.insert(nleQuestionBank).values({
        categoryId: cat1.id,
        questionText: "Which vital sign indicates fever in an adult?",
        questionType: "MC",
        difficulty: "EASY",
        explanation: "Temperature above 37.5°C (99.5°F) is considered fever.",
        isHighYield: true,
        createdBy: instructor?.id,
      }).returning();

      await db.insert(nleQuestionOptions).values([
        { questionId: q2.id, optionText: "36.5°C", isCorrect: false, order: 0 },
        { questionId: q2.id, optionText: "37.0°C", isCorrect: false, order: 1 },
        { questionId: q2.id, optionText: "37.5°C", isCorrect: true, order: 2 },
        { questionId: q2.id, optionText: "38.5°C", isCorrect: false, order: 3 },
      ]);

      // MedSurg question
      const [q3] = await db.insert(nleQuestionBank).values({
        categoryId: cat2.id,
        questionText: "What is the priority nursing intervention for a patient with chest pain?",
        questionType: "MC",
        difficulty: "MEDIUM",
        explanation: "The priority is to assess the patient's vital signs and administer oxygen if indicated.",
        isHighYield: true,
        createdBy: instructor?.id,
      }).returning();

      await db.insert(nleQuestionOptions).values([
        { questionId: q3.id, optionText: "Administer pain medication immediately", isCorrect: false, order: 0 },
        { questionId: q3.id, optionText: "Assess vital signs and administer oxygen", isCorrect: true, order: 1 },
        { questionId: q3.id, optionText: "Call the physician", isCorrect: false, order: 2 },
        { questionId: q3.id, optionText: "Perform ECG", isCorrect: false, order: 3 },
      ]);

      // Community Health question
      const [q4] = await db.insert(nleQuestionBank).values({
        categoryId: cat3.id,
        questionText: "What is the primary goal of community health nursing?",
        questionType: "MC",
        difficulty: "EASY",
        explanation: "The primary goal is to promote health and prevent disease in the community.",
        isHighYield: false,
        createdBy: instructor?.id,
      }).returning();

      await db.insert(nleQuestionOptions).values([
        { questionId: q4.id, optionText: "Treat illnesses", isCorrect: false, order: 0 },
        { questionId: q4.id, optionText: "Promote health and prevent disease", isCorrect: true, order: 1 },
        { questionId: q4.id, optionText: "Provide hospital care", isCorrect: false, order: 2 },
        { questionId: q4.id, optionText: "Manage medications", isCorrect: false, order: 3 },
      ]);

      // Pediatrics question
      const [q5] = await db.insert(nleQuestionBank).values({
        categoryId: cat4.id,
        questionText: "What is the recommended immunization schedule for BCG vaccine?",
        questionType: "MC",
        difficulty: "MEDIUM",
        explanation: "BCG vaccine is given at birth in the Philippines.",
        isHighYield: true,
        createdBy: instructor?.id,
      }).returning();

      await db.insert(nleQuestionOptions).values([
        { questionId: q5.id, optionText: "At birth", isCorrect: true, order: 0 },
        { questionId: q5.id, optionText: "1 month old", isCorrect: false, order: 1 },
        { questionId: q5.id, optionText: "6 months old", isCorrect: false, order: 2 },
        { questionId: q5.id, optionText: "1 year old", isCorrect: false, order: 3 },
      ]);
    }

    // NLE Exam
    let [exam1] = await db.select().from(nleExams).where(eq(nleExams.title, "NLE Practice Exam - Fundamentals"));
    if (!exam1) {
      const [instructor] = await db.select().from(users).where(eq(users.username, "instructor"));
      [exam1] = await db.insert(nleExams).values({
        title: "NLE Practice Exam - Fundamentals",
        description: "Practice exam covering fundamental nursing concepts",
        examType: "PRACTICE",
        categoryFilter: [cat1.id],
        questionCount: 5,
        timeLimitMinutes: 30,
        passingScore: 75,
        isRandomized: true,
        showExplanations: true,
        createdBy: instructor?.id,
      }).returning();
    }

    logger.info("Phase 13 NLE preparation seeded");

    // ─── Phase 14: Virtual Patient Simulation ────────────────────────────────────

    // Virtual Patients
    const [instructor] = await db.select().from(users).where(eq(users.username, "instructor"));

    let [patient1] = await db.select().from(virtualPatients).where(eq(virtualPatients.name, "Juan dela Cruz"));
    if (!patient1) {
      [patient1] = await db.insert(virtualPatients).values({
        name: "Juan dela Cruz",
        age: 65,
        gender: "Male",
        medicalHistory: ["Hypertension", "Diabetes Mellitus Type 2"],
        allergies: ["Penicillin"],
        currentMedications: ["Metformin 500mg", "Amlodipine 5mg"],
        chiefComplaint: "Chest pain and shortness of breath",
        createdBy: instructor?.id,
      }).returning();
    }

    let [patient2] = await db.select().from(virtualPatients).where(eq(virtualPatients.name, "Maria Santos"));
    if (!patient2) {
      [patient2] = await db.insert(virtualPatients).values({
        name: "Maria Santos",
        age: 28,
        gender: "Female",
        medicalHistory: [],
        allergies: [],
        currentMedications: [],
        chiefComplaint: "Abdominal pain and nausea",
        createdBy: instructor?.id,
      }).returning();
    }

    // Nursing Actions
    const existingActions = await db.select().from(nursingActions);
    if (existingActions.length === 0) {
      await db.insert(nursingActions).values([
        { name: "Assess Vital Signs", description: "Check blood pressure, heart rate, respiratory rate, temperature, oxygen saturation", category: "ASSESSMENT", points: 10 },
        { name: "Administer Oxygen", description: "Apply oxygen therapy as ordered", category: "INTERVENTION", points: 15 },
        { name: "Establish IV Access", description: "Insert intravenous catheter", category: "INTERVENTION", points: 20 },
        { name: "Administer Medication", description: "Give prescribed medication", category: "INTERVENTION", points: 25 },
        { name: "Perform ECG", description: "Obtain electrocardiogram", category: "DIAGNOSTIC", points: 15 },
        { name: "Position Patient", description: "Position patient for comfort and safety", category: "INTERVENTION", points: 10 },
        { name: "Provide Emotional Support", description: "Reassure and comfort the patient", category: "COMMUNICATION", points: 10 },
        { name: "Notify Physician", description: "Call the attending physician", category: "COMMUNICATION", points: 15 },
        { name: "Draw Blood Work", description: "Collect blood samples for laboratory tests", category: "DIAGNOSTIC", points: 15 },
        { name: "Monitor Intake and Output", description: "Track fluid intake and output", category: "MONITORING", points: 10 },
      ]);
    }

    // Patient Scenarios
    let [scenario1] = await db.select().from(patientScenarios).where(eq(patientScenarios.title, "Acute Coronary Syndrome"));
    if (!scenario1) {
      [scenario1] = await db.insert(patientScenarios).values({
        patientId: patient1.id,
        title: "Acute Coronary Syndrome",
        description: "A 65-year-old male presents with crushing chest pain, diaphoresis, and shortness of breath",
        difficulty: "HARD",
        category: "CARDIAC",
        initialVitalSigns: { bp: "160/95", hr: 110, rr: 24, temp: 37.0, spo2: 91 },
        initialSymptoms: ["Chest pain", "Diaphoresis", "Shortness of breath", "Nausea"],
        initialConsciousness: "ALERT",
        learningObjectives: ["Recognize signs of ACS", "Prioritize nursing interventions", "Administer emergency medications"],
        timeLimitMinutes: 30,
        maxScore: 100,
        createdBy: instructor?.id,
      }).returning();

      await db.insert(patientStateTransitions).values([
        { scenarioId: scenario1.id, triggerAction: "Administer Oxygen", newVitalSigns: { bp: "155/90", hr: 105, rr: 22, temp: 37.0, spo2: 95 }, deteriorationLevel: 0, description: "Oxygen improves saturation", sortOrder: 1 },
        { scenarioId: scenario1.id, triggerAction: "Administer Medication", newVitalSigns: { bp: "140/85", hr: 95, rr: 20, temp: 37.0, spo2: 96 }, deteriorationLevel: 0, description: "Medication helps stabilize", sortOrder: 2 },
        { scenarioId: scenario1.id, triggerAction: "Delay Treatment", newVitalSigns: { bp: "170/100", hr: 120, rr: 28, temp: 37.2, spo2: 88 }, deteriorationLevel: 3, description: "Patient condition worsens", sortOrder: 3 },
      ]);

      await db.insert(patientResponses).values([
        { scenarioId: scenario1.id, actionId: (await db.select().from(nursingActions).where(eq(nursingActions.name, "Assess Vital Signs")))[0]?.id, responseText: "Patient reports chest pain 8/10. Diaphoretic and anxious.", pointsAwarded: 10, feedback: "Good assessment. Note the severity of pain." },
        { scenarioId: scenario1.id, actionId: (await db.select().from(nursingActions).where(eq(nursingActions.name, "Administer Oxygen")))[0]?.id, responseText: "Patient's breathing eases slightly. SpO2 improving.", pointsAwarded: 15, feedback: "Appropriate intervention for hypoxia." },
        { scenarioId: scenario1.id, actionId: (await db.select().from(nursingActions).where(eq(nursingActions.name, "Administer Medication")))[0]?.id, responseText: "Patient takes sublingual nitroglycerin. Pain reduces to 5/10.", pointsAwarded: 25, feedback: "Correct medication administration for ACS." },
      ]);
    }

    let [scenario2] = await db.select().from(patientScenarios).where(eq(patientScenarios.title, "Acute Appendicitis"));
    if (!scenario2) {
      [scenario2] = await db.insert(patientScenarios).values({
        patientId: patient2.id,
        title: "Acute Appendicitis",
        description: "A 28-year-old female presents with right lower quadrant pain, fever, and nausea",
        difficulty: "MEDIUM",
        category: "SURGICAL",
        initialVitalSigns: { bp: "120/80", hr: 95, rr: 20, temp: 38.2, spo2: 98 },
        initialSymptoms: ["Right lower quadrant pain", "Fever", "Nausea", "Anorexia"],
        initialConsciousness: "ALERT",
        learningObjectives: ["Assess for appendicitis signs", "Prepare for possible surgery", "Manage pain effectively"],
        timeLimitMinutes: 25,
        maxScore: 100,
        createdBy: instructor?.id,
      }).returning();

      await db.insert(patientStateTransitions).values([
        { scenarioId: scenario2.id, triggerAction: "Administer Medication", newVitalSigns: { bp: "118/78", hr: 88, rr: 18, temp: 37.8, spo2: 98 }, deteriorationLevel: 0, description: "Pain medication helps", sortOrder: 1 },
        { scenarioId: scenario2.id, triggerAction: "Delay Treatment", newVitalSigns: { bp: "115/75", hr: 105, rr: 22, temp: 39.0, spo2: 97 }, deteriorationLevel: 2, description: "Condition worsening, possible perforation risk", sortOrder: 2 },
      ]);
    }

    logger.info("Phase 14 virtual patient simulation seeded");

    // ─── Phase 15: AI Tutor ─────────────────────────────────────────────────────

    // AI Hints
    const existingHints = await db.select().from(aiHints);
    if (existingHints.length === 0) {
      await db.insert(aiHints).values([
        { topic: "vital signs", subtopic: "blood pressure", hintLevel: 1, hintContent: "Consider what each number in a blood pressure reading represents." },
        { topic: "vital signs", subtopic: "blood pressure", hintLevel: 2, hintContent: "The top number (systolic) measures pressure when the heart beats. The bottom number (diastolic) measures pressure between beats." },
        { topic: "vital signs", subtopic: "blood pressure", hintLevel: 3, hintContent: "Normal BP is 120/80 mmHg. Elevated is 120-129/<80. Stage 1 hypertension is 130-139/80-89." },
        { topic: "vital signs", subtopic: "heart rate", hintLevel: 1, hintContent: "Think about what factors can affect heart rate." },
        { topic: "vital signs", subtopic: "heart rate", hintLevel: 2, hintContent: "Normal adult resting heart rate is 60-100 bpm. Athletes may have lower rates." },
        { topic: "medication", subtopic: "safety", hintLevel: 1, hintContent: "Remember the mnemonic for medication safety: the 10 Rights." },
        { topic: "medication", subtopic: "safety", hintLevel: 2, hintContent: "Right patient, right drug, right dose, right route, right time, right documentation, right reason, right response, right to refuse, right education." },
        { topic: "assessment", subtopic: "head-to-toe", hintLevel: 1, hintContent: "Start from the head and work systematically downward." },
        { topic: "assessment", subtopic: "head-to-toe", hintLevel: 2, hintContent: "Head/Neck -> Chest -> Abdomen -> Extremities -> Neurological." },
        { topic: "nursing process", subtopic: "diagnosis", hintLevel: 1, hintContent: "Nursing diagnoses follow NANDA format." },
        { topic: "nursing process", subtopic: "diagnosis", hintLevel: 2, hintContent: "Format: Problem related to [etiology] as evidenced by [signs/symptoms]." },
      ]);
    }

    // Socratic Questions
    const existingSocratic = await db.select().from(aiSocraticQuestions);
    if (existingSocratic.length === 0) {
      await db.insert(aiSocraticQuestions).values([
        { topic: "vital signs", question: "If a patient's blood pressure drops from 120/80 to 90/60, what would you assess first?", followUpQuestions: ["What might cause this change?", "What interventions would you prioritize?"], expectedReasoning: "Consider hypovolemia, bleeding, or shock. Assess LOC, skin color, urine output.", difficulty: "MEDIUM" },
        { topic: "medication", question: "A patient is prescribed Digoxin 0.25mg daily. Before administration, what would you check?", followUpQuestions: ["Why is this important?", "What would you do if the pulse is below 60?"], expectedReasoning: "Check apical pulse for 1 minute. Hold if <60 bpm and notify physician.", difficulty: "MEDIUM" },
        { topic: "assessment", question: "You notice a patient's lungs sound crackly on auscultation. What does this suggest?", followUpQuestions: ["What other assessments would you perform?", "What interventions would you anticipate?"], expectedReasoning: "Crackles may indicate fluid overload, pneumonia, or pulmonary edema. Assess O2 sat, respiratory rate, and edema.", difficulty: "MEDIUM" },
        { topic: "nursing process", question: "A patient's nursing diagnosis is 'Ineffective Breathing Pattern related to anxiety.' How would you evaluate this?", followUpQuestions: ["What outcomes would indicate improvement?", "What interventions support this diagnosis?"], expectedReasoning: "Evaluate respiratory rate, depth, O2 sat, and patient's reported anxiety level.", difficulty: "MEDIUM" },
        { topic: "clinical", question: "You have two patients: one with chest pain and one needing a dressing change. How do you prioritize?", followUpQuestions: ["What framework guides your decision?", "What would change if the situations were different?"], expectedReasoning: "Use ABCs and acuity. Chest pain is potentially life-threatening and takes priority.", difficulty: "HARD" },
      ]);
    }

    logger.info("Phase 15 AI tutor seeded");

    // ─── Phase 16: AI Content Generation ────────────────────────────────────────

    const existingAiQuestions = await db.select().from(aiGeneratedQuestions);
    if (existingAiQuestions.length === 0) {
      const [instructorUser] = await db.select().from(users).where(eq(users.username, "instructor"));
      const [nursingCourse] = await db.select().from(courses).where(eq(courses.code, "NUR101"));

      // Sample AI-generated questions (approved for use)
      await db.insert(aiGeneratedQuestions).values([
        { courseId: nursingCourse?.id, topic: "Vital Signs", questionText: "What is the normal range for adult body temperature?", questionType: "MC", options: ["35.5-36.5°C", "36.5-37.5°C", "37.5-38.5°C", "38.5-39.5°C"], correctAnswer: "36.5-37.5°C", explanation: "Normal body temperature ranges from 36.5-37.5°C.", difficulty: "EASY", generatedBy: instructorUser?.id, status: "APPROVED", reviewedBy: instructorUser?.id, reviewedAt: new Date() },
        { courseId: nursingCourse?.id, topic: "Vital Signs", questionText: "Which vital sign indicates respiratory distress?", questionType: "MC", options: ["Bradycardia", "Hypotension", "Tachypnea", "Hypothermia"], correctAnswer: "Tachypnea", explanation: "Tachypnea (rapid breathing) is a key indicator of respiratory distress.", difficulty: "MEDIUM", generatedBy: instructorUser?.id, status: "APPROVED", reviewedBy: instructorUser?.id, reviewedAt: new Date() },
        { courseId: nursingCourse?.id, topic: "Medication Safety", questionText: "The 10 Rights of medication administration include all EXCEPT:", questionType: "MC", options: ["Right patient", "Right drug", "Right hospital", "Right dose"], correctAnswer: "Right hospital", explanation: "The 10 Rights do not include 'Right hospital'.", difficulty: "EASY", generatedBy: instructorUser?.id, status: "PENDING" },
      ]);

      // Sample AI-generated cases
      await db.insert(aiGeneratedCases).values([
        { courseId: nursingCourse?.id, title: "Post-Operative Pain Management", description: "A 45-year-old patient post-appendectomy reports increasing pain.", patientProfile: { age: 45, gender: "Female", medicalHistory: ["Appendectomy"] }, clinicalPresentation: "Patient reports pain 7/10, guarding abdomen, elevated BP and HR.", stages: [{ stage: 1, description: "Assess pain using numeric scale" }, { stage: 2, description: "Implement non-pharmacological interventions" }, { stage: 3, description: "Administer prescribed analgesics" }], learningObjectives: ["Apply pain assessment principles", "Implement multimodal pain management"], difficulty: "MEDIUM", generatedBy: instructorUser?.id, status: "APPROVED", reviewedBy: instructorUser?.id, reviewedAt: new Date() },
      ]);

      // Sample AI-generated study guides
      await db.insert(aiGeneratedStudyGuides).values([
        { courseId: nursingCourse?.id, title: "Fundamentals of Nursing Study Guide", content: "# Fundamentals of Nursing\n\n## Key Topics\n- Vital Signs Assessment\n- Patient Safety\n- Infection Control\n- Medication Administration", summary: "Comprehensive study guide covering fundamental nursing concepts.", keyPoints: ["Vital signs normal ranges", "10 Rights of medication", "Standard precautions"], practiceQuestions: [{ q: "What are the 5 Rights?", a: "Patient, drug, dose, route, time" }], generatedBy: instructorUser?.id, status: "APPROVED", reviewedBy: instructorUser?.id, reviewedAt: new Date() },
      ]);
    }

    logger.info("Phase 16 AI content generation seeded");

    // ─── Phase 17: Research Analytics ────────────────────────────────────────────

    const existingProjects = await db.select().from(researchProjects);
    if (existingProjects.length === 0) {
      // Research showcase runs on instructor1's account (own-projects-only visibility)
      const [researchInstructor] = await db.select().from(users).where(eq(users.username, "instructor1"));

      // Sample research project
      const [project] = await db.insert(researchProjects).values({
        title: "Effectiveness of Simulation-Based Learning in Nursing Education",
        description: "A quasi-experimental study comparing simulation-based learning with traditional clinical instruction.",
        researchType: "QUASI_EXPERIMENTAL",
        principalInvestigator: researchInstructor?.id,
        startDate: new Date("2026-01-15"),
        status: "ACTIVE",
        fundingSource: "University Research Grant",
        irbNumber: "IRB-2026-001",
        irbApprovalDate: new Date("2025-12-01"),
      }).returning();

      // Cohort
      const [cohort] = await db.insert(researchCohorts).values({
        projectId: project.id,
        name: "BSN Year 3 Students",
        description: "Third-year BSN students enrolled in Medical-Surgical Nursing",
        cohortType: "INTERVENTION",
        targetSize: 60,
        currentSize: 45,
        inclusionCriteria: { yearLevel: 3, course: "NUR301" },
      }).returning();

      // Study
      const [study] = await db.insert(researchStudies).values({
        projectId: project.id,
        cohortId: cohort.id,
        title: "Simulation vs Traditional Clinical Instruction",
        studyDesign: "QUASI_EXPERIMENTAL",
        intervention: "High-fidelity simulation for 4 weeks",
        controlGroup: "Traditional clinical instruction",
        outcomeMeasures: ["Clinical competency scores", "Critical thinking scores", "Student satisfaction"],
        status: "DATA_COLLECTION",
      }).returning();

      // 30 demo projects for the research module showcase
      await db.insert(researchProjects).values(
        DEMO_RESEARCH_PROJECTS.map((p) => ({
          title: p.title,
          description: "Demo research project for the NurseLearn PH showcase.",
          researchType: p.researchType,
          principalInvestigator: researchInstructor?.id,
          startDate: new Date(p.startDate),
          status: p.status,
          fundingSource: p.fundingSource,
        }))
      );

      logger.info(`Created research project: ${project.title} + ${DEMO_RESEARCH_PROJECTS.length} demo projects`);
    }

    logger.info("Phase 17 research analytics seeded");
    logger.info("Phase 9 seed completed successfully.");
  } catch (err) {
    logger.error({ err }, "Seed failed");
    throw err;
  }
}

seed()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, "Seed process failed");
    await closePool();
    process.exit(1);
  });
