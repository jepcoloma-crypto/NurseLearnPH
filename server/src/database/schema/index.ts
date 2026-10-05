import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  pgEnum,
  uniqueIndex,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
  "ADMIN",
  "PROGRAM_COORDINATOR",
  "INSTRUCTOR",
  "CLINICAL_INSTRUCTOR",
  "STUDENT",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 50 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    middleName: varchar("middle_name", { length: 100 }),
    contactNumber: varchar("contact_number", { length: 30 }),
    role: roleEnum("role").notNull().default("STUDENT"),
    isActive: boolean("is_active").notNull().default(true),
    emailVerifiedAt: timestamp("email_verified_at"),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_username_idx").on(table.username),
  ]
);

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 500 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_verification_tokens_token_hash_idx").on(table.tokenHash),
    index("email_verification_tokens_user_idx").on(table.userId),
  ]
);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 255 }).notNull(),
  resource: varchar("resource", { length: 255 }).notNull(),
  resourceId: varchar("resource_id", { length: 255 }),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: roleEnum("role").notNull(),
  permissionId: uuid("permission_id")
    .notNull()
    .references(() => permissions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const programs = pgTable("programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const academicYears = pgTable("academic_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull(),
  programId: uuid("program_id")
    .notNull()
    .references(() => programs.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const semesters = pgTable("semesters", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull(),
  academicYearId: uuid("academic_year_id")
    .notNull()
    .references(() => academicYears.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const yearLevels = pgTable("year_levels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull(),
  programId: uuid("program_id")
    .notNull()
    .references(() => programs.id),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sections = pgTable("sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull(),
  yearLevelId: uuid("year_level_id")
    .notNull()
    .references(() => yearLevels.id),
  semesterId: uuid("semester_id")
    .notNull()
    .references(() => semesters.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: text("description"),
  programId: uuid("program_id")
    .notNull()
    .references(() => programs.id),
  yearLevelId: uuid("year_level_id")
    .notNull()
    .references(() => yearLevels.id),
  semesterId: uuid("semester_id")
    .notNull()
    .references(() => semesters.id),
  instructorId: uuid("instructor_id").references(() => users.id),
  credits: integer("credits").notNull().default(3),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const courseEnrollments = pgTable("course_enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => sections.id),
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const studentSections = pgTable("student_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => sections.id),
  academicYearId: uuid("academic_year_id")
    .notNull()
    .references(() => academicYears.id),
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const learningOutcomes = pgTable("learning_outcomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id),
  code: varchar("code", { length: 50 }).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  order: integer("order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topics.id),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  order: integer("order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const materialTypeEnum = pgEnum("material_type", [
  "TEXT",
  "VIDEO",
  "DOCUMENT",
  "LINK",
  "IMAGE",
]);

export const learningMaterials = pgTable("learning_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  type: materialTypeEnum("type").notNull(),
  content: text("content"),
  url: varchar("url", { length: 1000 }),
  filePath: varchar("file_path", { length: 500 }),
  order: integer("order").notNull().default(0),
  isRequired: boolean("is_required").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const activityTypeEnum = pgEnum("activity_type", [
  "READING",
  "VIDEO_WATCH",
  "QUIZ",
  "REFLECTION",
  "CASE_STUDY",
  "DISCUSSION",
  "PRACTICE",
  "ASSIGNMENT",
]);

export const learningActivities = pgTable("learning_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  type: activityTypeEnum("type").notNull(),
  description: text("description"),
  instructions: text("instructions"),
  config: jsonb("config"),
  points: integer("points").notNull().default(0),
  order: integer("order").notNull().default(0),
  isRequired: boolean("is_required").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const progressStatusEnum = pgEnum("progress_status", [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
]);

export const studentLessonProgress = pgTable(
  "student_lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id),
    status: progressStatusEnum("status").notNull().default("NOT_STARTED"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
    score: integer("score"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("student_lesson_progress_student_idx").on(table.studentId),
    index("student_lesson_progress_lesson_idx").on(table.lessonId),
  ]
);

// ─── Question Bank ──────────────────────────────────────────────────────────

export const questionTypeEnum = pgEnum("question_type", [
  "MC",
  "TF",
  "ESSAY",
  "FILL_BLANK",
  "SCENARIO",
]);

export const difficultyEnum = pgEnum("difficulty", ["EASY", "MEDIUM", "HARD"]);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    topicId: uuid("topic_id").references(() => topics.id),
    type: questionTypeEnum("type").notNull(),
    difficulty: difficultyEnum("difficulty").notNull().default("MEDIUM"),
    stem: text("stem").notNull(),
    explanation: text("explanation"),
    points: integer("points").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("questions_course_idx").on(table.courseId),
    index("questions_topic_idx").on(table.topicId),
    uniqueIndex("questions_course_stem_unique").on(table.courseId, table.stem),
  ]
);

export const questionOptions = pgTable("question_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  order: integer("order").notNull().default(0),
});

// ─── Assessments ────────────────────────────────────────────────────────────

export const assessmentTypeEnum = pgEnum("assessment_type", [
  "QUIZ",
  "EXAM",
  "ASSIGNMENT",
]);

export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    type: assessmentTypeEnum("type").notNull().default("QUIZ"),
    timeLimitMinutes: integer("time_limit_minutes"),
    passingScore: integer("passing_score").notNull().default(75),
    maxAttempts: integer("max_attempts").notNull().default(1),
    isPublished: boolean("is_published").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("assessments_course_idx").on(table.courseId),
  ]
);

export const assessmentQuestions = pgTable(
  "assessment_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    order: integer("order").notNull().default(0),
    points: integer("points").notNull().default(1),
  },
  (table) => [
    index("assessment_questions_assessment_idx").on(table.assessmentId),
  ]
);

// ─── Assessment Attempts ────────────────────────────────────────────────────

export const attemptStatusEnum = pgEnum("attempt_status", [
  "IN_PROGRESS",
  "SUBMITTED",
  "GRADED",
]);

export const assessmentAttempts = pgTable(
  "assessment_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    status: attemptStatusEnum("status").notNull().default("IN_PROGRESS"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
    score: integer("score"),
    timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
    gradedBy: uuid("graded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("assessment_attempts_assessment_idx").on(table.assessmentId),
    index("assessment_attempts_student_idx").on(table.studentId),
  ]
);

export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => assessmentAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id),
    selectedOptionId: uuid("selected_option_id").references(
      () => questionOptions.id
    ),
    textAnswer: text("text_answer"),
    isCorrect: boolean("is_correct"),
    pointsAwarded: integer("points_awarded").notNull().default(0),
    feedback: text("feedback"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("attempt_answers_attempt_idx").on(table.attemptId),
  ]
);

// ─── Phase 5: Clinical Reasoning ────────────────────────────────────────────

export const caseDifficultyEnum = pgEnum("case_difficulty", [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
]);

export const clinicalCases = pgTable(
  "clinical_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    department: varchar("department", { length: 100 }),
    patientName: varchar("patient_name", { length: 100 }),
    patientAge: integer("patient_age"),
    patientGender: varchar("patient_gender", { length: 20 }),
    chiefComplaint: text("chief_complaint"),
    difficulty: caseDifficultyEnum("difficulty").notNull().default("BEGINNER"),
    tags: jsonb("tags"),
    maxAttempts: integer("max_attempts").notNull().default(3),
    isPublished: boolean("is_published").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("clinical_cases_course_idx").on(table.courseId),
  ]
);

export const caseStages = pgTable(
  "case_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => clinicalCases.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    patientData: jsonb("patient_data"),
    order: integer("order").notNull().default(0),
    points: integer("points").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("case_stages_case_idx").on(table.caseId),
  ]
);

export const caseOptions = pgTable(
  "case_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => caseStages.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    rationale: text("rationale"),
    order: integer("order").notNull().default(0),
  },
  (table) => [
    index("case_options_stage_idx").on(table.stageId),
  ]
);

export const caseAttemptStatusEnum = pgEnum("case_attempt_status", [
  "IN_PROGRESS",
  "COMPLETED",
  "ABANDONED",
]);

export const caseAttempts = pgTable(
  "case_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => clinicalCases.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    status: caseAttemptStatusEnum("status").notNull().default("IN_PROGRESS"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    score: integer("score").notNull().default(0),
    totalPoints: integer("total_points").notNull().default(0),
    timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("case_attempts_case_idx").on(table.caseId),
    index("case_attempts_student_idx").on(table.studentId),
  ]
);

export const caseResponses = pgTable(
  "case_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => caseAttempts.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => caseStages.id),
    selectedOptionId: uuid("selected_option_id").references(
      () => caseOptions.id
    ),
    isCorrect: boolean("is_correct"),
    pointsAwarded: integer("points_awarded").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("case_responses_attempt_idx").on(table.attemptId),
  ]
);

// ─── Phase 6: Nursing Process ───────────────────────────────────────────────

export const nursingDiagnoses = pgTable(
  "nursing_diagnoses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    category: varchar("category", { length: 100 }),
    definition: text("definition"),
    riskFactors: jsonb("risk_factors"),
    relatedFactors: jsonb("related_factors"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  }
);

export const carePlanStatusEnum = pgEnum("care_plan_status", [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "RETURNED",
  "ACTIVE",
  "COMPLETED",
  "ARCHIVED",
]);

export const goalTypeEnum = pgEnum("goal_type", [
  "SHORT_TERM",
  "LONG_TERM",
]);

export const carePlans = pgTable(
  "care_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    caseId: uuid("case_id").references(() => clinicalCases.id),
    title: varchar("title", { length: 255 }).notNull(),
    patientName: varchar("patient_name", { length: 100 }),
    patientAge: integer("patient_age"),
    patientGender: varchar("patient_gender", { length: 20 }),
    medicalDiagnosis: text("medical_diagnosis"),
    subjectiveData: text("subjective_data"),
    objectiveData: text("objective_data"),
    status: carePlanStatusEnum("status").notNull().default("DRAFT"),
    createdBy: uuid("created_by").references(() => users.id),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    feedback: text("feedback"),
    evaluatedBy: uuid("evaluated_by").references(() => users.id),
    evaluatedAt: timestamp("evaluated_at"),
    evaluationNotes: text("evaluation_notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("care_plans_course_idx").on(table.courseId),
    index("care_plans_student_idx").on(table.studentId),
  ]
);

export const carePlanDiagnoses = pgTable(
  "care_plan_diagnoses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    carePlanId: uuid("care_plan_id")
      .notNull()
      .references(() => carePlans.id, { onDelete: "cascade" }),
    diagnosisId: uuid("diagnosis_id")
      .notNull()
      .references(() => nursingDiagnoses.id),
    priority: integer("priority").notNull().default(1),
    evidence: text("evidence"),
    rationale: text("rationale"),
    goalType: goalTypeEnum("goal_type").default("SHORT_TERM"),
    assessmentData: text("assessment_data"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("care_plan_diagnoses_plan_idx").on(table.carePlanId),
  ]
);

export const carePlanOutcomes = pgTable(
  "care_plan_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    carePlanDiagnosisId: uuid("care_plan_diagnosis_id")
      .notNull()
      .references(() => carePlanDiagnoses.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    timeframe: varchar("timeframe", { length: 100 }),
    criteria: text("criteria"),
    isMet: boolean("is_met").notNull().default(false),
    evaluationNotes: text("evaluation_notes"),
    evaluatedAt: timestamp("evaluated_at"),
    actualOutcome: text("actual_outcome"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("care_plan_outcomes_diagnosis_idx").on(table.carePlanDiagnosisId),
  ]
);

export const interventionCategoryEnum = pgEnum("intervention_category", [
  "ASSESSMENT",
  "THERAPEUTIC",
  "TEACHING",
  "COORDINATION",
  "COLLABORATIVE",
  "PATIENT_CONTROL",
]);

export const carePlanInterventions = pgTable(
  "care_plan_interventions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    carePlanDiagnosisId: uuid("care_plan_diagnosis_id")
      .notNull()
      .references(() => carePlanDiagnoses.id, { onDelete: "cascade" }),
    category: interventionCategoryEnum("category").notNull(),
    description: text("description").notNull(),
    rationale: text("rationale"),
    frequency: varchar("frequency", { length: 100 }),
    expectedTime: varchar("expected_time", { length: 100 }),
    isCompleted: boolean("is_completed").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("care_plan_interventions_diagnosis_idx").on(table.carePlanDiagnosisId),
  ]
);

// ─── Phase 7: Skills Laboratory ─────────────────────────────────────────────

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }),
    difficulty: varchar("difficulty", { length: 20 }).notNull().default("BEGINNER"),
    estimatedMinutes: integer("estimated_minutes").default(30),
    equipment: jsonb("equipment"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("skills_course_idx").on(table.courseId),
  ]
);

