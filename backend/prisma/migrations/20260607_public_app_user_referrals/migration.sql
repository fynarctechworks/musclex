-- Public Fitness Platform — Phase 5c: app-user referral codes + attribution.
-- Additive columns on app_users; backfill codes for existing rows.

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by_app_user_id uuid;

UPDATE public.app_users
   SET referral_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
 WHERE referral_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_users_referral_code_key
  ON public.app_users (referral_code);
CREATE INDEX IF NOT EXISTS app_users_referred_by_idx
  ON public.app_users (referred_by_app_user_id);
