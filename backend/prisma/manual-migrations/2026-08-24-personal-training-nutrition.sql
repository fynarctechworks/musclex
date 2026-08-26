-- ────────────────────────────────────────────────────────────────
-- Personal training & nutrition for gym-less members
-- ────────────────────────────────────────────────────────────────
--
-- PURELY ADDITIVE. Five new tables in `public`. No existing table is altered
-- and nothing is dropped. Every statement is idempotent so a re-run is a no-op.
--
-- None of these carries a gym_id: they are keyed by app_user_id, exactly like
-- app_user_activities and app_user_water_logs. There is therefore no tenant
-- column to scope, and they must stay OUT of TENANT_MODELS.

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_user_exercises (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id       UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  muscle_group      TEXT,
  target_muscle     TEXT,
  secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
  tracking_type     TEXT NOT NULL DEFAULT 'reps',
  instructions      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_user_exercises_app_user_id_idx  ON public.app_user_exercises(app_user_id);
CREATE INDEX IF NOT EXISTS app_user_exercises_muscle_group_idx ON public.app_user_exercises(muscle_group);

CREATE TABLE IF NOT EXISTS public.app_user_routines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_user_routines_app_user_id_idx ON public.app_user_routines(app_user_id);

CREATE TABLE IF NOT EXISTS public.app_user_routine_exercises (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id              UUID NOT NULL REFERENCES public.app_user_routines(id) ON DELETE CASCADE,
  exercise_id             UUID NOT NULL REFERENCES public.app_user_exercises(id),
  position                INTEGER NOT NULL DEFAULT 0,
  target_sets             INTEGER,
  target_reps             INTEGER,
  target_duration_seconds INTEGER,
  target_reps_per_set     INTEGER[] NOT NULL DEFAULT '{}',
  target_seconds_per_set  INTEGER[] NOT NULL DEFAULT '{}',
  target_weight_per_set   DECIMAL(6,2)[] NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_user_routine_exercises_routine_id_idx  ON public.app_user_routine_exercises(routine_id);
CREATE INDEX IF NOT EXISTS app_user_routine_exercises_exercise_id_idx ON public.app_user_routine_exercises(exercise_id);

CREATE TABLE IF NOT EXISTS public.app_user_meal_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  meal_type   TEXT NOT NULL DEFAULT 'snack',
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes       TEXT,
  client_key  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS app_user_meal_logs_user_client_key_key ON public.app_user_meal_logs(app_user_id, client_key);
CREATE INDEX IF NOT EXISTS app_user_meal_logs_user_logged_at_idx ON public.app_user_meal_logs(app_user_id, logged_at);

CREATE TABLE IF NOT EXISTS public.app_user_meal_log_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_log_id UUID NOT NULL REFERENCES public.app_user_meal_logs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  quantity    DECIMAL(8,2) NOT NULL DEFAULT 1,
  unit        TEXT NOT NULL DEFAULT 'serving',
  kcal        DECIMAL(8,2) NOT NULL DEFAULT 0,
  protein_g   DECIMAL(7,2) NOT NULL DEFAULT 0,
  carbs_g     DECIMAL(7,2) NOT NULL DEFAULT 0,
  fat_g       DECIMAL(7,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_user_meal_log_items_meal_log_id_idx ON public.app_user_meal_log_items(meal_log_id);

COMMIT;
