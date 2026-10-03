-- Rotation completion workflow: track when a rotation was marked COMPLETED.
-- Used by the completion verification summary and printable certificates.
ALTER TABLE clinical_rotations ADD COLUMN IF NOT EXISTS completed_at timestamp;
