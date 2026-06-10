-- First-time member onboarding + personalization (Member App).
-- Extends studio_template.member_profiles with the fitness-profile fields the
-- onboarding flow collects (most onboarding data already had columns — gender +
-- date_of_birth on members; height/weight/fitness_goal/medical_conditions on
-- member_profiles — so this only adds what was genuinely missing):
--   goals[]              multi-select goals (fitness_goal stays the single PRIMARY)
--   activity_level       sedentary..athlete (drives TDEE personalization)
--   training_experience  beginner|intermediate|advanced (drives split + protein)
--   workout_preferences[] gym|home|strength|cardio|hiit|yoga|crossfit|powerlifting|bodybuilding
--   height_unit/weight_unit  display prefs (values stay canonical cm/kg)
--   onboarding_step          resume marker (null once complete)
--   onboarding_completed_at  set when the member finishes onboarding
-- member_profiles is already in TENANT_MODELS, so the gym_id auto-injection
-- covers these columns — no registry change.
--
-- ONBOARDING STATE: this feature is brand new, so NO member has legitimately
-- completed the in-app onboarding flow yet. We only ensure every current member
-- has a profile row (so PATCH /me upserts cleanly); we deliberately do NOT mark
-- anyone onboarding_completed. Every member — pre-existing or new — has
-- onboarding_completed_at = NULL and gets the one-time flow on first app open.
--
-- (History: an earlier version of this migration blanket-set
-- onboarding_completed_at = now() for all existing members. That silently skipped
-- onboarding for members a gym had added but who had never opened the app — a
-- "fresh number" landed straight on Home. A one-time onboarding for a returning
-- member is a far smaller cost than a new member never being onboarded, so the
-- backfill UPDATE was removed.)
--
-- Idempotent + additive; applied to staging via the Supabase migration tool
-- (this DB's _prisma_migrations history is untracked, so it is NOT deployed via
-- `prisma migrate deploy`). No `prisma migrate dev` (shared Supabase DB).

ALTER TABLE studio_template.member_profiles
  ADD COLUMN IF NOT EXISTS goals               text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS activity_level       text,
  ADD COLUMN IF NOT EXISTS training_experience  text,
  ADD COLUMN IF NOT EXISTS workout_preferences  text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS height_unit          text        NOT NULL DEFAULT 'cm',
  ADD COLUMN IF NOT EXISTS weight_unit          text        NOT NULL DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS onboarding_step      text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Backfill: ensure every existing member has a profile row. We do NOT set
-- onboarding_completed_at here — see "ONBOARDING STATE" above. Every member is
-- left as first-time so they get the one-time onboarding flow on first app open.
INSERT INTO studio_template.member_profiles (gym_id, member_id)
SELECT m.gym_id, m.id
FROM studio_template.members m
LEFT JOIN studio_template.member_profiles p ON p.member_id = m.id
WHERE p.id IS NULL;
