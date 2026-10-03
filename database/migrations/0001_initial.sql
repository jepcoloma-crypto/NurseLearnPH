CREATE TYPE "public"."activity_type" AS ENUM('READING', 'VIDEO_WATCH', 'QUIZ', 'REFLECTION', 'CASE_STUDY', 'DISCUSSION', 'PRACTICE', 'ASSIGNMENT');--> statement-breakpoint
CREATE TYPE "public"."assessment_type" AS ENUM('QUIZ', 'EXAM', 'ASSIGNMENT');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('IN_PROGRESS', 'SUBMITTED', 'GRADED');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');--> statement-breakpoint
CREATE TYPE "public"."care_plan_status" AS ENUM('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."case_attempt_status" AS ENUM('IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."case_difficulty" AS ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED');--> statement-breakpoint
CREATE TYPE "public"."competency_level" AS ENUM('BEGINNER', 'DEVELOPING', 'COMPETENT', 'PROFICIENT', 'EXPERT');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('EASY', 'MEDIUM', 'HARD');--> statement-breakpoint
CREATE TYPE "public"."evaluation_type" AS ENUM('FORMATIVE', 'SUMMATIVE', 'MIDTERM', 'FINAL');--> statement-breakpoint
CREATE TYPE "public"."intervention_category" AS ENUM('ASSESSMENT', 'THERAPEUTIC', 'TEACHING', 'COORDINATION', 'PATIENT_CONTROL');--> statement-breakpoint
CREATE TYPE "public"."material_type" AS ENUM('TEXT', 'VIDEO', 'DOCUMENT', 'LINK', 'IMAGE');--> statement-breakpoint
CREATE TYPE "public"."progress_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('MC', 'TF', 'ESSAY', 'FILL_BLANK', 'SCENARIO');--> statement-breakpoint
CREATE TYPE "public"."rotation_status" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."skill_assessment_status" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100) NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"earned_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"resource" varchar(100) NOT NULL,
	"resource_id" varchar(255),
	"metadata" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_content_approval_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" varchar(50) NOT NULL,
	"content_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"reviewer_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_context_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_id" uuid,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"embedding" jsonb,
	"tags" jsonb,
	"last_accessed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"course_id" uuid,
	"lesson_id" uuid,
	"title" varchar(255),
	"mode" varchar(50) DEFAULT 'STANDARD' NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"context_used" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_generated_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"patient_profile" jsonb,
	"clinical_presentation" text,
	"stages" jsonb,
	"learning_objectives" jsonb,
	"difficulty" varchar(20) DEFAULT 'MEDIUM' NOT NULL,
	"generated_by" uuid,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_generated_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid,
	"topic" varchar(255) NOT NULL,
	"question_text" text NOT NULL,
	"question_type" varchar(20) DEFAULT 'MC' NOT NULL,
	"options" jsonb,
	"correct_answer" text,
	"explanation" text,
	"difficulty" varchar(20) DEFAULT 'MEDIUM' NOT NULL,
	"generated_by" uuid,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_generated_study_guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid,
	"lesson_id" uuid,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"summary" text,
	"key_points" jsonb,
	"practice_questions" jsonb,
	"generated_by" uuid,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_hints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" varchar(255) NOT NULL,
	"subtopic" varchar(255),
	"hint_level" integer DEFAULT 1 NOT NULL,
	"hint_content" text NOT NULL,
	"related_lesson_id" uuid,
	"tags" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"message_type" varchar(50) DEFAULT 'TEXT' NOT NULL,
	"context_sources" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_socratic_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" varchar(255) NOT NULL,
	"question" text NOT NULL,
	"follow_up_questions" jsonb,
	"expected_reasoning" text,
	"difficulty" varchar(20) DEFAULT 'MEDIUM' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "attempt_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp,
	"graded_at" timestamp,
	"score" integer,
	"time_spent_seconds" integer DEFAULT 0 NOT NULL,
	"graded_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" "assessment_type" DEFAULT 'QUIZ' NOT NULL,
	"time_limit_minutes" integer,
	"passing_score" integer DEFAULT 75 NOT NULL,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempt_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_id" uuid,
	"text_answer" text,
	"is_correct" boolean,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rotation_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"status" "attendance_status" DEFAULT 'PRESENT' NOT NULL,
	"hours_logged" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"marked_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_plan_diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_plan_id" uuid NOT NULL,
	"diagnosis_id" uuid NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"evidence" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_plan_interventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_plan_diagnosis_id" uuid NOT NULL,
	"category" "intervention_category" NOT NULL,
	"description" text NOT NULL,
	"rationale" text,
	"frequency" varchar(100),
	"is_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_plan_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_plan_diagnosis_id" uuid NOT NULL,
	"description" text NOT NULL,
	"timeframe" varchar(100),
	"criteria" text,
	"is_met" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"case_id" uuid,
	"title" varchar(255) NOT NULL,
	"patient_name" varchar(100),
	"patient_age" integer,
	"patient_gender" varchar(20),
	"status" "care_plan_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "case_attempt_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"score" integer DEFAULT 0 NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"time_spent_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"rationale" text,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"selected_option_id" uuid,
	"is_correct" boolean,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"patient_data" jsonb,
	"order" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"course_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"issued_by" uuid,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"certificate_number" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_certificate_number_unique" UNIQUE("certificate_number")
);
--> statement-breakpoint
CREATE TABLE "clinical_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"patient_name" varchar(100),
	"patient_age" integer,
	"patient_gender" varchar(20),
	"chief_complaint" text,
	"difficulty" "case_difficulty" DEFAULT 'BEGINNER' NOT NULL,
	"tags" jsonb,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_experience_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"clinical_rotation_id" uuid,
	"patient_count" integer DEFAULT 0 NOT NULL,
	"procedures_performed" jsonb,
	"skills_applied" jsonb,
	"challenges" text,
	"learnings" text,
	"supervisor_notes" text,
	"rating" integer,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rotation_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"patient_count" integer DEFAULT 0 NOT NULL,
	"procedures" jsonb,
	"reflections" text,
	"challenges" text,
	"learning_outcomes" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_rotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"department" varchar(100),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"required_hours" integer DEFAULT 120 NOT NULL,
	"status" "rotation_status" DEFAULT 'SCHEDULED' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"target_level" "competency_level" DEFAULT 'COMPETENT' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competency_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"competency_id" uuid NOT NULL,
	"assessed_by" uuid NOT NULL,
	"level_achieved" "competency_level" NOT NULL,
	"score" integer,
	"evidence" jsonb,
	"comments" text,
	"assessed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competency_frameworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"version" varchar(50),
	"program_id" uuid,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competency_indicators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competency_id" uuid NOT NULL,
	"description" text NOT NULL,
	"measurement_method" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"total_students" integer DEFAULT 0 NOT NULL,
	"active_students" integer DEFAULT 0 NOT NULL,
	"average_progress" integer DEFAULT 0 NOT NULL,
	"average_score" integer DEFAULT 0,
	"completion_rate" integer DEFAULT 0 NOT NULL,
	"total_assessments" integer DEFAULT 0 NOT NULL,
	"total_lessons" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instructor_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rotation_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	"type" "evaluation_type" DEFAULT 'FORMATIVE' NOT NULL,
	"clinical_performance" integer,
	"professional_behavior" integer,
	"communication_skills" integer,
	"critical-thinking" integer,
	"overall_score" integer,
	"strengths" text,
	"areas_for_improvement" text,
	"comments" text,
	"evaluated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" "activity_type" NOT NULL,
	"description" text,
	"instructions" text,
	"config" jsonb,
	"points" integer DEFAULT 0 NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" "material_type" NOT NULL,
	"content" text,
	"url" varchar(1000),
	"file_path" varchar(500),
	"order" integer DEFAULT 0 NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_path_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path_id" uuid NOT NULL,
	"item_type" varchar(50) NOT NULL,
	"item_id" uuid,
	"order" integer DEFAULT 0 NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"is_adaptive" boolean DEFAULT false NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"completed_items" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nle_attempt_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_id" uuid,
	"is_correct" boolean,
	"time_spent_seconds" integer,
	"answered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nle_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"code" varchar(50) NOT NULL,
	"parent_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nle_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "nle_exam_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"score" integer,
	"total_questions" integer NOT NULL,
	"correct_answers" integer DEFAULT 0,
	"time_spent_seconds" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"status" varchar(20) DEFAULT 'IN_PROGRESS' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nle_exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"exam_type" varchar(50) DEFAULT 'PRACTICE' NOT NULL,
	"category_filter" jsonb,
	"question_count" integer DEFAULT 50 NOT NULL,
	"time_limit_minutes" integer DEFAULT 90 NOT NULL,
	"passing_score" integer DEFAULT 75 NOT NULL,
	"is_randomized" boolean DEFAULT true NOT NULL,
	"show_explanations" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nle_performance_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"correct_answers" integer DEFAULT 0 NOT NULL,
	"average_score" integer DEFAULT 0,
	"best_score" integer DEFAULT 0,
	"last_attempt_at" timestamp,
	"strength_level" varchar(20),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nle_question_bank" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"question_type" varchar(20) DEFAULT 'MC' NOT NULL,
	"difficulty" varchar(20) DEFAULT 'MEDIUM' NOT NULL,
	"explanation" text,
	"is_high_yield" boolean DEFAULT false NOT NULL,
	"tags" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nle_question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"option_text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nursing_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100) NOT NULL,
	"points" integer DEFAULT 10 NOT NULL,
	"is_applicable_to" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nursing_diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(100),
	"definition" text,
	"risk_factors" jsonb,
	"related_factors" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nursing_diagnoses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "patient_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rotation_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"patient_name" varchar(100) NOT NULL,
	"patient_age" integer,
	"patient_gender" varchar(20),
	"diagnosis" text,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"released_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"response_text" text NOT NULL,
	"vital_signs_change" jsonb,
	"symptom_change" jsonb,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"difficulty" varchar(20) DEFAULT 'MEDIUM' NOT NULL,
	"category" varchar(100) NOT NULL,
	"initial_vital_signs" jsonb NOT NULL,
	"initial_symptoms" jsonb NOT NULL,
	"initial_consciousness" varchar(50) DEFAULT 'ALERT' NOT NULL,
	"learning_objectives" jsonb,
	"time_limit_minutes" integer DEFAULT 30 NOT NULL,
	"max_score" integer DEFAULT 100 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_state_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"trigger_action" varchar(100) NOT NULL,
	"new_vital_signs" jsonb,
	"new_symptoms" jsonb,
	"new_consciousness" varchar(50),
	"deterioration_level" integer DEFAULT 0 NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"overall_score" integer,
	"assessment_score" integer,
	"competency_score" integer,
	"clinical_score" integer,
	"engagement_score" integer,
	"risk_level" varchar(20),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_item_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"rating" integer,
	"comments" text NOT NULL,
	"strengths" text,
	"improvements" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"item_type" varchar(50) NOT NULL,
	"content" jsonb,
	"order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prerequisite_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"prerequisite_course_id" uuid NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"minimum_grade" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"topic_id" uuid,
	"type" "question_type" NOT NULL,
	"difficulty" "difficulty" DEFAULT 'MEDIUM' NOT NULL,
	"stem" text NOT NULL,
	"explanation" text,
	"points" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reflections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"course_id" uuid,
	"clinical_rotation_id" uuid,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"reflection_type" varchar(50) DEFAULT 'CLINICAL' NOT NULL,
	"mood" varchar(50),
	"tags" jsonb,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remediation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"item_type" varchar(50) NOT NULL,
	"item_id" uuid,
	"order" integer DEFAULT 0 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remediation_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"reason" text,
	"target_competency" varchar(255),
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"created_by" uuid,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_cohorts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"cohort_type" varchar(50) NOT NULL,
	"target_size" integer,
	"current_size" integer DEFAULT 0 NOT NULL,
	"inclusion_criteria" jsonb,
	"exclusion_criteria" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_data_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"exported_by" uuid NOT NULL,
	"export_type" varchar(50) NOT NULL,
	"is_anonymized" boolean DEFAULT true NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"file_path" varchar(500),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"cohort_id" uuid,
	"anonymous_id" varchar(100) NOT NULL,
	"group_assignment" varchar(50),
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"status" varchar(20) DEFAULT 'ENROLLED' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "research_participants_anonymous_id_unique" UNIQUE("anonymous_id")
);
--> statement-breakpoint
CREATE TABLE "research_pre_post_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"study_id" uuid NOT NULL,
	"test_type" varchar(20) NOT NULL,
	"test_date" timestamp NOT NULL,
	"score" integer,
	"max_score" integer,
	"percentage" integer,
	"test_instrument" varchar(255),
	"administered_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"research_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'PLANNING' NOT NULL,
	"principal_investigator" uuid,
	"start_date" timestamp,
	"end_date" timestamp,
	"irb_approval_date" timestamp,
	"irb_number" varchar(100),
	"funding_source" varchar(255),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_studies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"cohort_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"study_design" varchar(50) NOT NULL,
	"intervention" text,
	"control_group" text,
	"outcome_measures" jsonb,
	"status" varchar(20) DEFAULT 'RECRUITING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"response_id" uuid,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"performed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_debriefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"instructor_id" uuid,
	"overall_rating" integer,
	"strengths" text,
	"improvements" text,
	"clinical_reasoning_score" integer,
	"technical_skills_score" integer,
	"communication_score" integer,
	"time_management_score" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"current_vital_signs" jsonb,
	"current_symptoms" jsonb,
	"current_consciousness" varchar(50) DEFAULT 'ALERT' NOT NULL,
	"deterioration_level" integer DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"time_spent_seconds" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'IN_PROGRESS' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_assessment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"checklist_id" uuid NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"notes" text,
	"points_awarded" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"station_id" uuid,
	"student_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	"status" "skill_assessment_status" DEFAULT 'SCHEDULED' NOT NULL,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"score" integer,
	"max_score" integer DEFAULT 100 NOT NULL,
	"is_competent" boolean,
	"feedback" text,
	"time_spent_seconds" integer DEFAULT 0,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"description" text NOT NULL,
	"is_critical" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"location" varchar(255),
	"capacity" integer DEFAULT 1 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"difficulty" varchar(20) DEFAULT 'BEGINNER' NOT NULL,
	"estimated_minutes" integer DEFAULT 30,
	"equipment" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"lessons_completed" integer DEFAULT 0 NOT NULL,
	"lessons_total" integer DEFAULT 0 NOT NULL,
	"assessments_taken" integer DEFAULT 0 NOT NULL,
	"average_score" integer DEFAULT 0,
	"competencies_achieved" integer DEFAULT 0 NOT NULL,
	"competencies_total" integer DEFAULT 0 NOT NULL,
	"clinical_hours_logged" integer DEFAULT 0 NOT NULL,
	"clinical_hours_required" integer DEFAULT 120 NOT NULL,
	"skills_completed" integer DEFAULT 0 NOT NULL,
	"skills_total" integer DEFAULT 0 NOT NULL,
	"overall_progress" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_competencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"competency_id" uuid NOT NULL,
	"current_level" "competency_level" DEFAULT 'BEGINNER' NOT NULL,
	"is_achieved" boolean DEFAULT false NOT NULL,
	"achieved_at" timestamp,
	"evidence" jsonb,
	"assessed_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"status" "progress_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"time_spent_seconds" integer DEFAULT 0 NOT NULL,
	"score" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"is_competent" boolean DEFAULT false NOT NULL,
	"best_score" integer DEFAULT 0,
	"attempts_count" integer DEFAULT 0 NOT NULL,
	"last_assessed_at" timestamp,
	"signed_off_by" uuid,
	"signed_off_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "virtual_patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"age" integer NOT NULL,
	"gender" varchar(20) NOT NULL,
	"medical_history" jsonb,
	"allergies" jsonb,
	"current_medications" jsonb,
	"chief_complaint" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_content_approval_history" ADD CONSTRAINT "ai_content_approval_history_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generated_cases" ADD CONSTRAINT "ai_generated_cases_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generated_cases" ADD CONSTRAINT "ai_generated_cases_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generated_cases" ADD CONSTRAINT "ai_generated_cases_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generated_questions" ADD CONSTRAINT "ai_generated_questions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generated_questions" ADD CONSTRAINT "ai_generated_questions_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generated_questions" ADD CONSTRAINT "ai_generated_questions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generated_study_guides" ADD CONSTRAINT "ai_generated_study_guides_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generated_study_guides" ADD CONSTRAINT "ai_generated_study_guides_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generated_study_guides" ADD CONSTRAINT "ai_generated_study_guides_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_assessment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."assessment_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_selected_option_id_question_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."question_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_rotation_id_clinical_rotations_id_fk" FOREIGN KEY ("rotation_id") REFERENCES "public"."clinical_rotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_plan_diagnoses" ADD CONSTRAINT "care_plan_diagnoses_care_plan_id_care_plans_id_fk" FOREIGN KEY ("care_plan_id") REFERENCES "public"."care_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_plan_diagnoses" ADD CONSTRAINT "care_plan_diagnoses_diagnosis_id_nursing_diagnoses_id_fk" FOREIGN KEY ("diagnosis_id") REFERENCES "public"."nursing_diagnoses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_plan_interventions" ADD CONSTRAINT "care_plan_interventions_care_plan_diagnosis_id_care_plan_diagnoses_id_fk" FOREIGN KEY ("care_plan_diagnosis_id") REFERENCES "public"."care_plan_diagnoses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_plan_outcomes" ADD CONSTRAINT "care_plan_outcomes_care_plan_diagnosis_id_care_plan_diagnoses_id_fk" FOREIGN KEY ("care_plan_diagnosis_id") REFERENCES "public"."care_plan_diagnoses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_case_id_clinical_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."clinical_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_attempts" ADD CONSTRAINT "case_attempts_case_id_clinical_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."clinical_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_attempts" ADD CONSTRAINT "case_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_options" ADD CONSTRAINT "case_options_stage_id_case_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."case_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_responses" ADD CONSTRAINT "case_responses_attempt_id_case_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."case_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_responses" ADD CONSTRAINT "case_responses_stage_id_case_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."case_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_responses" ADD CONSTRAINT "case_responses_selected_option_id_case_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."case_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_stages" ADD CONSTRAINT "case_stages_case_id_clinical_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."clinical_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_cases" ADD CONSTRAINT "clinical_cases_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_cases" ADD CONSTRAINT "clinical_cases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_experience_logs" ADD CONSTRAINT "clinical_experience_logs_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_experience_logs" ADD CONSTRAINT "clinical_experience_logs_clinical_rotation_id_clinical_rotations_id_fk" FOREIGN KEY ("clinical_rotation_id") REFERENCES "public"."clinical_rotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_logs" ADD CONSTRAINT "clinical_logs_rotation_id_clinical_rotations_id_fk" FOREIGN KEY ("rotation_id") REFERENCES "public"."clinical_rotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_logs" ADD CONSTRAINT "clinical_logs_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_logs" ADD CONSTRAINT "clinical_logs_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_rotations" ADD CONSTRAINT "clinical_rotations_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_rotations" ADD CONSTRAINT "clinical_rotations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_framework_id_competency_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."competency_frameworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competency_frameworks" ADD CONSTRAINT "competency_frameworks_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competency_frameworks" ADD CONSTRAINT "competency_frameworks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competency_indicators" ADD CONSTRAINT "competency_indicators_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_analytics" ADD CONSTRAINT "course_analytics_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_evaluations" ADD CONSTRAINT "instructor_evaluations_rotation_id_clinical_rotations_id_fk" FOREIGN KEY ("rotation_id") REFERENCES "public"."clinical_rotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_evaluations" ADD CONSTRAINT "instructor_evaluations_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_evaluations" ADD CONSTRAINT "instructor_evaluations_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_activities" ADD CONSTRAINT "learning_activities_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_materials" ADD CONSTRAINT "learning_materials_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_path_items" ADD CONSTRAINT "learning_path_items_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nle_attempt_answers" ADD CONSTRAINT "nle_attempt_answers_attempt_id_nle_exam_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."nle_exam_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nle_attempt_answers" ADD CONSTRAINT "nle_attempt_answers_question_id_nle_question_bank_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."nle_question_bank"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nle_attempt_answers" ADD CONSTRAINT "nle_attempt_answers_selected_option_id_nle_question_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."nle_question_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nle_exam_attempts" ADD CONSTRAINT "nle_exam_attempts_exam_id_nle_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."nle_exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nle_exam_attempts" ADD CONSTRAINT "nle_exam_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nle_exams" ADD CONSTRAINT "nle_exams_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nle_performance_analytics" ADD CONSTRAINT "nle_performance_analytics_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nle_performance_analytics" ADD CONSTRAINT "nle_performance_analytics_category_id_nle_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."nle_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nle_question_bank" ADD CONSTRAINT "nle_question_bank_category_id_nle_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."nle_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nle_question_bank" ADD CONSTRAINT "nle_question_bank_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nle_question_options" ADD CONSTRAINT "nle_question_options_question_id_nle_question_bank_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."nle_question_bank"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_assignments" ADD CONSTRAINT "patient_assignments_rotation_id_clinical_rotations_id_fk" FOREIGN KEY ("rotation_id") REFERENCES "public"."clinical_rotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_assignments" ADD CONSTRAINT "patient_assignments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_responses" ADD CONSTRAINT "patient_responses_scenario_id_patient_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."patient_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_responses" ADD CONSTRAINT "patient_responses_action_id_nursing_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."nursing_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_scenarios" ADD CONSTRAINT "patient_scenarios_patient_id_virtual_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."virtual_patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_scenarios" ADD CONSTRAINT "patient_scenarios_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_state_transitions" ADD CONSTRAINT "patient_state_transitions_scenario_id_patient_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."patient_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_snapshots" ADD CONSTRAINT "performance_snapshots_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_snapshots" ADD CONSTRAINT "performance_snapshots_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_feedback" ADD CONSTRAINT "portfolio_feedback_portfolio_item_id_portfolio_items_id_fk" FOREIGN KEY ("portfolio_item_id") REFERENCES "public"."portfolio_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_feedback" ADD CONSTRAINT "portfolio_feedback_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prerequisite_rules" ADD CONSTRAINT "prerequisite_rules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prerequisite_rules" ADD CONSTRAINT "prerequisite_rules_prerequisite_course_id_courses_id_fk" FOREIGN KEY ("prerequisite_course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_clinical_rotation_id_clinical_rotations_id_fk" FOREIGN KEY ("clinical_rotation_id") REFERENCES "public"."clinical_rotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remediation_items" ADD CONSTRAINT "remediation_items_plan_id_remediation_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."remediation_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remediation_plans" ADD CONSTRAINT "remediation_plans_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remediation_plans" ADD CONSTRAINT "remediation_plans_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remediation_plans" ADD CONSTRAINT "remediation_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_cohorts" ADD CONSTRAINT "research_cohorts_project_id_research_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."research_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_data_exports" ADD CONSTRAINT "research_data_exports_project_id_research_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."research_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_data_exports" ADD CONSTRAINT "research_data_exports_exported_by_users_id_fk" FOREIGN KEY ("exported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_participants" ADD CONSTRAINT "research_participants_study_id_research_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."research_studies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_participants" ADD CONSTRAINT "research_participants_cohort_id_research_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."research_cohorts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_pre_post_tests" ADD CONSTRAINT "research_pre_post_tests_participant_id_research_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."research_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_pre_post_tests" ADD CONSTRAINT "research_pre_post_tests_study_id_research_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."research_studies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_pre_post_tests" ADD CONSTRAINT "research_pre_post_tests_administered_by_users_id_fk" FOREIGN KEY ("administered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_projects" ADD CONSTRAINT "research_projects_principal_investigator_users_id_fk" FOREIGN KEY ("principal_investigator") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_studies" ADD CONSTRAINT "research_studies_project_id_research_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."research_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_studies" ADD CONSTRAINT "research_studies_cohort_id_research_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."research_cohorts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_actions" ADD CONSTRAINT "simulation_actions_session_id_simulation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."simulation_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_actions" ADD CONSTRAINT "simulation_actions_action_id_nursing_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."nursing_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_actions" ADD CONSTRAINT "simulation_actions_response_id_patient_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."patient_responses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_debriefings" ADD CONSTRAINT "simulation_debriefings_session_id_simulation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."simulation_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_debriefings" ADD CONSTRAINT "simulation_debriefings_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_sessions" ADD CONSTRAINT "simulation_sessions_scenario_id_patient_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."patient_scenarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_sessions" ADD CONSTRAINT "simulation_sessions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessment_items" ADD CONSTRAINT "skill_assessment_items_assessment_id_skill_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."skill_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessment_items" ADD CONSTRAINT "skill_assessment_items_checklist_id_skill_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."skill_checklists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_station_id_skill_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."skill_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_checklists" ADD CONSTRAINT "skill_checklists_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_analytics" ADD CONSTRAINT "student_analytics_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_analytics" ADD CONSTRAINT "student_analytics_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_competencies" ADD CONSTRAINT "student_competencies_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_competencies" ADD CONSTRAINT "student_competencies_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_competencies" ADD CONSTRAINT "student_competencies_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_lesson_progress" ADD CONSTRAINT "student_lesson_progress_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_lesson_progress" ADD CONSTRAINT "student_lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_signed_off_by_users_id_fk" FOREIGN KEY ("signed_off_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_patients" ADD CONSTRAINT "virtual_patients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "achievements_student_idx" ON "achievements" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "activity_logs_user_idx" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_logs_created_idx" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_approval_content_idx" ON "ai_content_approval_history" USING btree ("content_type","content_id");--> statement-breakpoint
CREATE INDEX "ai_context_source_idx" ON "ai_context_cache" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "ai_conversations_student_idx" ON "ai_conversations" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "ai_cases_course_idx" ON "ai_generated_cases" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "ai_cases_status_idx" ON "ai_generated_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_questions_course_idx" ON "ai_generated_questions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "ai_questions_status_idx" ON "ai_generated_questions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_guides_course_idx" ON "ai_generated_study_guides" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "ai_guides_status_idx" ON "ai_generated_study_guides" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_hints_topic_idx" ON "ai_hints" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "ai_messages_conversation_idx" ON "ai_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "ai_socratic_topic_idx" ON "ai_socratic_questions" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "assessment_attempts_assessment_idx" ON "assessment_attempts" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "assessment_attempts_student_idx" ON "assessment_attempts" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "assessment_questions_assessment_idx" ON "assessment_questions" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "assessments_course_idx" ON "assessments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "attempt_answers_attempt_idx" ON "attempt_answers" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "attendance_records_rotation_idx" ON "attendance_records" USING btree ("rotation_id");--> statement-breakpoint
CREATE INDEX "attendance_records_student_idx" ON "attendance_records" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "care_plan_diagnoses_plan_idx" ON "care_plan_diagnoses" USING btree ("care_plan_id");--> statement-breakpoint
CREATE INDEX "care_plan_interventions_diagnosis_idx" ON "care_plan_interventions" USING btree ("care_plan_diagnosis_id");--> statement-breakpoint
CREATE INDEX "care_plan_outcomes_diagnosis_idx" ON "care_plan_outcomes" USING btree ("care_plan_diagnosis_id");--> statement-breakpoint
CREATE INDEX "care_plans_course_idx" ON "care_plans" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "care_plans_student_idx" ON "care_plans" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "case_attempts_case_idx" ON "case_attempts" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "case_attempts_student_idx" ON "case_attempts" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "case_options_stage_idx" ON "case_options" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "case_responses_attempt_idx" ON "case_responses" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "case_stages_case_idx" ON "case_stages" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "certificates_student_idx" ON "certificates" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "certificates_course_idx" ON "certificates" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "clinical_cases_course_idx" ON "clinical_cases" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "clinical_exp_logs_student_idx" ON "clinical_experience_logs" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "clinical_exp_logs_rotation_idx" ON "clinical_experience_logs" USING btree ("clinical_rotation_id");--> statement-breakpoint
CREATE INDEX "clinical_logs_rotation_idx" ON "clinical_logs" USING btree ("rotation_id");--> statement-breakpoint
CREATE INDEX "clinical_logs_student_idx" ON "clinical_logs" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "clinical_rotations_course_idx" ON "clinical_rotations" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "competencies_framework_idx" ON "competencies" USING btree ("framework_id");--> statement-breakpoint
CREATE INDEX "competency_assessments_student_idx" ON "competency_assessments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "competency_assessments_competency_idx" ON "competency_assessments" USING btree ("competency_id");--> statement-breakpoint
CREATE INDEX "competency_indicators_competency_idx" ON "competency_indicators" USING btree ("competency_id");--> statement-breakpoint
CREATE INDEX "course_analytics_course_idx" ON "course_analytics" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "instructor_evaluations_rotation_idx" ON "instructor_evaluations" USING btree ("rotation_id");--> statement-breakpoint
CREATE INDEX "instructor_evaluations_student_idx" ON "instructor_evaluations" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "learning_path_items_path_idx" ON "learning_path_items" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "learning_paths_course_idx" ON "learning_paths" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "learning_paths_student_idx" ON "learning_paths" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "nle_answers_attempt_idx" ON "nle_attempt_answers" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "nle_attempts_exam_idx" ON "nle_exam_attempts" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "nle_attempts_student_idx" ON "nle_exam_attempts" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "nle_analytics_student_idx" ON "nle_performance_analytics" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "nle_analytics_category_idx" ON "nle_performance_analytics" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "nle_questions_category_idx" ON "nle_question_bank" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "nle_options_question_idx" ON "nle_question_options" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "patient_assignments_rotation_idx" ON "patient_assignments" USING btree ("rotation_id");--> statement-breakpoint
CREATE INDEX "patient_assignments_student_idx" ON "patient_assignments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "patient_responses_scenario_idx" ON "patient_responses" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "patient_responses_action_idx" ON "patient_responses" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "patient_scenarios_patient_idx" ON "patient_scenarios" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "state_transitions_scenario_idx" ON "patient_state_transitions" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "performance_snapshots_student_idx" ON "performance_snapshots" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "performance_snapshots_course_idx" ON "performance_snapshots" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "portfolio_feedback_item_idx" ON "portfolio_feedback" USING btree ("portfolio_item_id");--> statement-breakpoint
CREATE INDEX "portfolio_items_portfolio_idx" ON "portfolio_items" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "portfolios_student_idx" ON "portfolios" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "prerequisite_rules_course_idx" ON "prerequisite_rules" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "questions_course_idx" ON "questions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "questions_topic_idx" ON "questions" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "reflections_student_idx" ON "reflections" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "reflections_course_idx" ON "reflections" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "remediation_items_plan_idx" ON "remediation_items" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "remediation_plans_course_idx" ON "remediation_plans" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "remediation_plans_student_idx" ON "remediation_plans" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "research_cohorts_project_idx" ON "research_cohorts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "research_exports_project_idx" ON "research_data_exports" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "research_participants_study_idx" ON "research_participants" USING btree ("study_id");--> statement-breakpoint
CREATE INDEX "research_prepost_participant_idx" ON "research_pre_post_tests" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "research_prepost_study_idx" ON "research_pre_post_tests" USING btree ("study_id");--> statement-breakpoint
CREATE INDEX "research_studies_project_idx" ON "research_studies" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "simulation_actions_session_idx" ON "simulation_actions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "debriefings_session_idx" ON "simulation_debriefings" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "simulation_sessions_scenario_idx" ON "simulation_sessions" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "simulation_sessions_student_idx" ON "simulation_sessions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "skill_assessment_items_assessment_idx" ON "skill_assessment_items" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "skill_assessments_skill_idx" ON "skill_assessments" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "skill_assessments_student_idx" ON "skill_assessments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "skill_checklists_skill_idx" ON "skill_checklists" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "skills_course_idx" ON "skills" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "student_analytics_student_idx" ON "student_analytics" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_analytics_course_idx" ON "student_analytics" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "student_competencies_student_idx" ON "student_competencies" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_competencies_competency_idx" ON "student_competencies" USING btree ("competency_id");--> statement-breakpoint
CREATE INDEX "student_lesson_progress_student_idx" ON "student_lesson_progress" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_lesson_progress_lesson_idx" ON "student_lesson_progress" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "student_skills_student_idx" ON "student_skills" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_skills_skill_idx" ON "student_skills" USING btree ("skill_id");