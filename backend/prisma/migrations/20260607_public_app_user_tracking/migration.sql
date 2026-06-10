-- Public Fitness Platform — Phase 2b: gym-less personal tracking (public schema).
-- Additive + idempotent. Keyed by app_user_id; never touches studio schemas.

CREATE TABLE IF NOT EXISTS public.app_user_weight_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id  uuid NOT NULL,
  logged_on    date NOT NULL,
  weight_kg    numeric(5,2) NOT NULL,
  body_fat_pct numeric(4,1),
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_user_weight_logs_app_user_id_fkey FOREIGN KEY (app_user_id)
    REFERENCES public.app_users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS app_user_weight_logs_user_day_key
  ON public.app_user_weight_logs (app_user_id, logged_on);

CREATE TABLE IF NOT EXISTS public.app_user_water_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid NOT NULL,
  logged_on   date NOT NULL,
  amount_ml   integer NOT NULL DEFAULT 0,
  goal_ml     integer,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_user_water_logs_app_user_id_fkey FOREIGN KEY (app_user_id)
    REFERENCES public.app_users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS app_user_water_logs_user_day_key
  ON public.app_user_water_logs (app_user_id, logged_on);

CREATE TABLE IF NOT EXISTS public.app_user_goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id   uuid NOT NULL,
  type          text NOT NULL,
  title         text,
  target_value  numeric(10,2),
  current_value numeric(10,2) DEFAULT 0,
  unit          text,
  target_date   date,
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_user_goals_app_user_id_fkey FOREIGN KEY (app_user_id)
    REFERENCES public.app_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS app_user_goals_user_status_idx
  ON public.app_user_goals (app_user_id, status);

CREATE TABLE IF NOT EXISTS public.app_user_health_daily (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id        uuid NOT NULL,
  logged_on          date NOT NULL,
  steps              integer NOT NULL DEFAULT 0,
  active_calories    numeric(8,2),
  distance_m         numeric(10,2),
  resting_heart_rate integer,
  source             text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_user_health_daily_app_user_id_fkey FOREIGN KEY (app_user_id)
    REFERENCES public.app_users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS app_user_health_daily_user_day_key
  ON public.app_user_health_daily (app_user_id, logged_on);
