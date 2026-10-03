-- Care Plan Overhaul Migration
-- Adds assessment data, medical diagnosis, scientific rationale, SMART goals, 
-- proper status workflow, and evaluation fields for Philippine BSN curriculum.

-- 1. Add goal type enum
DO $$ BEGIN
  CREATE TYPE goal_type AS ENUM ('SHORT_TERM', 'LONG_TERM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add new columns to care_plans
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS medical_diagnosis TEXT;
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS subjective_data TEXT;
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS objective_data TEXT;
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS evaluated_by UUID REFERENCES users(id);
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS evaluation_notes TEXT;

-- 3. Add new columns to care_plan_diagnoses
ALTER TABLE care_plan_diagnoses ADD COLUMN IF NOT EXISTS rationale TEXT;
ALTER TABLE care_plan_diagnoses ADD COLUMN IF NOT EXISTS goal_type goal_type DEFAULT 'SHORT_TERM';
ALTER TABLE care_plan_diagnoses ADD COLUMN IF NOT EXISTS assessment_data TEXT;

-- 4. Add new columns to care_plan_outcomes
ALTER TABLE care_plan_outcomes ADD COLUMN IF NOT EXISTS evaluation_notes TEXT;
ALTER TABLE care_plan_outcomes ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;
ALTER TABLE care_plan_outcomes ADD COLUMN IF NOT EXISTS actual_outcome TEXT;

-- 5. Add new column to care_plan_interventions
ALTER TABLE care_plan_interventions ADD COLUMN IF NOT EXISTS expected_time VARCHAR(100);
