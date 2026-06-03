-- ============================================================================
-- MIGRATION: Data-driven RLS coverage for ALL tenant tables
-- ============================================================================
--
-- Context:
--   20260421_enable_rls_all_tenant_tables enabled RLS, but its apply loop used a
--   HARDCODED table array. Every gym_id model added after 2026-04-21 was silently
--   missed (verified 2026-06-03: 43 gym_id tables in studio_template had no RLS,
--   including the entire member-app surface and biometric_enrollments).
--   See docs/RLS-HARDENING-AUDIT-2026-06-03.md.
--
-- What this migration does:
--   1. Re-creates the idempotent helper enable_tenant_rls(schema, table)
--      (identical policy to 20260421 — single tenant_isolation policy:
--       gym_id = current_setting('app.gym_id', true)::uuid, fail-closed).
--   2. Applies it DATA-DRIVEN to EVERY base table in studio_template that has a
--      gym_id column — so coverage can never drift again as models are added.
--   3. Re-runs the sanity check; raises if any gym_id table is still uncovered.
--
-- IMPORTANT: while the application still connects as a BYPASSRLS role (the keystone,
--   tracked separately as Phase B), enabling these policies has ZERO runtime effect
--   on the app — this is pure latent hardening / defense-in-depth groundwork.
--
-- Idempotent: safe to re-run (helper drops policy by name; ENABLE/FORCE are no-ops
--   when already set).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- HELPER: enable RLS + create tenant-isolation policy on a table
-- (CREATE OR REPLACE — same definition as 20260421, kept here so this
--  migration is self-contained and re-runnable independently.)
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enable_tenant_rls(
  p_schema TEXT,
  p_table TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = p_schema AND t.table_name = p_table
  ) THEN
    RAISE NOTICE 'Table %.% does not exist — skipping RLS', p_schema, p_table;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = p_schema
      AND c.table_name = p_table
      AND c.column_name = 'gym_id'
  ) THEN
    RAISE NOTICE 'Table %.% has no gym_id column — skipping RLS', p_schema, p_table;
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', p_schema, p_table);
  EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', p_schema, p_table);

  EXECUTE format(
    'DROP POLICY IF EXISTS tenant_isolation ON %I.%I',
    p_schema, p_table
  );

  EXECUTE format(
    $POL$
    CREATE POLICY tenant_isolation ON %I.%I
      FOR ALL
      USING (
        gym_id IS NOT NULL
        AND gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid
      )
      WITH CHECK (
        gym_id IS NOT NULL
        AND gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid
      )
    $POL$,
    p_schema, p_table
  );
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────────
-- Apply DATA-DRIVEN to every gym_id table in studio_template.
-- No hardcoded list — driven by the catalog, so it self-maintains.
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  rec RECORD;
  applied INT := 0;
BEGIN
  FOR rec IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
      AND a.attname = 'gym_id' AND a.attnum > 0 AND NOT a.attisdropped
    WHERE c.relkind = 'r'
      AND n.nspname = 'studio_template'
    ORDER BY c.relname
  LOOP
    PERFORM enable_tenant_rls('studio_template', rec.table_name);
    applied := applied + 1;
  END LOOP;
  RAISE NOTICE 'enable_tenant_rls applied to % gym_id table(s) in studio_template', applied;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- Sanity: fail loudly if ANY gym_id table is still uncovered.
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT count(*) INTO cnt
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
    AND a.attname = 'gym_id' AND a.attnum > 0 AND NOT a.attisdropped
  WHERE c.relkind = 'r'
    AND n.nspname = 'studio_template'
    AND c.relrowsecurity = false;

  IF cnt > 0 THEN
    RAISE EXCEPTION 'RLS coverage incomplete: % gym_id table(s) in studio_template still have RLS disabled', cnt;
  END IF;
  RAISE NOTICE 'RLS coverage complete: every gym_id table in studio_template has RLS enabled + forced';
END;
$$;
