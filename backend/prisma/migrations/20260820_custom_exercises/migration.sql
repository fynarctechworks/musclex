-- Member-created exercises (2026-08-20).
--
-- WHY: a gym's catalogue will never cover everything. A member doing a movement
-- their gym has not catalogued currently cannot log it at all — there is no way
-- to add one.
--
-- `created_by_member_id` makes an exercise PERSONAL: NULL is the gym's own
-- catalogue, a member id means only that member sees it. A member must not be
-- able to write into what every other member at their gym sees, and trainers
-- would reasonably object to a parallel catalogue they do not control.
--
-- Nullable with no backfill, so all 1,334 existing rows stay gym-owned and
-- visible to everyone exactly as now.
--
-- Idempotent and additive. studio_template AND every live studio_%.

DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT nspname FROM pg_namespace
    WHERE nspname = 'studio_template' OR nspname LIKE 'studio\_%'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.exercises ADD COLUMN IF NOT EXISTS created_by_member_id uuid', s);

    -- Partial index: the only query that uses it is "this member's own
    -- exercises", and indexing the 1,334 NULLs would be dead weight.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS exercises_created_by_member_idx ON %I.exercises (gym_id, created_by_member_id) WHERE created_by_member_id IS NOT NULL', s);

    RAISE NOTICE 'custom exercises ready on %', s;
  END LOOP;
END $$;
