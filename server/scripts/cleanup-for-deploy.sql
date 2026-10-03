-- ============================================================
-- NurseLearn PH — Pre-deploy database cleanup
-- ============================================================
-- Run:  psql -d nurselearn_ph -U postgres -f server/scripts/cleanup-for-deploy.sql
--
-- What this does:
--   1. Removes ALL test/residue data (10K audit rows, 4K sessions,
--      176 AI chats, test announcements, test submissions, etc.)
--   2. Removes excess "BSP Updated" programs created during testing
--   3. Removes manual test accounts (testuser, newstudent, student1)
--   4. Clears course instructor assignments, student enrollments,
--      section placements and certificates
--   5. Cleans orphaned storage files
--   6. Preserves: seed users, academic structure, NLE question bank,
--      30 demo research projects, achievements, permissions
--
-- ⚠️  Review before running! Export anything you want to keep first.
-- ============================================================

-- ── 1. Pure-test tables: TRUNCATE (fast, resets sequences) ────
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE refresh_tokens CASCADE;
TRUNCATE TABLE email_verification_tokens CASCADE;
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE announcement_reads CASCADE;
TRUNCATE TABLE activity_logs CASCADE;
TRUNCATE TABLE student_lesson_progress CASCADE;

-- ── 2. AI tutor test conversations ───────────────────────────
-- (all from student1/student during testing — 176 conversations)
DELETE FROM ai_messages;
DELETE FROM ai_hints;
DELETE FROM ai_socratic_questions;
DELETE FROM ai_context_cache;
DELETE FROM ai_conversations;

-- ── 3. AI-generated content (test generations) ───────────────
DELETE FROM ai_content_approval_history;
DELETE FROM ai_generated_questions;
DELETE FROM ai_generated_cases;
DELETE FROM ai_generated_study_guides;

-- ── 4. NLE test attempts (preserve question bank!) ──────────
DELETE FROM nle_attempt_answers;
DELETE FROM nle_exam_attempts;
DELETE FROM nle_performance_analytics;

-- ── 5. Assessment test attempts ──────────────────────────────
DELETE FROM attempt_answers;
DELETE FROM assessment_attempts;

-- ── 6. Clinical case test attempts ───────────────────────────
DELETE FROM case_responses;
DELETE FROM case_attempts;

-- ── 7. Care plans (all test-created — 41 rows) ──────────────
DELETE FROM care_plan_diagnoses;
DELETE FROM care_plan_interventions;
DELETE FROM care_plan_outcomes;
DELETE FROM care_plans;

-- ── 8. Simulation test sessions ──────────────────────────────
DELETE FROM simulation_debriefings;
DELETE FROM simulation_actions;
DELETE FROM patient_state_transitions;
DELETE FROM simulation_sessions;

-- ── 9. Portfolio / reflections (all from student during tests)
DELETE FROM portfolio_feedback;
DELETE FROM portfolio_items;
DELETE FROM reflections;
DELETE FROM portfolios;

-- ── 10. Test announcements + attachments ─────────────────────
-- (4 test announcements: "Test Read", "Test announcement", etc.)
DELETE FROM announcement_attachments;
DELETE FROM announcements;

-- ── 11. Test analytics / snapshots ───────────────────────────
DELETE FROM course_analytics;
DELETE FROM student_analytics;
DELETE FROM performance_snapshots;

-- ── 12. Learning paths (test-created) ────────────────────────
DELETE FROM learning_path_items;
DELETE FROM learning_paths;

-- ── 13. Remediation (test-created) ───────────────────────────
DELETE FROM remediation_items;
DELETE FROM remediation_plans;

-- ── 14. Instructor evaluations (test-created) ────────────────
DELETE FROM instructor_evaluations;

-- ── 15. Student competencies (test-created) ──────────────────
DELETE FROM student_competencies;

-- ── 16. Research test data (preserve research_projects!) ─────
DELETE FROM research_studies;
DELETE FROM research_data_exports;
DELETE FROM research_pre_post_tests;
DELETE FROM research_participants;
DELETE FROM research_cohorts;

-- ── 17. Patient assignments (test-created) ───────────────────
DELETE FROM patient_assignments;

-- ── 18. Skill assessment items (test-created) ────────────────
DELETE FROM skill_assessment_items;
DELETE FROM skill_assessments;

-- ── 19. Attendance (test-created) ────────────────────────────
DELETE FROM attendance_records;

-- ── 20. Student skills (test-created, preserve skill stations/skills)
DELETE FROM student_skills;

-- ── 21. Excess programs (65 "BSP Updated" from AcademicSetupPage testing)
DELETE FROM programs WHERE name = 'BSP Updated';

