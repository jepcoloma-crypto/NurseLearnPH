-- Clinical log status workflow: SUBMITTED -> REVIEWED
-- Applied with: psql -U postgres -d nurselearn_ph -v ON_ERROR_STOP=1 -f clinical-log-status.sql

CREATE TYPE clinical_log_status AS ENUM ('SUBMITTED', 'REVIEWED');

ALTER TABLE clinical_logs
  ADD COLUMN IF NOT EXISTS status clinical_log_status NOT NULL DEFAULT 'SUBMITTED';

-- Backfill: any log already reviewed becomes REVIEWED
UPDATE clinical_logs SET status = 'REVIEWED' WHERE reviewed_at IS NOT NULL;