export const skillChecklists = pgTable(
  "skill_checklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull(),
    description: text("description").notNull(),
    isCritical: boolean("is_critical").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("skill_checklists_skill_idx").on(table.skillId),
  ]
);

export const skillStations = pgTable(
  "skill_stations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    location: varchar("location", { length: 255 }),
    capacity: integer("capacity").notNull().default(1),
    isAvailable: boolean("is_available").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  }
);

export const skillAssessmentStatusEnum = pgEnum("skill_assessment_status", [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const skillAssessments = pgTable(
  "skill_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id),
    stationId: uuid("station_id").references(() => skillStations.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id),
    status: skillAssessmentStatusEnum("status").notNull().default("SCHEDULED"),
    scheduledAt: timestamp("scheduled_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    score: integer("score"),
    maxScore: integer("max_score").notNull().default(100),
    isCompetent: boolean("is_competent"),
    feedback: text("feedback"),
    studentSkillId: uuid("student_skill_id").references(() => studentSkills.id),
    timeSpentSeconds: integer("time_spent_seconds").default(0),
    attemptNumber: integer("attempt_number").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("skill_assessments_skill_idx").on(table.skillId),
    index("skill_assessments_student_idx").on(table.studentId),
  ]
);

export const skillAssessmentItems = pgTable(
  "skill_assessment_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => skillAssessments.id, { onDelete: "cascade" }),
    checklistId: uuid("checklist_id")
      .notNull()
      .references(() => skillChecklists.id),
    isCompleted: boolean("is_completed").notNull().default(false),
    notes: text("notes"),
    pointsAwarded: integer("points_awarded").default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("skill_assessment_items_assessment_idx").on(table.assessmentId),
  ]
);

export const studentSkills = pgTable(
  "student_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id),
    status: varchar("status", { length: 30 }).notNull().default("NOT_STARTED"),
    isCompetent: boolean("is_competent").notNull().default(false),
    bestScore: integer("best_score").default(0),
    attemptsCount: integer("attempts_count").notNull().default(0),
    checkedItems: jsonb("checked_items"),
    lastPracticeAt: timestamp("last_practice_at"),
    requestedAssessment: boolean("requested_assessment").notNull().default(false),
    lastAssessedAt: timestamp("last_assessed_at"),
    signedOffBy: uuid("signed_off_by").references(() => users.id),
    signedOffAt: timestamp("signed_off_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("student_skills_student_idx").on(table.studentId),
    index("student_skills_skill_idx").on(table.skillId),
  ]
);

// ─── Phase 8: Clinical/RLE ──────────────────────────────────────────────────

export const rotationStatusEnum = pgEnum("rotation_status", [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const clinicalRotations = pgTable(
  "clinical_rotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id),
    sectionId: uuid("section_id").references(() => sections.id),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    facility: varchar("facility", { length: 255 }),
    department: varchar("department", { length: 100 }),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    requiredHours: integer("required_hours").notNull().default(120),
    maxStudents: integer("max_students").notNull().default(20),
    status: rotationStatusEnum("status").notNull().default("SCHEDULED"),
    completedAt: timestamp("completed_at"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("clinical_rotations_course_idx").on(table.courseId),
  ]
);

export const rotationStudents = pgTable(
  "rotation_students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rotationId: uuid("rotation_id")
      .notNull()
      .references(() => clinicalRotations.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    assignedBy: uuid("assigned_by").references(() => users.id),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("rotation_students_rotation_idx").on(table.rotationId),
    index("rotation_students_student_idx").on(table.studentId),
  ]
);

export const patientAssignments = pgTable(
  "patient_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rotationId: uuid("rotation_id")
      .notNull()
      .references(() => clinicalRotations.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    patientName: varchar("patient_name", { length: 100 }).notNull(),
    patientAge: integer("patient_age"),
    patientGender: varchar("patient_gender", { length: 20 }),
    diagnosis: text("diagnosis"),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
    releasedAt: timestamp("released_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("patient_assignments_rotation_idx").on(table.rotationId),
    index("patient_assignments_student_idx").on(table.studentId),
  ]
);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
]);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rotationId: uuid("rotation_id")
      .notNull()
      .references(() => clinicalRotations.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    date: timestamp("date").notNull(),
    status: attendanceStatusEnum("status").notNull().default("PRESENT"),
    hoursLogged: integer("hours_logged").notNull().default(0),
    notes: text("notes"),
    markedBy: uuid("marked_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("attendance_records_rotation_idx").on(table.rotationId),
    index("attendance_records_student_idx").on(table.studentId),
  ]
);

export const clinicalLogStatusEnum = pgEnum("clinical_log_status", [
  "SUBMITTED",
  "REVIEWED",
]);

export const clinicalLogs = pgTable(
  "clinical_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rotationId: uuid("rotation_id")
      .notNull()
      .references(() => clinicalRotations.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    date: timestamp("date").notNull(),
    patientCount: integer("patient_count").notNull().default(0),
    procedures: jsonb("procedures"),
    reflections: text("reflections"),
    challenges: text("challenges"),
    learningOutcomes: text("learning_outcomes"),
    submittedAt: timestamp("submitted_at").notNull().defaultNow(),
    status: clinicalLogStatusEnum("status").notNull().default("SUBMITTED"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    feedback: text("feedback"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("clinical_logs_rotation_idx").on(table.rotationId),
    index("clinical_logs_student_idx").on(table.studentId),
  ]
);

export const evaluationTypeEnum = pgEnum("evaluation_type", [
  "FORMATIVE",
  "SUMMATIVE",
  "MIDTERM",
  "FINAL",
]);

export const instructorEvaluations = pgTable(
  "instructor_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rotationId: uuid("rotation_id")
      .notNull()
      .references(() => clinicalRotations.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id),
    type: evaluationTypeEnum("type").notNull().default("FORMATIVE"),
    clinicalPerformance: integer("clinical_performance"),
    professionalBehavior: integer("professional_behavior"),
    communicationSkills: integer("communication_skills"),
    criticalThinking: integer("critical-thinking"),
    overallScore: integer("overall_score"),
    strengths: text("strengths"),
    areasForImprovement: text("areas_for_improvement"),
    comments: text("comments"),
    evaluatedAt: timestamp("evaluated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("instructor_evaluations_rotation_idx").on(table.rotationId),
    index("instructor_evaluations_student_idx").on(table.studentId),
  ]
);

// ─── Phase 9: Competency Engine ─────────────────────────────────────────────

export const competencyFrameworks = pgTable(
  "competency_frameworks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    version: varchar("version", { length: 50 }),
    programId: uuid("program_id").references(() => programs.id),
    isDefault: boolean("is_default").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  }
);

export const competencyLevelEnum = pgEnum("competency_level", [
  "BEGINNER",
  "DEVELOPING",
  "COMPETENT",
  "PROFICIENT",
  "EXPERT",
]);

export const competencies = pgTable(
  "competencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    frameworkId: uuid("framework_id")
      .notNull()
      .references(() => competencyFrameworks.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }),
    targetLevel: competencyLevelEnum("target_level").notNull().default("COMPETENT"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("competencies_framework_idx").on(table.frameworkId),
  ]
);

export const competencyIndicators = pgTable(
  "competency_indicators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    measurementMethod: varchar("measurement_method", { length: 100 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("competency_indicators_competency_idx").on(table.competencyId),
  ]
);

export const studentCompetencies = pgTable(
  "student_competencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id),
    currentLevel: competencyLevelEnum("current_level").notNull().default("BEGINNER"),
    isAchieved: boolean("is_achieved").notNull().default(false),
    achievedAt: timestamp("achieved_at"),
    evidence: jsonb("evidence"),
    assessedBy: uuid("assessed_by").references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("student_competencies_student_idx").on(table.studentId),
    index("student_competencies_competency_idx").on(table.competencyId),
  ]
);

