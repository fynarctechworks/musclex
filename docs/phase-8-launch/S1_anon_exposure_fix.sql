-- ============================================================================
-- S1 — Close the anon/PostgREST exposure of backend-owned public tables
-- Phase 8.1 remediation • 2026-06-07 • idempotent • forward-only
-- ----------------------------------------------------------------------------
-- WHY: 24 tables in `public` had RLS disabled AND granted the `anon` role
-- (the public, browser-shipped key) full SELECT/INSERT/UPDATE/DELETE/TRUNCATE.
-- With the Supabase Data API enabled this = public read + destroy of member
-- PII, health data, push/campaign tokens, and referral wallets.
--
-- SAFE because: every legitimate caller reaches these tables through the NestJS
-- backend, which connects as the `postgres` superuser (rolbypassrls) and is
-- UNAFFECTED by REVOKE or RLS. Verified no frontend/member-app code reads these
-- tables via the Supabase anon/authenticated client (only Storage buckets are
-- used client-side).
--
-- WHAT:
--   1. REVOKE all anon/authenticated privileges on the 24 tables.
--   2. ENABLE RLS on each (deny-all to non-superusers; superuser still bypasses).
--   3. ALTER DEFAULT PRIVILEGES so FUTURE postgres-created tables in `public`
--      are not auto-granted to anon/authenticated (root-cause guard).
-- ============================================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'app_users','app_user_gym_links','app_user_goals','app_user_weight_logs',
    'app_user_water_logs','app_user_health_daily','app_user_events',
    'app_user_device_tokens','app_campaigns','app_campaign_deliveries',
    'app_campaign_automations','referrals','referral_campaigns',
    'referral_reward_rules','referral_wallets','referral_wallet_entries',
    'referral_fraud_signals','referral_lifecycle_events','reward_logs',
    'member_directory','member_refresh_tokens','member_idempotency_keys',
    'subscription_events','user_dashboard_layouts'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated;', t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      RAISE NOTICE 'secured: %', t;
    ELSE
      RAISE NOTICE 'skipped (absent): %', t;
    END IF;
  END LOOP;
END $$;

-- Root-cause guard: stop future postgres-created public tables from being
-- auto-exposed to the Data API. New tables that SHOULD be public must GRANT
-- explicitly + add RLS policies.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
