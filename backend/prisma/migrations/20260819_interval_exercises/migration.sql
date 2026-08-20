-- Interval (time-tracked) exercises (2026-08-19).
--
-- WHY: a set is currently reps + weight, which cannot express a plank, a farmer's
-- carry, a row erg or any circuit work. Those are prescribed as "2 x 30s" and are
-- a large share of what gyms actually programme, so they are simply unloggable
-- today — members either skip them or fake them as 1 rep.
--
--   exercises.tracking_type    'reps' (default) | 'duration'
--   workout_set_logs.duration_seconds  NULL for rep sets, seconds for timed ones
--
-- Additive and idempotent. `tracking_type` defaults to 'reps' so every existing
-- exercise keeps behaving exactly as it does now, and `duration_seconds` is
-- nullable with no backfill so no logged set is rewritten. `reps` and `weight`
-- are left alone: a timed set stores reps 0 and weight 0, which is what they
-- already default to, so old readers see a harmless zero rather than a NULL
-- they were not written to expect.
--
-- Applied to studio_template AND every live studio_% schema.

-- Clear the truncated constraint names an earlier revision of this file left
-- behind, so the guarded blocks below can install the short stable ones.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT n.nspname AS sch, t.relname AS tbl, con.conname AS name
    FROM pg_constraint con
    JOIN pg_class t ON t.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE (con.conname LIKE 'exercises_tracking_type_chk\_%'
        OR con.conname LIKE 'set_logs_duration_chk\_%')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', c.sch, c.tbl, c.name);
  END LOOP;
END $$;

DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT nspname FROM pg_namespace
    WHERE nspname = 'studio_template' OR nspname LIKE 'studio\_%'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.exercises ADD COLUMN IF NOT EXISTS tracking_type text NOT NULL DEFAULT ''reps''', s);

    -- Reject anything outside the two known modes rather than letting a typo
    -- become a third silent behaviour.
    --
    -- The constraint name deliberately omits the schema: constraints are already
    -- scoped to their table, and including a studio_<uuid> prefix pushed the name
    -- past Postgres's 63-char identifier limit. The stored name was truncated
    -- while this guard looked for the full one, so it never matched and a re-run
    -- failed trying to add a constraint that was already there.
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = s AND t.relname = 'exercises'
        AND c.conname = 'exercises_tracking_type_chk'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.exercises ADD CONSTRAINT exercises_tracking_type_chk CHECK (tracking_type IN (''reps'', ''duration''))', s);
    END IF;

    EXECUTE format(
      'ALTER TABLE %I.workout_set_logs ADD COLUMN IF NOT EXISTS duration_seconds integer', s);

    -- A timed set is seconds, never negative and never a whole day.
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = s AND t.relname = 'workout_set_logs'
        AND c.conname = 'set_logs_duration_chk'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.workout_set_logs ADD CONSTRAINT set_logs_duration_chk CHECK (duration_seconds IS NULL OR (duration_seconds >= 0 AND duration_seconds <= 86400))', s);
    END IF;

    RAISE NOTICE 'interval tracking ready on %', s;
  END LOOP;
END $$;
