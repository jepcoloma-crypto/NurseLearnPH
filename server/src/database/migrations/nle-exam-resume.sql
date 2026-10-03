-- NLE exam resume support: persist the randomized question set on each attempt
-- so students can resume an in-progress exam after a refresh or from another device.
-- In-progress attempts previously lost their question set on reload, leaving the
-- attempt stuck (startExam refuses a second concurrent attempt).
ALTER TABLE nle_exam_attempts ADD COLUMN IF NOT EXISTS question_ids jsonb;
