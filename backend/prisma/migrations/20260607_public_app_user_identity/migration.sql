-- Public Fitness Platform — Phase 1: gym-independent app-user identity (public schema).
-- Additive + idempotent. Applied to staging via the Supabase migration tool (this
-- DB's _prisma_migrations history is untracked, so it is NOT deployed via
-- `prisma migrate deploy`). Touches NO studio_template / gym-scoped tables, so it
-- cannot affect existing gym-member behaviour or tenant isolation.

-- ── 1. app_users: the canonical person (one row per verified phone) ──
CREATE TABLE IF NOT EXISTS public.app_users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone            text NOT NULL,
  full_name        text,
  email            text,
  city             text,
  gender           text,
  date_of_birth    date,
  referral_source  text,
  onboarding_state text NOT NULL DEFAULT 'not_started',
  status           text NOT NULL DEFAULT 'active',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  last_active_at   timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_phone_key      ON public.app_users (phone);
CREATE INDEX IF NOT EXISTS app_users_city_idx              ON public.app_users (city);
CREATE INDEX IF NOT EXISTS app_users_status_idx            ON public.app_users (status);
CREATE INDEX IF NOT EXISTS app_users_last_active_at_idx    ON public.app_users (last_active_at);
CREATE INDEX IF NOT EXISTS app_users_created_at_idx        ON public.app_users (created_at);

-- ── 2. app_user_gym_links: app_user ↔ gym membership (0..N per person) ──
CREATE TABLE IF NOT EXISTS public.app_user_gym_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid NOT NULL,
  tenant_id   uuid NOT NULL,
  member_id   uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_user_gym_links_app_user_id_fkey FOREIGN KEY (app_user_id)
    REFERENCES public.app_users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS app_user_gym_links_app_user_id_tenant_id_key
  ON public.app_user_gym_links (app_user_id, tenant_id);
CREATE INDEX IF NOT EXISTS app_user_gym_links_tenant_id_idx ON public.app_user_gym_links (tenant_id);
CREATE INDEX IF NOT EXISTS app_user_gym_links_member_id_idx ON public.app_user_gym_links (member_id);

-- ── 3. member_refresh_tokens: support gym-less (public) sessions ──
--   add app_user_id; allow member_id/tenant_id to be NULL for public users.
ALTER TABLE public.member_refresh_tokens
  ADD COLUMN IF NOT EXISTS app_user_id uuid;

ALTER TABLE public.member_refresh_tokens
  ALTER COLUMN member_id DROP NOT NULL,
  ALTER COLUMN tenant_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS member_refresh_tokens_app_user_id_idx
  ON public.member_refresh_tokens (app_user_id);
