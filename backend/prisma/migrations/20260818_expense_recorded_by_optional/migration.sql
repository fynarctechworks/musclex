-- Expenses: make `recorded_by_staff_id` optional (2026-08-18).
--
-- WHY: the column was NOT NULL with a required FK to staff(id), but a gym
-- OWNER has no `staff` row. The API records the authenticated USER id, which is
-- not a staff id, so every owner-recorded expense failed — first with an FK
-- violation, and with NULL rejected by the NOT NULL constraint. There was no
-- value that satisfied the column, making expense recording impossible for the
-- most common user.
--
-- Additive and idempotent: only drops a NOT NULL (never adds one back), so it
-- is safe to re-run and cannot fail on existing rows. The FK itself is kept —
-- a non-null value must still reference a real staff row.
--
-- Applied to studio_template AND every live studio_% schema.

DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT nspname FROM pg_namespace
    WHERE nspname = 'studio_template' OR nspname LIKE 'studio\_%'
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = s AND table_name = 'expenses'
        AND column_name = 'recorded_by_staff_id' AND is_nullable = 'NO'
    ) THEN
      EXECUTE format('ALTER TABLE %I.expenses ALTER COLUMN recorded_by_staff_id DROP NOT NULL', s);
      RAISE NOTICE 'dropped NOT NULL on %.expenses.recorded_by_staff_id', s;
    END IF;
  END LOOP;
END $$;
