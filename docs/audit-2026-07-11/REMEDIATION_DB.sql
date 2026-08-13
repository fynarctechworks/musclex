-- ============================================================================
-- MuscleX — Database remediation SQL  (audit 2026-07-11)
-- ============================================================================
-- DO NOT auto-run. Every statement here crosses a CLAUDE.md HARD STOP
-- (schema/RLS/destructive). Review, take a backup, and apply deliberately.
-- Backend connects as a superuser with rolbypassrls, so RLS/GRANT changes below
-- do NOT affect the app's own queries — they only constrain the anon/authenticated
-- PostgREST roles and clean up stale objects.
-- Verified live state on 2026-07-11:
--   * scc schema is NOT exposed to anon/authenticated (USAGE = false) → scc RLS is low priority.
--   * public: anon AND authenticated hold SELECT/INSERT/UPDATE/DELETE/TRUNCATE on 13 tables,
--     blocked today ONLY by RLS-enabled-without-policy. Revoking removes the landmine.
-- ============================================================================


-- ── #18 (HIGH-value hardening): revoke anon grants on sensitive public tables ──
-- anon (the unauthenticated PostgREST role) should have NO access to these.
-- This is safe: the app does not use the anon role. Revoking is defense-in-depth
-- on top of the RLS-no-policy that currently blocks reads.
REVOKE ALL ON TABLE
  public._prisma_migrations,
  public.email_verifications,
  public.invoices,
  public.login_history,
  public.pending_registrations,
  public.permissions,
  public.staff_invitations,
  public.studios,
  public.subscription_plans,
  public.user_devices,
  public.user_identities,
  public.user_roles,
  public.user_sessions
FROM anon;

-- authenticated role: revoke WRITE privileges unconditionally (no client should
-- INSERT/UPDATE/DELETE/TRUNCATE these directly — all writes go through the backend).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public._prisma_migrations,
  public.email_verifications,
  public.invoices,
  public.login_history,
  public.pending_registrations,
  public.permissions,
  public.staff_invitations,
  public.studios,
  public.subscription_plans,
  public.user_devices,
  public.user_identities,
  public.user_roles,
  public.user_sessions
FROM authenticated;

-- authenticated SELECT: VERIFY FIRST. Only revoke if the admin frontend never reads
-- these tables directly via supabase-js (it should go through the backend API).
-- Uncomment after confirming no direct reads:
-- REVOKE SELECT ON TABLE
--   public.invoices, public.studios, public.user_identities, public.user_sessions,
--   public.user_roles, public.staff_invitations, public.pending_registrations,
--   public.email_verifications, public.login_history, public.user_devices,
--   public.permissions, public.subscription_plans
-- FROM authenticated;

-- Stop the grants from silently reappearing on NEW public tables (Prisma-created
-- tables inherit default privileges). Lock the default down for future objects.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
-- (Keep authenticated defaults if any table legitimately needs client reads; otherwise:)
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;


-- ── #17 (LOW / defense-in-depth): enable RLS on scc tables ────────────────────
-- scc is NOT PostgREST-exposed, so anon/authenticated cannot reach it today.
-- Enabling RLS is belt-and-suspenders in case the schema is ever exposed. The
-- backend uses rolbypassrls, so this does NOT block the SCC API. No policy needed
-- while unexposed; if you later expose scc, add explicit policies BEFORE doing so.
ALTER TABLE scc.error_activity_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.error_occurrences     ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.admin_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.system_alerts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.idempotency_keys      ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.feature_flags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.tenant_feature_flags  ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.subscription_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.subscriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.system_errors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.discounts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.tenants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.release_tracking      ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.plan_feature_flags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE scc.platform_settings     ENABLE ROW LEVEL SECURITY;


-- ── #19 (LOW / perf): index unindexed foreign keys on hot public tables ───────
-- Use CONCURRENTLY so there is no table lock; run each OUTSIDE a transaction block.
-- Confirm exact FK column names against schema.prisma before running.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_login_history_user_id ON public.login_history (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions (user_id);


-- ── #11 (MEDIUM / PII): drop stale pre-truncate backup schemas ────────────────
-- ⚠️ DESTRUCTIVE + IRREVERSIBLE. These schemas retain real member/identity PII.
-- BEFORE running: export them (pg_dump) to encrypted cold storage if you must keep
-- a backup for compliance, then confirm they are truly obsolete. Only then:
-- DROP SCHEMA zzz_backup_pre_truncate_20260614 CASCADE;
-- DROP SCHEMA zzz_backup_pre_truncate_20260623 CASCADE;
