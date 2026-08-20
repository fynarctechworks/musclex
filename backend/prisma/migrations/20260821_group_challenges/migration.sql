-- Group challenges: member-created contests between friends (2026-08-21).
--
-- ─── NOT THE SAME AS `challenges` ───────────────────────────────────────────
--
-- The existing `challenges` table is GYM-run: staff create them, they live in
-- the studio schema, and everyone at that gym can join. These are made by
-- MEMBERS, span gyms, and only the people invited take part. Different owner,
-- different scope, different table — in `public`, with no gym_id.
--
-- ─── PROGRESS IS COMPUTED, NEVER STORED ─────────────────────────────────────
--
-- A stored total drifts the moment an activity is edited or deleted, and the
-- leaderboard is then quietly wrong for the rest of the challenge with no way
-- to notice. It is summed from activities on read instead: always right, and
-- one indexed aggregate per participant.
--
-- ─── JOINING IS THE CONSENT ─────────────────────────────────────────────────
--
-- Inside a challenge, every participant's total for the chosen metric is
-- visible to the others — that is what a leaderboard is. It exposes a SUM, not
-- the activities behind it: an activity marked only_me still never appears
-- anywhere, it just counts toward a number the member opted in to publishing.

CREATE TABLE IF NOT EXISTS public.group_challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  -- distance_m | elapsed_seconds | activity_count | elevation_m
  metric      text NOT NULL DEFAULT 'distance_m',
  -- Null means "any sport"; set it and only that sport counts.
  sport_type  text,
  -- Null target means "most wins" rather than "first to reach".
  target      numeric(12,2),
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT group_challenges_metric_chk
    CHECK (metric IN ('distance_m', 'elapsed_seconds', 'activity_count', 'elevation_m')),
  CONSTRAINT group_challenges_title_chk CHECK (length(btrim(title)) BETWEEN 2 AND 80),
  -- A challenge that ends before it starts can never be entered.
  CONSTRAINT group_challenges_window_chk CHECK (ends_on >= starts_on),
  CONSTRAINT group_challenges_target_chk CHECK (target IS NULL OR target > 0)
);

CREATE TABLE IF NOT EXISTS public.group_challenge_participants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.group_challenges(id) ON DELETE CASCADE,
  app_user_id  uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  joined_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT group_challenge_participants_unique UNIQUE (challenge_id, app_user_id)
);

-- "Which challenges am I in" — how this table is read on every list.
CREATE INDEX IF NOT EXISTS group_challenge_participants_person_idx
  ON public.group_challenge_participants (app_user_id);