export const competencyAssessments = pgTable(
  "competency_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competencies.id),
    assessedBy: uuid("assessed_by")
      .notNull()
      .references(() => users.id),
    levelAchieved: competencyLevelEnum("level_achieved").notNull(),
    score: integer("score"),
    evidence: jsonb("evidence"),
    comments: text("comments"),
    assessedAt: timestamp("assessed_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("competency_assessments_student_idx").on(table.studentId),
    index("competency_assessments_competency_idx").on(table.competencyId),
  ]
);

// ─── Phase 10: Adaptive Learning & Remediation ──────────────────────────────

export const learningPaths = pgTable(
  "learning_paths",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    isAdaptive: boolean("is_adaptive").notNull().default(false),
    totalItems: integer("total_items").notNull().default(0),
    completedItems: integer("completed_items").notNull().default(0),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("learning_paths_course_idx").on(table.courseId),
    index("learning_paths_student_idx").on(table.studentId),
  ]
);

export const learningPathItems = pgTable(
  "learning_path_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pathId: uuid("path_id")
      .notNull()
      .references(() => learningPaths.id, { onDelete: "cascade" }),
    itemType: varchar("item_type", { length: 50 }).notNull(),
    itemId: uuid("item_id"),
    order: integer("order").notNull().default(0),
    isRequired: boolean("is_required").notNull().default(true),
    isCompleted: boolean("is_completed").notNull().default(false),
    completedAt: timestamp("completed_at"),
    score: integer("score"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("learning_path_items_path_idx").on(table.pathId),
  ]
);