-- ── 22. Manual test accounts (testuser, newstudent, student1) ──
-- Clear their references first (enrollment/section FKs are NO ACTION;
-- notifications, audit_logs, refresh_tokens are already handled above)
DELETE FROM course_enrollments e USING users u
WHERE e.student_id = u.id AND u.username IN ('testuser', 'newstudent', 'student1');
DELETE FROM student_sections ss USING users u
WHERE ss.student_id = u.id AND u.username IN ('testuser', 'newstudent', 'student1');
DELETE FROM competency_assessments ca USING users u
WHERE ca.student_id = u.id AND u.username IN ('testuser', 'newstudent', 'student1');
DELETE FROM users WHERE username IN ('testuser', 'newstudent', 'student1');

-- ── 23. Orphan storage files ─────────────────────────────────
-- (docx attachments from deleted announcements)
-- Handled separately via shell: delete storage/documents/*.docx
-- and the stray storage/storage/ directory

-- ── 24. Test simulation patients/scenarios (crashed-run leftovers) ──
-- (section 8 already removed sessions/actions, so responses are deletable)
DELETE FROM patient_responses;
DELETE FROM patient_scenarios WHERE title LIKE 'Test Scenario%';
DELETE FROM virtual_patients WHERE name LIKE 'Test Patient%';

-- ── 25. Student-section placements (all) ──────────────────────
-- Fresh installs assign students to no section; the API soft-deletes
-- (is_active = false), so every run piles up dead rows either way.
DELETE FROM student_sections;

-- ── 26. Clinical logs (test-created entries) ───────────────────
DELETE FROM clinical_experience_logs;
DELETE FROM clinical_logs;

-- ── 27. Test rotation cluster + certificates ──────────────────
DELETE FROM rotation_students rs
USING clinical_rotations r
WHERE rs.rotation_id = r.id AND r.title ILIKE '%test%';
DELETE FROM clinical_rotations WHERE title ILIKE '%test%';
-- Fresh installs issue no certificates (no completed coursework yet)
DELETE FROM certificates;

-- ── 28. Competency assessments (test-created) ──────────────────
DELETE FROM competency_assessments;

-- ── 29. Course instructor assignments + student enrollments ───────────
-- Fresh installs start with no assigned instructors, no enrollments,
-- no section placements and no certificates; coordinators set these up
-- after deploy.
UPDATE courses SET instructor_id = NULL WHERE instructor_id IS NOT NULL;
DELETE FROM course_enrollments;

-- ── 30. VACUUM to reclaim space ──────────────────────────────
VACUUM ANALYZE;

-- ── Summary ──────────────────────────────────────────────────
SELECT 'audit_logs' AS tbl, count(*) AS remaining FROM audit_logs
UNION ALL SELECT 'refresh_tokens', count(*) FROM refresh_tokens
UNION ALL SELECT 'email_verification_tokens', count(*) FROM email_verification_tokens
UNION ALL SELECT 'notifications', count(*) FROM notifications
UNION ALL SELECT 'announcement_reads', count(*) FROM announcement_reads
UNION ALL SELECT 'ai_conversations', count(*) FROM ai_conversations
UNION ALL SELECT 'ai_messages', count(*) FROM ai_messages
UNION ALL SELECT 'announcements', count(*) FROM announcements
UNION ALL SELECT 'nle_exam_attempts', count(*) FROM nle_exam_attempts
UNION ALL SELECT 'assessment_attempts', count(*) FROM assessment_attempts
UNION ALL SELECT 'case_attempts', count(*) FROM case_attempts
UNION ALL SELECT 'care_plans', count(*) FROM care_plans
UNION ALL SELECT 'portfolios', count(*) FROM portfolios
UNION ALL SELECT 'simulation_sessions', count(*) FROM simulation_sessions
UNION ALL SELECT 'clinical_logs', count(*) FROM clinical_logs
UNION ALL SELECT 'clinical_experience_logs', count(*) FROM clinical_experience_logs
UNION ALL SELECT 'clinical_rotations', count(*) FROM clinical_rotations
UNION ALL SELECT 'rotation_students', count(*) FROM rotation_students
UNION ALL SELECT 'student_sections', count(*) FROM student_sections
UNION ALL SELECT 'certificates', count(*) FROM certificates
UNION ALL SELECT 'learning_paths', count(*) FROM learning_paths
UNION ALL SELECT 'programs', count(*) FROM programs
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'nle_question_bank', count(*) FROM nle_question_bank
UNION ALL SELECT 'research_projects', count(*) FROM research_projects
UNION ALL SELECT 'courses', count(*) FROM courses
UNION ALL SELECT 'courses_with_instructor', count(*) FROM courses WHERE instructor_id IS NOT NULL
UNION ALL SELECT 'course_enrollments', count(*) FROM course_enrollments
UNION ALL SELECT 'topics', count(*) FROM topics
ORDER BY tbl;
