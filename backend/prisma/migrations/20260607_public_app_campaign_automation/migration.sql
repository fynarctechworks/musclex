-- Public Fitness Platform — Phase 7.6: campaign delivery tracking + automation.
-- Additive, public schema. Per-recipient deliveries power sent/delivered/opened/
-- clicked analytics + automation cooldown dedup. Automations are admin-configured
-- triggered campaigns run by an SCC cron.

CREATE TABLE IF NOT EXISTS public.app_campaign_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid,
  automation_key  text,
  app_user_id     uuid NOT NULL,
  token           text NOT NULL,
  status          text NOT NULL DEFAULT 'queued',
  error           text,
  sent_at         timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_campaign_deliveries_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES public.app_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT app_campaign_deliveries_app_user_id_fkey FOREIGN KEY (app_user_id)
    REFERENCES public.app_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS app_campaign_deliveries_campaign_idx ON public.app_campaign_deliveries (campaign_id);
CREATE INDEX IF NOT EXISTS app_campaign_deliveries_user_idx ON public.app_campaign_deliveries (app_user_id);
CREATE INDEX IF NOT EXISTS app_campaign_deliveries_automation_idx ON public.app_campaign_deliveries (automation_key, app_user_id, created_at);
CREATE INDEX IF NOT EXISTS app_campaign_deliveries_status_idx ON public.app_campaign_deliveries (status);

CREATE TABLE IF NOT EXISTS public.app_campaign_automations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key            text UNIQUE NOT NULL,
  title          text NOT NULL,
  body           text NOT NULL,
  target_segment text NOT NULL,
  deep_link      text,
  enabled        boolean NOT NULL DEFAULT false,
  cooldown_days  integer NOT NULL DEFAULT 7,
  last_run_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_campaign_automations (key, title, body, target_segment, cooldown_days, deep_link)
VALUES
  ('welcome',               'Welcome to MuscleX 💪',   'Your fitness journey starts now. Set your goal and get a personal plan.', 'public', 9999, 'musclex://onboarding'),
  ('incomplete_onboarding', 'Finish your profile',     'You''re one step away from personalized calorie & workout targets.',       'incomplete_onboarding', 3, 'musclex://onboarding'),
  ('water_reminder',        'Time to hydrate 💧',      'Log your water and stay on track with your daily goal.',                   'public', 1, 'musclex://home'),
  ('workout_reminder',      'Get moving today 🏋️',     'A quick session keeps your streak alive. Open your plan.',                 'public', 1, 'musclex://home'),
  ('renewal_reminder',      'Your membership expired', 'Renew now and pick up right where you left off.',                          'expired', 7, 'musclex://membership'),
  ('nearby_gym_promo',      'Gyms near you',           'Find a gym nearby and start training with the pros.',                      'lead', 14, 'musclex://gyms'),
  ('winback',               'We miss you',             'Come back and crush your goals — your dashboard is waiting.',               'inactive', 14, 'musclex://home')
ON CONFLICT (key) DO NOTHING;