export const remediationPlans = pgTable(
  "remediation_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 255 }).notNull(),
    reason: text("reason"),
    targetCompetency: varchar("target_competency", { length: 255 }),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    createdBy: uuid("created_by").references(() => users.id),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("remediation_plans_course_idx").on(table.courseId),
    index("remediation_plans_student_idx").on(table.studentId),
  ]
);

export const remediationItems = pgTable(
  "remediation_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => remediationPlans.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    itemType: varchar("item_type", { length: 50 }).notNull(),
    itemId: uuid("item_id"),
    order: integer("order").notNull().default(0),
    isCompleted: boolean("is_completed").notNull().default(false),
    completedAt: timestamp("completed_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("remediation_items_plan_idx").on(table.planId),
  ]
);

export const prerequisiteRules = pgTable(
  "prerequisite_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    prerequisiteCourseId: uuid("prerequisite_course_id")
      .notNull()
      .references(() => courses.id),
    isRequired: boolean("is_required").notNull().default(true),
    minimumGrade: varchar("minimum_grade", { length: 10 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("prerequisite_rules_course_idx").on(table.courseId),
  ]
);

// ─── Phase 11: Analytics ─────────────────────────────────────────────────────

export const studentAnalytics = pgTable(
  "student_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    lessonsCompleted: integer("lessons_completed").notNull().default(0),
    lessonsTotal: integer("lessons_total").notNull().default(0),
    assessmentsTaken: integer("assessments_taken").notNull().default(0),
    averageScore: integer("average_score").default(0),
    competenciesAchieved: integer("competencies_achieved").notNull().default(0),
    competenciesTotal: integer("competencies_total").notNull().default(0),
    clinicalHoursLogged: integer("clinical_hours_logged").notNull().default(0),
    clinicalHoursRequired: integer("clinical_hours_required").notNull().default(120),
    skillsCompleted: integer("skills_completed").notNull().default(0),
    skillsTotal: integer("skills_total").notNull().default(0),
    overallProgress: integer("overall_progress").notNull().default(0),
    lastActivityAt: timestamp("last_activity_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("student_analytics_student_idx").on(table.studentId),
    index("student_analytics_course_idx").on(table.courseId),
  ]
);

export const courseAnalytics = pgTable(
  "course_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    totalStudents: integer("total_students").notNull().default(0),
    activeStudents: integer("active_students").notNull().default(0),
    averageProgress: integer("average_progress").notNull().default(0),
    averageScore: integer("average_score").default(0),
    completionRate: integer("completion_rate").notNull().default(0),
    totalAssessments: integer("total_assessments").notNull().default(0),
    totalLessons: integer("total_lessons").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("course_analytics_course_idx").on(table.courseId),
  ]
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    action: varchar("action", { length: 100 }).notNull(),
    resource: varchar("resource", { length: 100 }).notNull(),
    resourceId: varchar("resource_id", { length: 255 }),
    metadata: jsonb("metadata"),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("activity_logs_user_idx").on(table.userId),
    index("activity_logs_created_idx").on(table.createdAt),
  ]
);

