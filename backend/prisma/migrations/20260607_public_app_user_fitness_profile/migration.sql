-- Public Fitness Platform — Phase 7.1: app-user fitness profile (public schema).
-- Additive columns on app_users so the EXISTING onboarding flow + PersonalizationService
-- work for gym-less users. Current weight reuses app_user_weight_logs (latest).

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS height_cm            numeric(5,1),
  ADD COLUMN IF NOT EXISTS height_unit          text DEFAULT 'cm',
  ADD COLUMN IF NOT EXISTS weight_unit          text DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS primary_goal         text,
  ADD COLUMN IF NOT EXISTS goals                jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS activity_level       text,
  ADD COLUMN IF NOT EXISTS training_experience  text,
  ADD COLUMN IF NOT EXISTS workout_preferences  jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS limitations          jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS onboarding_step      text;
