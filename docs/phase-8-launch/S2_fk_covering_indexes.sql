-- ============================================================================
-- S2 — Add covering indexes for all unindexed foreign keys
-- Phase 8.5 remediation • idempotent • forward-only
-- ----------------------------------------------------------------------------
-- WHY: get_advisors performance flagged 142 single-column foreign keys with no
-- covering index across studio_template, the live studio_* schemas, and scc.
-- Without them, FK joins and ON DELETE/UPDATE cascades do sequential scans.
--
-- WHAT: for every single-column FK whose column is NOT the leading column of any
-- existing index, create a btree index <table>_<col>_idx. Re-runnable.
--
-- SCOPE: studio_template (so NEW gyms inherit on clone) + existing studio_* + scc.
-- Composite FKs (none currently flagged) are skipped, kept simple/correct.
-- Tables are near-empty pre-UAT so CREATE INDEX is instant (no CONCURRENTLY).
-- ============================================================================

DO $$
DECLARE
  r record;
  col_name text;
  idx_name text;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, t.relname AS table_name,
           c.conrelid AS relid, c.conkey[1] AS attnum
    FROM pg_constraint c
    JOIN pg_class t      ON t.oid = c.conrelid
    JOIN pg_namespace n  ON n.oid = t.relnamespace
    WHERE c.contype = 'f'
      AND array_length(c.conkey, 1) = 1
      AND (n.nspname = 'studio_template' OR n.nspname LIKE 'studio_%' OR n.nspname = 'scc')
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND i.indkey[0] = c.conkey[1]
      )
  LOOP
    SELECT a.attname INTO col_name
    FROM pg_attribute a
    WHERE a.attrelid = r.relid AND a.attnum = r.attnum;

    idx_name := left(r.table_name || '_' || col_name || '_idx', 63);

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (%I);',
      idx_name, r.schema_name, r.table_name, col_name);
    RAISE NOTICE 'created %.% (%)', r.schema_name, r.table_name, col_name;
  END LOOP;
END $$;

-- W2: pin search_path on the tenant-RLS helper (advisor security WARN hardening)
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'enable_tenant_rls'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public;', fn);
    RAISE NOTICE 'pinned search_path on %', fn;
  END LOOP;
END $$;
