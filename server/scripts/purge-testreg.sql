DO $$
DECLARE
  r RECORD;
  sql TEXT;
  n BIGINT;
BEGIN
  FOR r IN
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users'
    ORDER BY tc.table_name
  LOOP
    sql := format('DELETE FROM %I WHERE %I IN (SELECT id FROM users WHERE username ILIKE ''testreg%%'' OR email ILIKE ''test-register%%'')',
                  r.table_name, r.column_name);
    BEGIN
      EXECUTE sql;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN
        RAISE NOTICE 'cleaned %.%: % rows', r.table_name, r.column_name, n;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'SKIPPED %.%: %', r.table_name, r.column_name, SQLERRM;
    END;
  END LOOP;
END $$;

DELETE FROM users WHERE username ILIKE 'testreg%' OR email ILIKE 'test-register%';

SELECT count(*) AS remaining_testreg_users FROM users WHERE username ILIKE 'testreg%' OR email ILIKE 'test-register%';