export const performanceSnapshots = pgTable(
  "performance_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    snapshotDate: timestamp("snapshot_date").notNull(),
    overallScore: integer("overall_score"),
    assessmentScore: integer("assessment_score"),
    competencyScore: integer("competency_score"),
    clinicalScore: integer("clinical_score"),
    engagementScore: integer("engagement_score"),
    riskLevel: varchar("risk_level", { length: 20 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("performance_snapshots_student_idx").on(table.studentId),
    index("performance_snapshots_course_idx").on(table.courseId),
  ]
);

// ─── Phase 12: Student Portfolio ──────────────────────────────────────────────

export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("portfolios_student_idx").on(table.studentId),
  ]
);

export const portfolioItems = pgTable(
  "portfolio_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    itemType: varchar("item_type", { length: 50 }).notNull(),
    content: jsonb("content"),
    order: integer("order").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("portfolio_items_portfolio_idx").on(table.portfolioId),
  ]
);

export const reflections = pgTable(
  "reflections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id").references(() => courses.id),
    clinicalRotationId: uuid("clinical_rotation_id").references(() => clinicalRotations.id),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    reflectionType: varchar("reflection_type", { length: 50 }).notNull().default("CLINICAL"),
    mood: varchar("mood", { length: 50 }),
    tags: jsonb("tags"),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("reflections_student_idx").on(table.studentId),
    index("reflections_course_idx").on(table.courseId),
  ]
);

export const clinicalExperienceLogs = pgTable(
  "clinical_experience_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    clinicalRotationId: uuid("clinical_rotation_id")
      .references(() => clinicalRotations.id),
    patientCount: integer("patient_count").notNull().default(0),
    proceduresPerformed: jsonb("procedures_performed"),
    skillsApplied: jsonb("skills_applied"),
    challenges: text("challenges"),
    learnings: text("learnings"),
    supervisorNotes: text("supervisor_notes"),
    rating: integer("rating"),
    date: timestamp("date").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("clinical_exp_logs_student_idx").on(table.studentId),
    index("clinical_exp_logs_rotation_idx").on(table.clinicalRotationId),
  ]
);

export const achievements = pgTable(
  "achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }).notNull(),
    points: integer("points").notNull().default(0),
    earnedAt: timestamp("earned_at").notNull().defaultNow(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("achievements_student_idx").on(table.studentId),
  ]
);

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id").references(() => courses.id),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    issuedBy: uuid("issued_by").references(() => users.id),
    issuedAt: timestamp("issued_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at"),
    certificateNumber: varchar("certificate_number", { length: 100 }).notNull().unique(),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("certificates_student_idx").on(table.studentId),
    index("certificates_course_idx").on(table.courseId),
  ]
);

