-- ────────────────────────────────────────────────────────────────
-- Fan the expense event system out to EXISTING gym schemas
-- ────────────────────────────────────────────────────────────────
--
-- WHY THIS EXISTS
-- migrations/20260415_expense_event_system named "studio_template" literally, so
-- it only ever reached gyms provisioned AFTER it ran. Every gym that already
-- existed kept the old expenses shape, and because schema.prisma describes the
-- new one, `prisma.expense.findMany()` fails against them with
--   The column `expenses.category_id` does not exist in the current database.
-- i.e. GET /expenses has been a 500 for every live gym since that migration.
-- This replays the same DDL across the schemas it skipped.
--
-- PURELY ADDITIVE AND IDEMPOTENT
--   * only ADD COLUMN / CREATE TABLE / CREATE INDEX IF NOT EXISTS
--   * the one type change widens numeric(10,2) -> numeric(12,2), which is
--     lossless; it is skipped where precision is already >= 12
--   * FKs are guarded on pg_constraint because ADD CONSTRAINT has no
--     IF NOT EXISTS, so an unguarded re-run would fail on the second pass
--   * nothing is dropped, nothing is rewritten, no row is touched
--
-- Deliberately NO BEGIN/COMMIT here: the applier wraps each file in its own
-- transaction, which is what lets it be rehearsed and rolled back. A file that
-- commits itself silently ends that transaction and makes the rehearsal a lie.
--
-- studio_template is excluded — it already has all of this.

DO $mig$
DECLARE
  s   record;
  prec integer;
BEGIN
  FOR s IN
    SELECT nspname FROM pg_namespace
     WHERE nspname LIKE 'studio\_%' AND nspname <> 'studio_template'
     ORDER BY nspname
  LOOP
    -- A studio schema without an expenses table is not one this migration
    -- describes; skip rather than fail the whole run.
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = s.nspname AND table_name = 'expenses'
    );

    SELECT numeric_precision INTO prec
      FROM information_schema.columns
     WHERE table_schema = s.nspname AND table_name = 'expenses' AND column_name = 'amount';
    IF prec IS NOT NULL AND prec < 12 THEN
      EXECUTE format('ALTER TABLE %I.expenses ALTER COLUMN amount TYPE numeric(12,2)', s.nspname);
    END IF;

    EXECUTE format($f$
      ALTER TABLE %1$I.expenses
        ADD COLUMN IF NOT EXISTS category_id     uuid,
        ADD COLUMN IF NOT EXISTS vendor          text,
        ADD COLUMN IF NOT EXISTS notes           text,
        ADD COLUMN IF NOT EXISTS payment_method  text NOT NULL DEFAULT 'cash',
        ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'confirmed',
        ADD COLUMN IF NOT EXISTS reference_id    uuid,
        ADD COLUMN IF NOT EXISTS idempotency_key text;

      CREATE INDEX IF NOT EXISTS expenses_branch_id_expense_date_idx
        ON %1$I.expenses (branch_id, expense_date);
      CREATE INDEX IF NOT EXISTS expenses_branch_id_status_idx
        ON %1$I.expenses (branch_id, status);
      CREATE INDEX IF NOT EXISTS expenses_category_id_idx
        ON %1$I.expenses (category_id);
      CREATE UNIQUE INDEX IF NOT EXISTS expenses_gym_id_idempotency_key_key
        ON %1$I.expenses (gym_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

      CREATE TABLE IF NOT EXISTS %1$I.expense_categories (
        id         uuid        NOT NULL DEFAULT gen_random_uuid(),
        gym_id     uuid        NOT NULL,
        branch_id  uuid,
        name       text        NOT NULL,
        slug       text        NOT NULL,
        icon       text,
        color      text,
        is_default boolean     NOT NULL DEFAULT false,
        is_active  boolean     NOT NULL DEFAULT true,
        sort_order integer     NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT expense_categories_pkey PRIMARY KEY (id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS expense_categories_gym_id_branch_id_slug_key
        ON %1$I.expense_categories (gym_id, branch_id, slug);
      CREATE INDEX IF NOT EXISTS expense_categories_gym_id_branch_id_is_active_idx
        ON %1$I.expense_categories (gym_id, branch_id, is_active);

      CREATE TABLE IF NOT EXISTS %1$I.expense_metrics (
        id            uuid           NOT NULL DEFAULT gen_random_uuid(),
        gym_id        uuid           NOT NULL,
        branch_id     uuid           NOT NULL,
        period_type   text           NOT NULL,
        period_key    text           NOT NULL,
        category_id   uuid,
        total_amount  numeric(14,2)  NOT NULL DEFAULT 0,
        expense_count integer        NOT NULL DEFAULT 0,
        currency      text           NOT NULL DEFAULT 'INR',
        updated_at    timestamptz    NOT NULL DEFAULT now(),
        CONSTRAINT expense_metrics_pkey PRIMARY KEY (id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS expense_metrics_unique_key
        ON %1$I.expense_metrics (gym_id, branch_id, period_type, period_key, category_id);
      CREATE INDEX IF NOT EXISTS expense_metrics_lookup_idx
        ON %1$I.expense_metrics (gym_id, branch_id, period_type, period_key);
    $f$, s.nspname);

    -- ADD CONSTRAINT has no IF NOT EXISTS: guard each on pg_constraint so a
    -- re-run is a no-op instead of a duplicate_object error.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'expenses_category_id_fkey'
                      AND connamespace = s.nspname::regnamespace) THEN
      EXECUTE format($f$ALTER TABLE %1$I.expenses ADD CONSTRAINT expenses_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES %1$I.expense_categories (id)
        ON DELETE SET NULL ON UPDATE CASCADE$f$, s.nspname);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'expenses_reference_id_fkey'
                      AND connamespace = s.nspname::regnamespace) THEN
      EXECUTE format($f$ALTER TABLE %1$I.expenses ADD CONSTRAINT expenses_reference_id_fkey
        FOREIGN KEY (reference_id) REFERENCES %1$I.expenses (id)
        ON DELETE SET NULL ON UPDATE CASCADE$f$, s.nspname);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = s.nspname AND table_name = 'branches') THEN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint
                      WHERE conname = 'expense_categories_branch_id_fkey'
                        AND connamespace = s.nspname::regnamespace) THEN
        EXECUTE format($f$ALTER TABLE %1$I.expense_categories ADD CONSTRAINT expense_categories_branch_id_fkey
          FOREIGN KEY (branch_id) REFERENCES %1$I.branches (id)
          ON DELETE CASCADE ON UPDATE CASCADE$f$, s.nspname);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint
                      WHERE conname = 'expense_metrics_branch_id_fkey'
                        AND connamespace = s.nspname::regnamespace) THEN
        EXECUTE format($f$ALTER TABLE %1$I.expense_metrics ADD CONSTRAINT expense_metrics_branch_id_fkey
          FOREIGN KEY (branch_id) REFERENCES %1$I.branches (id)
          ON DELETE CASCADE ON UPDATE CASCADE$f$, s.nspname);
      END IF;
    END IF;

    RAISE NOTICE 'expense event system synced: %', s.nspname;
  END LOOP;
END
$mig$;
