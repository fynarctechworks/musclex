-- Fix branches and membership_plans tables to match Prisma schema
-- Adds missing columns to studio_template AND all existing tenant schemas

-- ─── Helper: add column if it doesn't exist ──────────────────────────
CREATE OR REPLACE FUNCTION public._add_column_if_not_exists(
  _schema TEXT, _table TEXT, _column TEXT, _type TEXT, _default TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = _schema AND table_name = _table AND column_name = _column
  ) THEN
    IF _default IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.%I ADD COLUMN %I %s DEFAULT %s', _schema, _table, _column, _type, _default);
    ELSE
      EXECUTE format('ALTER TABLE %I.%I ADD COLUMN %I %s', _schema, _table, _column, _type);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ─── Patch function: applies missing columns to a given schema ────────
CREATE OR REPLACE FUNCTION public._patch_tenant_tables(_schema TEXT) RETURNS VOID AS $$
BEGIN
  -- branches: add missing columns
  PERFORM public._add_column_if_not_exists(_schema, 'branches', 'gym_id', 'UUID');
  PERFORM public._add_column_if_not_exists(_schema, 'branches', 'organization_id', 'UUID');
  PERFORM public._add_column_if_not_exists(_schema, 'branches', 'region_id', 'UUID');
  PERFORM public._add_column_if_not_exists(_schema, 'branches', 'code', 'TEXT');
  PERFORM public._add_column_if_not_exists(_schema, 'branches', 'state', 'TEXT');
  PERFORM public._add_column_if_not_exists(_schema, 'branches', 'country', 'TEXT');
  PERFORM public._add_column_if_not_exists(_schema, 'branches', 'postal_code', 'TEXT');
  PERFORM public._add_column_if_not_exists(_schema, 'branches', 'latitude', 'DECIMAL(10,7)');
  PERFORM public._add_column_if_not_exists(_schema, 'branches', 'longitude', 'DECIMAL(10,7)');
  PERFORM public._add_column_if_not_exists(_schema, 'branches', 'status', 'TEXT', '''active''');
  PERFORM public._add_column_if_not_exists(_schema, 'branches', 'opening_time', 'TEXT');
  PERFORM public._add_column_if_not_exists(_schema, 'branches', 'closing_time', 'TEXT');

  -- membership_plans: add missing columns
  PERFORM public._add_column_if_not_exists(_schema, 'membership_plans', 'gym_id', 'UUID');
  PERFORM public._add_column_if_not_exists(_schema, 'membership_plans', 'organization_id', 'UUID');
  PERFORM public._add_column_if_not_exists(_schema, 'membership_plans', 'max_visits', 'INTEGER');
  PERFORM public._add_column_if_not_exists(_schema, 'membership_plans', 'yearly_price', 'DECIMAL(10,2)');
  PERFORM public._add_column_if_not_exists(_schema, 'membership_plans', 'currency', 'TEXT', '''INR''');
  PERFORM public._add_column_if_not_exists(_schema, 'membership_plans', 'multi_branch_access', 'BOOLEAN', 'false');
  PERFORM public._add_column_if_not_exists(_schema, 'membership_plans', 'grace_period_days', 'INTEGER', '0');
  PERFORM public._add_column_if_not_exists(_schema, 'membership_plans', 'updated_at', 'TIMESTAMPTZ', 'now()');
END;
$$ LANGUAGE plpgsql;

-- ─── Apply to studio_template ─────────────────────────────────────────
SELECT public._patch_tenant_tables('studio_template');

-- ─── Apply to ALL existing tenant schemas ─────────────────────────────
DO $$
DECLARE
  _schema TEXT;
BEGIN
  FOR _schema IN
    SELECT schema_name FROM public.studios WHERE schema_name IS NOT NULL
  LOOP
    PERFORM public._patch_tenant_tables(_schema);
  END LOOP;
END;
$$;

-- ─── Cleanup helper functions ─────────────────────────────────────────
DROP FUNCTION IF EXISTS public._patch_tenant_tables(TEXT);
DROP FUNCTION IF EXISTS public._add_column_if_not_exists(TEXT, TEXT, TEXT, TEXT, TEXT);
