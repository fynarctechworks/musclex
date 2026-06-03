-- ============================================================================
-- PHASE B — CROSS-TENANT PENETRATION / VERIFICATION HARNESS
-- ============================================================================
--
-- Purpose: prove tenant isolation at the DB layer. Run the SAME script twice:
--   (A) as the CURRENT app role `postgres`  → documents the leak (RLS bypassed)
--   (B) as `fitsync_app` AFTER cutover       → must INVERT to fully isolated
--
-- This is the runbook §5 gate. It is read-only except for set_config (which is
-- transaction-local here via the wrapping transactions). Safe to run anytime.
--
-- HOW TO RUN AS A SPECIFIC ROLE (in the window, connected as postgres/admin):
--   SET ROLE fitsync_app;  -- then run the probes;  RESET ROLE; when done.
--   (SET ROLE makes RLS apply as fitsync_app even on an admin connection,
--    EXCEPT it does NOT drop BYPASSRLS if the *session* role bypasses — so for
--    a true test, also connect directly as fitsync_app at least once.)
--
-- Fill in two real gym UUIDs from studio_template.members before running:
--   \set gymA '....'   \set gymB '....'
-- ============================================================================

-- ── PROBE 0: who am I, and do I bypass RLS? ─────────────────────────────────
-- EXPECT (A) postgres: rolbypassrls = true   → every probe below "fails" (leaks)
-- EXPECT (B) fitsync_app: rolbypassrls = false → probes enforce isolation
SELECT current_user AS connected_as,
       (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypasses_rls;

-- ── PROBE 1: no tenant context set ──────────────────────────────────────────
-- The fail-closed policy denies all rows when app.gym_id is unset/empty.
-- EXPECT (A): > 0 rows across multiple gyms (LEAK — bypass)
-- EXPECT (B): 0 rows
BEGIN;
  SELECT set_config('app.gym_id', '', true);
  SELECT 'members        ' AS tbl, count(*) AS visible, count(DISTINCT gym_id) AS gyms FROM studio_template.members
  UNION ALL SELECT 'workout_logs   ', count(*), count(DISTINCT gym_id) FROM studio_template.workout_logs
  UNION ALL SELECT 'meal_logs      ', count(*), count(DISTINCT gym_id) FROM studio_template.meal_logs
  UNION ALL SELECT 'trainer_chat   ', count(*), count(DISTINCT gym_id) FROM studio_template.trainer_chat_messages
  UNION ALL SELECT 'health_samples ', count(*), count(DISTINCT gym_id) FROM studio_template.member_health_samples
  UNION ALL SELECT 'member_payments', count(*), count(DISTINCT gym_id) FROM studio_template.payments;
ROLLBACK;

-- ── PROBE 2: scoped to gym A, then try to read gym B's rows ─────────────────
-- EXPECT (A): gymB rows still visible (LEAK)
-- EXPECT (B): 0 — the policy filters to gymA regardless of the WHERE clause
BEGIN;
  SELECT set_config('app.gym_id', :'gymA', true);
  SELECT 'leak_attempt_other_gym' AS probe, count(*) AS gymB_rows_visible
  FROM studio_template.members WHERE gym_id = :'gymB';
ROLLBACK;

-- ── PROBE 3: correctly scoped to gym A ──────────────────────────────────────
-- EXPECT (A): all gyms' rows (count(DISTINCT gym_id) > 1) — bypass ignores scope
-- EXPECT (B): only gymA (count(DISTINCT gym_id) = 1, all = gymA)
BEGIN;
  SELECT set_config('app.gym_id', :'gymA', true);
  SELECT 'scoped_to_gymA' AS probe, count(*) AS rows, count(DISTINCT gym_id) AS distinct_gyms
  FROM studio_template.members;
ROLLBACK;

-- ── PROBE 4: write-path (WITH CHECK) — try to INSERT a row for the WRONG gym ─
-- The policy's WITH CHECK must reject a row whose gym_id != app.gym_id.
-- EXPECT (A): INSERT succeeds (LEAK) — run inside a tx and ROLLBACK regardless.
-- EXPECT (B): ERROR  "new row violates row-level security policy"
BEGIN;
  SELECT set_config('app.gym_id', :'gymA', true);
  -- This should ERROR under fitsync_app. Under postgres it will (wrongly) be allowed.
  -- Wrapped in a savepoint so the rest of the script survives the expected error.
  SAVEPOINT s1;
  DO $$ BEGIN
    BEGIN
      EXECUTE format(
        'INSERT INTO studio_template.member_health_daily (id, gym_id, member_id, day) '
        || 'VALUES (gen_random_uuid(), %L, gen_random_uuid(), CURRENT_DATE)',
        current_setting('app.gym_id_test_wrong', true));
      RAISE NOTICE 'PROBE4: insert for wrong gym ALLOWED (expected under postgres/bypass = LEAK)';
    EXCEPTION WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PROBE4: insert for wrong gym REJECTED by RLS (expected under fitsync_app)';
    END;
  END $$;
  ROLLBACK TO SAVEPOINT s1;
ROLLBACK;

-- ── Summary of the pass criteria after cutover (role = fitsync_app) ─────────
--   PROBE 0: bypasses_rls = false
--   PROBE 1: every table visible = 0
--   PROBE 2: gymB_rows_visible = 0
--   PROBE 3: distinct_gyms = 1 (gymA only)
--   PROBE 4: insert for wrong gym REJECTED
-- If any of these still leaks, DO NOT declare Phase B done.
