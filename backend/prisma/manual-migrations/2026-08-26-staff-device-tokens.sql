-- ────────────────────────────────────────────────────────────────
-- Staff push device tokens
-- ────────────────────────────────────────────────────────────────
--
-- PURELY ADDITIVE. One new table in `public`. No existing table is altered and
-- nothing is dropped. Every statement is idempotent, so a re-run is a no-op.
--
-- WHY `public` AND NOT A PER-STUDIO SCHEMA
--
-- `member_device_tokens` lives in `studio_template` because a member belongs to
-- exactly one gym. A STAFF device does not: the same phone can be signed in to
-- an account that holds roles in several studios (see user_roles, also public).
--
-- The requirement driving this is "cleared on sign out". If tokens were stored
-- per-studio, signing out would have to walk every studio the user belongs to
-- and delete from each — and any studio missed keeps pushing to a phone whose
-- owner has signed out. Keyed by user_id in one public table, sign-out is a
-- single delete that cannot miss one.
--
-- `gym_id` is still recorded so a send can be scoped to one gym's staff, and it
-- is NOT NULL so a token can never become un-attributable.
--
-- This table is keyed by user_id, like app_user_* and user_roles, so it must
-- stay OUT of TENANT_MODELS — there is no tenant column for the Prisma
-- extension to inject, and adding it would break every query.

BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_device_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.user_identities(id) ON DELETE CASCADE,
  gym_id      UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL,
  device_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per physical device per gym. Re-registering the same token for the
-- same gym updates rather than duplicating, so a reinstall cannot fan out into
-- several rows all pushing to the same handset.
CREATE UNIQUE INDEX IF NOT EXISTS staff_device_tokens_token_gym_uniq
  ON public.staff_device_tokens (token, gym_id);

-- Sign-out deletes by user; sending selects by gym. Both are indexed.
CREATE INDEX IF NOT EXISTS staff_device_tokens_user_idx
  ON public.staff_device_tokens (user_id);
CREATE INDEX IF NOT EXISTS staff_device_tokens_gym_idx
  ON public.staff_device_tokens (gym_id);

COMMIT;
