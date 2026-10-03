CREATE TYPE "public"."clinical_log_status" AS ENUM('SUBMITTED', 'REVIEWED');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('SHORT_TERM', 'LONG_TERM');--> statement-breakpoint
ALTER TYPE "public"."care_plan_status" ADD VALUE 'SUBMITTED' BEFORE 'ACTIVE';--> statement-breakpoint
ALTER TYPE "public"."care_plan_status" ADD VALUE 'UNDER_REVIEW' BEFORE 'ACTIVE';--> statement-breakpoint
ALTER TYPE "public"."care_plan_status" ADD VALUE 'APPROVED' BEFORE 'ACTIVE';--> statement-breakpoint
ALTER TYPE "public"."care_plan_status" ADD VALUE 'RETURNED' BEFORE 'ACTIVE';--> statement-breakpoint
ALTER TYPE "public"."case_attempt_status" ADD VALUE 'ABANDONED';--> statement-breakpoint
ALTER TYPE "public"."intervention_category" ADD VALUE 'COLLABORATIVE' BEFORE 'PATIENT_CONTROL';--> statement-breakpoint
CREATE TABLE "announcement_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"mime_type" varchar(100),
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rotation_students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rotation_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcements" ALTER COLUMN "course_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ALTER COLUMN "started_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ALTER COLUMN "started_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "assessment_attempts" ALTER COLUMN "submitted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ALTER COLUMN "graded_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "assessment_attempts" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "status" varchar(20) DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "audience_students" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "audience_instructors" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "publish_at" timestamp;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "care_plan_diagnoses" ADD COLUMN "rationale" text;--> statement-breakpoint
ALTER TABLE "care_plan_diagnoses" ADD COLUMN "goal_type" "goal_type" DEFAULT 'SHORT_TERM';--> statement-breakpoint
ALTER TABLE "care_plan_diagnoses" ADD COLUMN "assessment_data" text;--> statement-breakpoint
ALTER TABLE "care_plan_interventions" ADD COLUMN "expected_time" varchar(100);--> statement-breakpoint
ALTER TABLE "care_plan_outcomes" ADD COLUMN "evaluation_notes" text;--> statement-breakpoint
ALTER TABLE "care_plan_outcomes" ADD COLUMN "evaluated_at" timestamp;--> statement-breakpoint
ALTER TABLE "care_plan_outcomes" ADD COLUMN "actual_outcome" text;--> statement-breakpoint
ALTER TABLE "care_plans" ADD COLUMN "medical_diagnosis" text;--> statement-breakpoint
ALTER TABLE "care_plans" ADD COLUMN "subjective_data" text;--> statement-breakpoint
ALTER TABLE "care_plans" ADD COLUMN "objective_data" text;--> statement-breakpoint
ALTER TABLE "care_plans" ADD COLUMN "evaluated_by" uuid;--> statement-breakpoint
ALTER TABLE "care_plans" ADD COLUMN "evaluated_at" timestamp;--> statement-breakpoint
ALTER TABLE "care_plans" ADD COLUMN "evaluation_notes" text;--> statement-breakpoint
ALTER TABLE "clinical_cases" ADD COLUMN "department" varchar(100);--> statement-breakpoint
ALTER TABLE "clinical_cases" ADD COLUMN "max_attempts" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "clinical_logs" ADD COLUMN "status" "clinical_log_status" DEFAULT 'SUBMITTED' NOT NULL;--> statement-breakpoint
ALTER TABLE "clinical_rotations" ADD COLUMN "instructor_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "clinical_rotations" ADD COLUMN "section_id" uuid;--> statement-breakpoint
ALTER TABLE "clinical_rotations" ADD COLUMN "facility" varchar(255);--> statement-breakpoint
ALTER TABLE "clinical_rotations" ADD COLUMN "max_students" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "clinical_rotations" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "nle_exam_attempts" ADD COLUMN "question_ids" jsonb;--> statement-breakpoint
ALTER TABLE "skill_assessments" ADD COLUMN "student_skill_id" uuid;--> statement-breakpoint
ALTER TABLE "student_skills" ADD COLUMN "status" varchar(30) DEFAULT 'NOT_STARTED' NOT NULL;--> statement-breakpoint
ALTER TABLE "student_skills" ADD COLUMN "checked_items" jsonb;--> statement-breakpoint
ALTER TABLE "student_skills" ADD COLUMN "last_practice_at" timestamp;--> statement-breakpoint
ALTER TABLE "student_skills" ADD COLUMN "requested_assessment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "contact_number" varchar(30);--> statement-breakpoint
ALTER TABLE "announcement_attachments" ADD CONSTRAINT "announcement_attachments_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_attachments" ADD CONSTRAINT "announcement_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_students" ADD CONSTRAINT "rotation_students_rotation_id_clinical_rotations_id_fk" FOREIGN KEY ("rotation_id") REFERENCES "public"."clinical_rotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_students" ADD CONSTRAINT "rotation_students_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_students" ADD CONSTRAINT "rotation_students_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_attachments_ann_idx" ON "announcement_attachments" USING btree ("announcement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "announcement_reads_ann_user_unique" ON "announcement_reads" USING btree ("announcement_id","user_id");--> statement-breakpoint
CREATE INDEX "announcement_reads_ann_idx" ON "announcement_reads" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "announcement_reads_user_idx" ON "announcement_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rotation_students_rotation_idx" ON "rotation_students" USING btree ("rotation_id");--> statement-breakpoint
CREATE INDEX "rotation_students_student_idx" ON "rotation_students" USING btree ("student_id");--> statement-breakpoint
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_evaluated_by_users_id_fk" FOREIGN KEY ("evaluated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_rotations" ADD CONSTRAINT "clinical_rotations_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_rotations" ADD CONSTRAINT "clinical_rotations_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_student_skill_id_student_skills_id_fk" FOREIGN KEY ("student_skill_id") REFERENCES "public"."student_skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_status_idx" ON "announcements" USING btree ("status");