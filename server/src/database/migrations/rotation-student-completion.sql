-- Per-student rotation completion: instructors can select which students
-- have completed the rotation; certificates gate on the individual mark.
ALTER TABLE rotation_students ADD COLUMN IF NOT EXISTS completed_at timestamp;

-- Backfill: rotations completed before per-student selection existed followed
-- v1 semantics (every assigned student was certificate-eligible), so mark all
-- assigned students of already-completed rotations with the rotation's completion time.
UPDATE rotation_students AS rs
SET completed_at = cr.completed_at
FROM clinical_rotations AS cr
WHERE rs.rotation_id = cr.id
  AND cr.completed_at IS NOT NULL
  AND rs.completed_at IS NULL;
