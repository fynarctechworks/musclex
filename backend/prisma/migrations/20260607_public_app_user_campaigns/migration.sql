-- Public Fitness Platform — Phase 5b: app-user push tokens + segment campaigns.
-- Additive, public schema. Device tokens are keyed by app_user (gym-independent),
-- unlike the gym-scoped member_device_tokens.

CREATE TABLE IF NOT EXISTS public.app_user_device_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id  uuid NOT NULL,
  token        text NOT NULL,
  platform     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  CONSTRAINT app_user_device_tokens_app_user_id_fkey FOREIGN KEY (app_user_id)
    REFERENCES public.app_users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS app_user_device_tokens_token_key
  ON public.app_user_device_tokens (token);
CREATE INDEX IF NOT EXISTS app_user_device_tokens_user_idx
  ON public.app_user_device_tokens (app_user_id);

CREATE TABLE IF NOT EXISTS public.app_campaigns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL,
  body           text NOT NULL,
  target_segment text NOT NULL,
  deep_link      text,
  status         text NOT NULL DEFAULT 'draft',
  recipients     integer NOT NULL DEFAULT 0,
  sent_count     integer NOT NULL DEFAULT 0,
  failed_count   integer NOT NULL DEFAULT 0,
  created_by     uuid,
  scheduled_at   timestamptz,
  sent_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_campaigns_status_idx ON public.app_campaigns (status);
CREATE INDEX IF NOT EXISTS app_campaigns_created_idx ON public.app_campaigns (created_at);
