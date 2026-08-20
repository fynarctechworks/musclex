-- Exercises: add `target_muscle` and `secondary_muscles` (2026-08-19).
--
-- WHY: `muscle_group` is one coarse bucket per exercise (chest | back | legs |
-- shoulders | arms | core | full_body | cardio). It cannot express which HEAD of
-- a muscle an exercise actually trains, so "Shoulders" is an undifferentiated
-- list and a member has no way to see that they are hitting front delts three
-- times and rear delts never.
--
-- `target_muscle` is the primary mover at head level (front_delt | side_delt |
-- rear_delt | lats | upper_chest | ...). `secondary_muscles` is everything else
-- the movement loads, which is what makes "you have not trained rear delts this
-- week" answerable.
--
-- Both are NULLABLE with no default and no backfill: every existing row stays
-- exactly as it is, and `muscle_group` keeps working untouched for any code
-- that has not been updated. Nothing is dropped, renamed or rewritten.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS + a guarded index), so it is safe to
-- re-run. Applied to studio_template AND every live studio_% schema.

DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT nspname FROM pg_namespace
    WHERE nspname = 'studio_template' OR nspname LIKE 'studio\_%'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.exercises ADD COLUMN IF NOT EXISTS target_muscle text', s);
    EXECUTE format(
      'ALTER TABLE %I.exercises ADD COLUMN IF NOT EXISTS secondary_muscles text[] NOT NULL DEFAULT ''{}''', s);

    -- Mirrors the existing (gym_id, muscle_group) index: the picker filters by
    -- gym and target muscle together, never by target muscle alone.
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = s AND indexname = 'exercises_gym_id_target_muscle_idx'
    ) THEN
      EXECUTE format(
        'CREATE INDEX exercises_gym_id_target_muscle_idx ON %I.exercises (gym_id, target_muscle)', s);
    END IF;

    RAISE NOTICE 'exercises.target_muscle ready on %', s;
  END LOOP;
END $$;
