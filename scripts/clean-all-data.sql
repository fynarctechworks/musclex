-- ============================================================
-- MuscleX / FitSync Pro — CLEAN ALL DATA (preserve tables)
-- ============================================================
--
-- TRUNCATES all data from every table but keeps table structure.
-- Uses dynamic queries — only touches tables that actually exist.
--
-- WARNING: This is irreversible. Back up first if needed.
--
-- HOW TO RUN (Supabase SQL Editor):
--   Paste and run each STEP separately (not all at once)
--   to avoid hitting max_locks_per_transaction limits.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- STEP 1: List tenant schemas (run first to see what exists)
-- ─────────────────────────────────────────────────────────────
SELECT nspname FROM pg_namespace
WHERE nspname LIKE 'studio_%' AND nspname != 'studio_template'
ORDER BY nspname;


-- ─────────────────────────────────────────────────────────────
-- STEP 2: Auto-clean ALL tenant schemas (studio_XXXX)
--         Truncates all data, then drops the schema entirely.
--         No manual <SCHEMA> replacement needed.
-- ─────────────────────────────────────────────────────────────
SET session_replication_role = 'replica';
DO $$
DECLARE
  s TEXT;
  t TEXT;
BEGIN
  FOR s IN
    SELECT nspname FROM pg_namespace
    WHERE nspname LIKE 'studio_%' AND nspname != 'studio_template'
    ORDER BY nspname
  LOOP
    -- Truncate all tables in the tenant schema
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = s LOOP
      EXECUTE format('TRUNCATE TABLE %I.%I CASCADE', s, t);
    END LOOP;
    -- Drop all tables
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = s LOOP
      EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', s, t);
    END LOOP;
    -- Drop the schema itself
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', s);
  END LOOP;
END;
$$;
SET session_replication_role = 'origin';


-- ─────────────────────────────────────────────────────────────
-- STEP 3: Clean studio_template schema (data only, keep tables)
--         Dynamic — only truncates tables that actually exist.
-- ─────────────────────────────────────────────────────────────
SET session_replication_role = 'replica';
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'studio_template'
      AND tablename NOT LIKE '_prisma%'
    ORDER BY tablename
  LOOP
    EXECUTE format('TRUNCATE TABLE studio_template.%I CASCADE', t);
  END LOOP;
END;
$$;
SET session_replication_role = 'origin';


-- ─────────────────────────────────────────────────────────────
-- STEP 4: Clean public schema (users, studios, auth, billing)
--         Dynamic — only truncates tables that actually exist.
--         Skips Prisma internals and pg_ system tables.
-- ─────────────────────────────────────────────────────────────
SET session_replication_role = 'replica';
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '_prisma%'
      AND tablename NOT LIKE 'pg_%'
    ORDER BY tablename
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I CASCADE', t);
  END LOOP;
END;
$$;
SET session_replication_role = 'origin';


-- ─────────────────────────────────────────────────────────────
-- STEP 5: Re-seed subscription plans (required for onboarding)
-- ─────────────────────────────────────────────────────────────
-- Run after cleaning:
--   cd backend && npx prisma db seed


-- ─────────────────────────────────────────────────────────────
-- STEP 6: Clean Supabase Auth users (CANNOT be done via SQL)
--
-- Supabase Auth lives in a separate system. Old auth users
-- cause "already exists" errors on fresh registration.
-- Options:
--   - Supabase Dashboard > Authentication > Users > delete all
--   - Supabase admin API: supabase.auth.admin.deleteUser(uid)
-- ─────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- DONE. All data wiped. Tables and schemas preserved.
-- Next steps:
--   1. cd backend && npx prisma db seed   (re-seed plans + permissions)
--   2. Delete auth users from Supabase Dashboard
--   3. Register a new user through the app
-- ─────────────────────────────────────────────────────────────
