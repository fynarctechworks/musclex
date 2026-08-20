-- Social graph: follows, kudos, comments, blocks (2026-08-21).
--
-- ─── FOLLOWS SIT BESIDE FRIENDSHIPS, THEY DO NOT REPLACE THEM ───────────────
--
-- `friendships` is MUTUAL and consent-based: both people agreed, and it gates
-- PR comparison and routine sharing. A follow is ONE-WAY and needs no consent —
-- it is "I want to see your activities", nothing more. Collapsing the two would
-- either force consent on watching (and kill the feed) or grant comparison
-- rights to anyone who pressed Follow. They answer different questions, so they
-- are different tables.
--
-- ─── EVERYTHING IS app_user SCOPED ──────────────────────────────────────────
--
-- Same as activities: no gym_id anywhere, nothing joins into a studio schema,
-- so the tenant model set is untouched and no cross-gym read is possible.
--
-- ─── BLOCKS SHIP WITH THE FEED, NOT AFTER IT ────────────────────────────────
--
-- Comments and a follow button are the point at which one member can reach
-- another uninvited. Shipping that without a way to stop it means the first
-- person who needs it does not have it. A block is one-directional in intent
-- but enforced BOTH ways: neither party sees the other's activities, and
-- neither can comment.

CREATE TABLE IF NOT EXISTS public.follows (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  followee_id  uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- Following yourself would put your own activities in your feed twice.
  CONSTRAINT follows_not_self_chk CHECK (follower_id <> followee_id),
  CONSTRAINT follows_unique UNIQUE (follower_id, followee_id)
);

-- "Whose activities go in my feed" — the hot path, read on every feed load.
CREATE INDEX IF NOT EXISTS follows_follower_idx ON public.follows (follower_id);
-- "Who follows me" — the profile count and the follower list.
CREATE INDEX IF NOT EXISTS follows_followee_idx ON public.follows (followee_id);

CREATE TABLE IF NOT EXISTS public.blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT blocks_not_self_chk CHECK (blocker_id <> blocked_id),
  CONSTRAINT blocks_unique UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS blocks_blocker_idx ON public.blocks (blocker_id);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON public.blocks (blocked_id);

CREATE TABLE IF NOT EXISTS public.activity_kudos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.app_user_activities(id) ON DELETE CASCADE,
  app_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- One kudos per person per activity. The counter on the activity is kept in
  -- step with this table, and this constraint is what stops it drifting.
  CONSTRAINT activity_kudos_unique UNIQUE (activity_id, app_user_id)
);

CREATE TABLE IF NOT EXISTS public.activity_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.app_user_activities(id) ON DELETE CASCADE,
  app_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Soft delete: a removed comment leaves the thread readable rather than
  -- renumbering replies around a hole.
  deleted_at  timestamptz,

  CONSTRAINT activity_comments_body_chk CHECK (length(btrim(body)) BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS activity_comments_activity_idx
  ON public.activity_comments (activity_id, created_at);
