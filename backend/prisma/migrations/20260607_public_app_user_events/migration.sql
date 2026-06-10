-- Public Fitness Platform — Phase 3: app-user funnel / behaviour event stream.
-- Append-only, public schema, keyed by app_user_id. Powers onboarding-funnel +
-- conversion analytics (SCC, Phase 4-5). Registration / gym-selected / purchase
-- stay derived from existing tables — this only stores client-emitted events.

CREATE TABLE IF NOT EXISTS public.app_user_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid NOT NULL,
  event_type  text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  platform    text,
  app_version text,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_user_events_app_user_id_fkey FOREIGN KEY (app_user_id)
    REFERENCES public.app_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS app_user_events_user_type_idx
  ON public.app_user_events (app_user_id, event_type);
CREATE INDEX IF NOT EXISTS app_user_events_type_time_idx
  ON public.app_user_events (event_type, occurred_at);