export const portfolioFeedback = pgTable(
  "portfolio_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portfolioItemId: uuid("portfolio_item_id")
      .notNull()
      .references(() => portfolioItems.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id),
    rating: integer("rating"),
    comments: text("comments").notNull(),
    strengths: text("strengths"),
    improvements: text("improvements"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("portfolio_feedback_item_idx").on(table.portfolioItemId),
  ]
);

// ─── Phase 13: NLE Preparation ───────────────────────────────────────────────

export const nleCategories = pgTable(
  "nle_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    code: varchar("code", { length: 50 }).notNull().unique(),
    parentId: uuid("parent_id"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  }
);

export const nleQuestionBank = pgTable(
  "nle_question_bank",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => nleCategories.id),
    questionText: text("question_text").notNull().unique(),
    questionType: varchar("question_type", { length: 20 }).notNull().default("MC"),
    difficulty: varchar("difficulty", { length: 20 }).notNull().default("MEDIUM"),
    explanation: text("explanation"),
    isHighYield: boolean("is_high_yield").notNull().default(false),
    tags: jsonb("tags"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("nle_questions_category_idx").on(table.categoryId),
  ]
);

export const nleQuestionOptions = pgTable(
  "nle_question_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => nleQuestionBank.id, { onDelete: "cascade" }),
    optionText: text("option_text").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    order: integer("order").notNull().default(0),
  },
  (table) => [
    index("nle_options_question_idx").on(table.questionId),
  ]
);

export const nleExams = pgTable(
  "nle_exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    examType: varchar("exam_type", { length: 50 }).notNull().default("PRACTICE"),
    categoryFilter: jsonb("category_filter"),
    questionCount: integer("question_count").notNull().default(50),
    timeLimitMinutes: integer("time_limit_minutes").notNull().default(90),
    passingScore: integer("passing_score").notNull().default(75),
    isRandomized: boolean("is_randomized").notNull().default(true),
    showExplanations: boolean("show_explanations").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  }
);

export const nleExamAttempts = pgTable(
  "nle_exam_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => nleExams.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    score: integer("score"),
    totalQuestions: integer("total_questions").notNull(),
    correctAnswers: integer("correct_answers").default(0),
    timeSpentSeconds: integer("time_spent_seconds"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    status: varchar("status", { length: 20 }).notNull().default("IN_PROGRESS"),
    questionIds: jsonb("question_ids").$type<string[] | null>(),
  },
  (table) => [
    index("nle_attempts_exam_idx").on(table.examId),
    index("nle_attempts_student_idx").on(table.studentId),
  ]
);

export const nleAttemptAnswers = pgTable(
  "nle_attempt_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => nleExamAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => nleQuestionBank.id),
    selectedOptionId: uuid("selected_option_id").references(() => nleQuestionOptions.id),
    isCorrect: boolean("is_correct"),
    timeSpentSeconds: integer("time_spent_seconds"),
    answeredAt: timestamp("answered_at").notNull().defaultNow(),
  },
  (table) => [
    index("nle_answers_attempt_idx").on(table.attemptId),
  ]
);

export const nlePerformanceAnalytics = pgTable(
  "nle_performance_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => nleCategories.id),
    totalAttempts: integer("total_attempts").notNull().default(0),
    correctAnswers: integer("correct_answers").notNull().default(0),
    averageScore: integer("average_score").default(0),
    bestScore: integer("best_score").default(0),
    lastAttemptAt: timestamp("last_attempt_at"),
    strengthLevel: varchar("strength_level", { length: 20 }),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("nle_analytics_student_idx").on(table.studentId),
    index("nle_analytics_category_idx").on(table.categoryId),
  ]
);

// ─── Phase 14: Virtual Patient Simulation ────────────────────────────────────

export const virtualPatients = pgTable(
  "virtual_patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    age: integer("age").notNull(),
    gender: varchar("gender", { length: 20 }).notNull(),
    medicalHistory: jsonb("medical_history"),
    allergies: jsonb("allergies"),
    currentMedications: jsonb("current_medications"),
    chiefComplaint: text("chief_complaint"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  }
);

export const patientScenarios = pgTable(
  "patient_scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => virtualPatients.id),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    difficulty: varchar("difficulty", { length: 20 }).notNull().default("MEDIUM"),
    category: varchar("category", { length: 100 }).notNull(),
    initialVitalSigns: jsonb("initial_vital_signs").notNull(),
    initialSymptoms: jsonb("initial_symptoms").notNull(),
    initialConsciousness: varchar("initial_consciousness", { length: 50 }).notNull().default("ALERT"),
    learningObjectives: jsonb("learning_objectives"),
    timeLimitMinutes: integer("time_limit_minutes").notNull().default(30),
    maxScore: integer("max_score").notNull().default(100),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("patient_scenarios_patient_idx").on(table.patientId),
  ]
);

export const patientStateTransitions = pgTable(
  "patient_state_transitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => patientScenarios.id, { onDelete: "cascade" }),
    triggerAction: varchar("trigger_action", { length: 100 }).notNull(),
    newVitalSigns: jsonb("new_vital_signs"),
    newSymptoms: jsonb("new_symptoms"),
    newConsciousness: varchar("new_consciousness", { length: 50 }),
    deteriorationLevel: integer("deterioration_level").notNull().default(0),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("state_transitions_scenario_idx").on(table.scenarioId),
  ]
);

export const nursingActions = pgTable(
  "nursing_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }).notNull(),
    points: integer("points").notNull().default(10),
    isApplicableTo: jsonb("is_applicable_to"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  }
);

