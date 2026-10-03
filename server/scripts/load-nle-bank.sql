-- ============================================================
-- NurseLearn PH — Full NLE Question Bank loader (516 questions)
-- ============================================================
-- Loads the deterministic category IDs (a1000000-…), 516 questions
-- and 2064 answer options in dependency order.
--
-- Run BEFORE `npm run db:seed` so the seeded practice exam's
-- category_filter points at the deterministic category IDs.
--
-- Run: psql -U postgres -d nurselearn_ph -f server/scripts/load-nle-bank.sql
-- (safe from any working directory — \ir resolves relative to this file)
-- ============================================================

\ir ../src/database/migrations/nle-seed-data.sql
\ir ../src/database/migrations/nle-seed-options-1.sql
\ir ../src/database/migrations/nle-seed-options-2.sql
\ir ../src/database/migrations/nle-seed-options-3.sql
\ir ../src/database/migrations/nle-seed-questions-part2a.sql
\ir ../src/database/migrations/nle-seed-options-4.sql
\ir ../src/database/migrations/nle-seed-options-5.sql
\ir ../src/database/migrations/nle-seed-questions-part2b.sql
\ir ../src/database/migrations/nle-seed-options-6.sql
\ir ../src/database/migrations/nle-seed-options-7.sql
