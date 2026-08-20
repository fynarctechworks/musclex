-- Per-set targets on routine exercises (2026-08-20).
--
-- WHY: a routine exercise can prescribe only ONE rep count for every set
-- (target_sets x target_reps), so a pyramid — 12, 10, 8 — cannot be written
-- down. Ramping sets, back-off sets and warmup-then-working sets are ordinary
-- programming, and today a member has to either flatten them to a single
-- number or keep the real plan in their head.
--
-- The LOGGING side already varies per set: workout_set_logs stores reps and
-- weight against a set_number. It is only the PRESCRIPTION that was uniform,
-- which is why this is three nullable columns and not a redesign.
--
--   target_reps_per_set     [12, 10, 8]
--   target_seconds_per_set  [45, 30, 30]   for interval exercises
--   target_weight_per_set   [60.00, 70.00, 80.00]  canonical KG, as elsewhere
--
-- NULL means "no per-set plan", which is exactly today's behaviour: fall back
-- to target_sets x target_reps. Every existing routine therefore keeps working
-- untouched, and no row is rewritten or backfilled. When an array IS present it
-- is authoritative and its LENGTH is the set count, so target_sets cannot drift
-- out of agreement with it.
--
-- Weight is numeric(6,2) to match workout_set_logs.weight exactly — storing a
-- target in a different type from the value it is compared against is how
-- rounding disagreements start.
--
-- Explore and share links need no migration: public.explore_workouts.exercises
-- and public.shared_routines.exercises are both jsonb and carry these keys as
-- they are.
--
-- Idempotent and additive. Applied to studio_template AND every live studio_%.

DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT nspname FROM pg_namespace
    WHERE nspname = 'studio_template' OR nspname LIKE 'studio\_%'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.member_routine_exercises ADD COLUMN IF NOT EXISTS target_reps_per_set integer[]', s);
    EXECUTE format(
      'ALTER TABLE %I.member_routine_exercises ADD COLUMN IF NOT EXISTS target_seconds_per_set integer[]', s);
    EXECUTE format(
      'ALTER TABLE %I.member_routine_exercises ADD COLUMN IF NOT EXISTS target_weight_per_set numeric(6,2)[]', s);

    -- A sanity bound, not a business rule: it stops a malformed client writing
    -- a thousand-element array, while leaving any realistic set count alone.
    --
    -- Named WITHOUT a schema prefix on purpose. A studio_<uuid> prefix pushes
    -- the identifier past Postgres's 63-char limit, where it is silently
    -- truncated — the guard below then never matches its own constraint and a
    -- re-run fails trying to add one that already exists.
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = s AND t.relname = 'member_routine_exercises'
        AND c.conname = 'routine_ex_per_set_len_chk'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.member_routine_exercises ADD CONSTRAINT routine_ex_per_set_len_chk CHECK ('
        || '(target_reps_per_set    IS NULL OR array_length(target_reps_per_set, 1)    BETWEEN 1 AND 20) AND '
        || '(target_seconds_per_set IS NULL OR array_length(target_seconds_per_set, 1) BETWEEN 1 AND 20) AND '
        || '(target_weight_per_set  IS NULL OR array_length(target_weight_per_set, 1)  BETWEEN 1 AND 20))', s);
    END IF;

    RAISE NOTICE 'per-set targets ready on %', s;
  END LOOP;
END $$;