export const patientResponses = pgTable(
  "patient_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => patientScenarios.id, { onDelete: "cascade" }),
    actionId: uuid("action_id")
      .notNull()
      .references(() => nursingActions.id),
    responseText: text("response_text").notNull(),
    vitalSignsChange: jsonb("vital_signs_change"),
    symptomChange: jsonb("symptom_change"),
    pointsAwarded: integer("points_awarded").notNull().default(0),
    feedback: text("feedback"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("patient_responses_scenario_idx").on(table.scenarioId),
    index("patient_responses_action_idx").on(table.actionId),
  ]
);

export const simulationSessions = pgTable(
  "simulation_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => patientScenarios.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    currentVitalSigns: jsonb("current_vital_signs"),
    currentSymptoms: jsonb("current_symptoms"),
    currentConsciousness: varchar("current_consciousness", { length: 50 }).notNull().default("ALERT"),
    deteriorationLevel: integer("deterioration_level").notNull().default(0),
    score: integer("score").notNull().default(0),
    timeSpentSeconds: integer("time_spent_seconds").default(0),
    status: varchar("status", { length: 20 }).notNull().default("IN_PROGRESS"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("simulation_sessions_scenario_idx").on(table.scenarioId),
    index("simulation_sessions_student_idx").on(table.studentId),
  ]
);

export const simulationActions = pgTable(
  "simulation_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => simulationSessions.id, { onDelete: "cascade" }),
    actionId: uuid("action_id")
      .notNull()
      .references(() => nursingActions.id),
    responseId: uuid("response_id").references(() => patientResponses.id),
    pointsAwarded: integer("points_awarded").notNull().default(0),
    notes: text("notes"),
    performedAt: timestamp("performed_at").notNull().defaultNow(),
  },
  (table) => [
    index("simulation_actions_session_idx").on(table.sessionId),
  ]
);

export const simulationDebriefings = pgTable(
  "simulation_debriefings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => simulationSessions.id, { onDelete: "cascade" }),
    instructorId: uuid("instructor_id").references(() => users.id),
    overallRating: integer("overall_rating"),
    strengths: text("strengths"),
    improvements: text("improvements"),
    clinicalReasoningScore: integer("clinical_reasoning_score"),
    technicalSkillsScore: integer("technical_skills_score"),
    communicationScore: integer("communication_score"),
    timeManagementScore: integer("time_management_score"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("debriefings_session_idx").on(table.sessionId),
  ]
);

// ─── Phase 15: AI Tutor ──────────────────────────────────────────────────────

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id").references(() => courses.id),
    lessonId: uuid("lesson_id"),
    title: varchar("title", { length: 255 }),
    mode: varchar("mode", { length: 50 }).notNull().default("STANDARD"),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    contextUsed: jsonb("context_used"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_conversations_student_idx").on(table.studentId),
  ]
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    messageType: varchar("message_type", { length: 50 }).notNull().default("TEXT"),
    contextSources: jsonb("context_sources"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_messages_conversation_idx").on(table.conversationId),
  ]
);

export const aiHints = pgTable(
  "ai_hints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topic: varchar("topic", { length: 255 }).notNull(),
    subtopic: varchar("subtopic", { length: 255 }),
    hintLevel: integer("hint_level").notNull().default(1),
    hintContent: text("hint_content").notNull(),
    relatedLessonId: uuid("related_lesson_id"),
    tags: jsonb("tags"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_hints_topic_idx").on(table.topic),
  ]
);

export const aiSocraticQuestions = pgTable(
  "ai_socratic_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topic: varchar("topic", { length: 255 }).notNull(),
    question: text("question").notNull(),
    followUpQuestions: jsonb("follow_up_questions"),
    expectedReasoning: text("expected_reasoning"),
    difficulty: varchar("difficulty", { length: 20 }).notNull().default("MEDIUM"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_socratic_topic_idx").on(table.topic),
  ]
);

export const aiContextCache = pgTable(
  "ai_context_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceType: varchar("source_type", { length: 50 }).notNull(),
    sourceId: uuid("source_id"),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    embedding: jsonb("embedding"),
    tags: jsonb("tags"),
    lastAccessedAt: timestamp("last_accessed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_context_source_idx").on(table.sourceType, table.sourceId),
  ]
);

// ─── Phase 16: AI Content Generation ─────────────────────────────────────────

export const aiGeneratedQuestions = pgTable(
  "ai_generated_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").references(() => courses.id),
    topic: varchar("topic", { length: 255 }).notNull(),
    questionText: text("question_text").notNull(),
    questionType: varchar("question_type", { length: 20 }).notNull().default("MC"),
    options: jsonb("options"),
    correctAnswer: text("correct_answer"),
    explanation: text("explanation"),
    difficulty: varchar("difficulty", { length: 20 }).notNull().default("MEDIUM"),
    generatedBy: uuid("generated_by").references(() => users.id),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_questions_course_idx").on(table.courseId),
    index("ai_questions_status_idx").on(table.status),
  ]
);

export const aiGeneratedCases = pgTable(
  "ai_generated_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").references(() => courses.id),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    patientProfile: jsonb("patient_profile"),
    clinicalPresentation: text("clinical_presentation"),
    stages: jsonb("stages"),
    learningObjectives: jsonb("learning_objectives"),
    difficulty: varchar("difficulty", { length: 20 }).notNull().default("MEDIUM"),
    generatedBy: uuid("generated_by").references(() => users.id),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_cases_course_idx").on(table.courseId),
    index("ai_cases_status_idx").on(table.status),
  ]
);

