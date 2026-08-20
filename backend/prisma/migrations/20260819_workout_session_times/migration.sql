-- Workout session start/end times (2026-08-19).
--
-- WHY: a workout_log records WHEN it was written (`logged_at`) but not the span
-- it covers. That blocks two things:
--   1. retro-logging — a member who trained this morning and logs at night has
--      no way to say so, and the session lands on the wrong part of their week.
--   2. any duration statistic — total time trained, average session length —
--      because a single timestamp cannot express a span.
--
-- `logged_at` keeps its meaning (write time) and is untouched. The new columns
-- are nullable with no backfill, so every existing log stays exactly as it is
-- and readers that never ask for them see no change.
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
      'ALTER TABLE %I.workout_logs ADD COLUMN IF NOT EXISTS started_at timestamptz', s);
    EXECUTE format(
      'ALTER TABLE %I.workout_logs ADD COLUMN IF NOT EXISTS ended_at timestamptz', s);

    -- A session cannot end before it starts. Named short deliberately: a
    -- studio_<uuid> prefix would exceed Postgres's 63-char identifier limit and
    -- be silently truncated, which breaks the guard below on a re-run.
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = s AND t.relname = 'workout_logs'
        AND c.conname = 'workout_logs_span_chk'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.workout_logs ADD CONSTRAINT workout_logs_span_chk CHECK (started_at IS NULL OR ended_at IS NULL OR ended_at >= started_at)', s);
    END IF;

    RAISE NOTICE 'session times ready on %', s;
  END LOOP;
END $$;
