-- ============================================================================
-- PHASE B (KEYSTONE) — least-privilege, NON-BYPASSRLS application role
-- ============================================================================
--
-- ⚠️  DO NOT auto-apply. This is NOT a Prisma migration. It changes DB roles and
--     is half of a two-part cutover (role + tx-local app.gym_id, runbook §3).
--     Applying the role WITHOUT the code change, or repointing DATABASE_URL
--     before staging rehearsal, can mis-scope or 500 the app. Run ONLY inside
--     the scheduled maintenance window, as `postgres` / `supabase_admin`, per
--     docs/RLS-PHASE-B-CUTOVER-RUNBOOK-2026-06-03.md.
--
-- Why: the app currently connects as `postgres` (rolbypassrls=true), so ALL RLS
--     policies are decorative at runtime. Switching to this non-bypass role is
--     what makes the 143 tenant_isolation policies actually enforce.
--
-- Idempotent: safe to re-run. Creating the role/grants is inert until
--     DATABASE_URL is repointed to it (cutover step, done separately).
-- ============================================================================

-- 1. Role — NO SUPERUSER, NO BYPASSRLS. Set a strong password from the secret
--    manager (do NOT commit a real password here).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fitsync_app') THEN
    CREATE ROLE fitsync_app LOGIN PASSWORD '<<FROM-SECRET-MANAGER>>'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

-- Defense-in-depth: be explicit even if the role pre-existed with other attrs.
ALTER ROLE fitsync_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- 2. Schema usage. studio_template = where all tenant rows physically live;
--    public = non-tenant tables the app reads (Studio, UserIdentity, etc.).
GRANT USAGE ON SCHEMA studio_template, public TO fitsync_app;

-- 3. Table DML only — deliberately NO TRUNCATE / REFERENCES / TRIGGER, and the
--    role does NOT own the tables, so FORCE RLS still governs it.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA studio_template TO fitsync_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public         TO fitsync_app;

-- 4. Sequences — INSERTs need nextval.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA studio_template, public TO fitsync_app;

-- 5. Future objects inherit the same grants so new migrations don't silently 403.
--    Migrations keep running as `postgres`, so default-privileges FOR ROLE postgres.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA studio_template
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fitsync_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA studio_template
  GRANT USAGE, SELECT ON SEQUENCES TO fitsync_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fitsync_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO fitsync_app;

-- 6. Sanity: confirm the role is genuinely non-privileged before cutover.
DO $$
DECLARE r RECORD;
BEGIN
  SELECT rolbypassrls, rolsuper INTO r FROM pg_roles WHERE rolname = 'fitsync_app';
  IF r.rolbypassrls OR r.rolsuper THEN
    RAISE EXCEPTION 'fitsync_app must be NOBYPASSRLS + NOSUPERUSER (got bypassrls=%, super=%)',
      r.rolbypassrls, r.rolsuper;
  END IF;
  RAISE NOTICE 'fitsync_app ready: non-bypass, non-super. Cutover = repoint DATABASE_URL + restart.';
END $$;