export const aiGeneratedStudyGuides = pgTable(
  "ai_generated_study_guides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").references(() => courses.id),
    lessonId: uuid("lesson_id"),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    summary: text("summary"),
    keyPoints: jsonb("key_points"),
    practiceQuestions: jsonb("practice_questions"),
    generatedBy: uuid("generated_by").references(() => users.id),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_guides_course_idx").on(table.courseId),
    index("ai_guides_status_idx").on(table.status),
  ]
);

export const aiContentApprovalHistory = pgTable(
  "ai_content_approval_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentType: varchar("content_type", { length: 50 }).notNull(),
    contentId: uuid("content_id").notNull(),
    action: varchar("action", { length: 50 }).notNull(),
    reviewerId: uuid("reviewer_id").references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_approval_content_idx").on(table.contentType, table.contentId),
  ]
);

// ─── Phase 17: Research Analytics ────────────────────────────────────────────

export const researchProjects = pgTable(
  "research_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    researchType: varchar("research_type", { length: 50 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("PLANNING"),
    principalInvestigator: uuid("principal_investigator").references(() => users.id),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    irbApprovalDate: timestamp("irb_approval_date"),
    irbNumber: varchar("irb_number", { length: 100 }),
    fundingSource: varchar("funding_source", { length: 255 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  }
);

export const researchCohorts = pgTable(
  "research_cohorts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => researchProjects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    cohortType: varchar("cohort_type", { length: 50 }).notNull(),
    targetSize: integer("target_size"),
    currentSize: integer("current_size").notNull().default(0),
    inclusionCriteria: jsonb("inclusion_criteria"),
    exclusionCriteria: jsonb("exclusion_criteria"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("research_cohorts_project_idx").on(table.projectId),
  ]
);

export const researchStudies = pgTable(
  "research_studies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => researchProjects.id, { onDelete: "cascade" }),
    cohortId: uuid("cohort_id").references(() => researchCohorts.id),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    studyDesign: varchar("study_design", { length: 50 }).notNull(),
    intervention: text("intervention"),
    controlGroup: text("control_group"),
    outcomeMeasures: jsonb("outcome_measures"),
    status: varchar("status", { length: 20 }).notNull().default("RECRUITING"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("research_studies_project_idx").on(table.projectId),
  ]
);

export const researchParticipants = pgTable(
  "research_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => researchStudies.id, { onDelete: "cascade" }),
    cohortId: uuid("cohort_id").references(() => researchCohorts.id),
    anonymousId: varchar("anonymous_id", { length: 100 }).notNull().unique(),
    groupAssignment: varchar("group_assignment", { length: 50 }),
    enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    status: varchar("status", { length: 20 }).notNull().default("ENROLLED"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("research_participants_study_idx").on(table.studyId),
  ]
);

export const researchPrePostTests = pgTable(
  "research_pre_post_tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => researchParticipants.id, { onDelete: "cascade" }),
    studyId: uuid("study_id")
      .notNull()
      .references(() => researchStudies.id),
    testType: varchar("test_type", { length: 20 }).notNull(),
    testDate: timestamp("test_date").notNull(),
    score: integer("score"),
    maxScore: integer("max_score"),
    percentage: integer("percentage"),
    testInstrument: varchar("test_instrument", { length: 255 }),
    administeredBy: uuid("administered_by").references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("research_prepost_participant_idx").on(table.participantId),
    index("research_prepost_study_idx").on(table.studyId),
  ]
);

export const researchDataExports = pgTable(
  "research_data_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => researchProjects.id),
    exportedBy: uuid("exported_by")
      .notNull()
      .references(() => users.id),
    exportType: varchar("export_type", { length: 50 }).notNull(),
    isAnonymized: boolean("is_anonymized").notNull().default(true),
    recordCount: integer("record_count").notNull().default(0),
    filePath: varchar("file_path", { length: 500 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("research_exports_project_idx").on(table.projectId),
  ]
);

// ─── Phase 22: Announcements & Notifications ──────────────────────────────

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Nullable: NULL = institution-wide announcement, otherwise course-scoped.
    courseId: uuid("course_id").references(() => courses.id),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    priority: varchar("priority", { length: 20 }).notNull().default("NORMAL"),
    // Workflow: DRAFT -> PUBLISHED -> ARCHIVED (PUBLISHED <-> DRAFT via unpublish).
    status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
    audienceStudents: boolean("audience_students").notNull().default(true),
    audienceInstructors: boolean("audience_instructors").notNull().default(false),
    publishAt: timestamp("publish_at"),
    expiresAt: timestamp("expires_at"),
    // Legacy mirror of status, kept for backward compatibility.
    isPublished: boolean("is_published").notNull().default(true),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("announcements_course_idx").on(table.courseId),
    index("announcements_status_idx").on(table.status),
  ]
);

export const announcementAttachments = pgTable(
  "announcement_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    // Public URL path, e.g. /storage/documents/<uuid>.pdf
    filePath: varchar("file_path", { length: 500 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }),
    sizeBytes: integer("size_bytes").notNull().default(0),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("announcement_attachments_ann_idx").on(table.announcementId),
  ]
);

export const announcementReads = pgTable(
  "announcement_reads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("announcement_reads_ann_user_unique").on(
      table.announcementId,
      table.userId
    ),
    index("announcement_reads_ann_idx").on(table.announcementId),
    index("announcement_reads_user_idx").on(table.userId),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content"),
    isRead: boolean("is_read").notNull().default(false),
    relatedId: uuid("related_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId),
  ]
);

// Key-value settings sections (organization / reports / certificates ...).
// Each row stores one section's JSON document so printable-document
// configuration can grow without new migrations.
export const moduleSettings = pgTable("module_settings", {
  key: varchar("key", { length: 50 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
