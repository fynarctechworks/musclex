-- Friends: cross-gym social layer (2026-08-20).
--
-- ─── WHY EVERYTHING LIVES IN `public` ───────────────────────────────────────
--
-- Friendship is cross-gym by nature: the training partner who moved to another
-- studio is exactly who you want to compare with. But their workouts live in
-- THEIR gym's schema, and reading it would be a cross-tenant read — the single
-- worst failure this system can have.
--
-- So nothing here ever reads across a gym boundary. A member's own app PUBLISHES
-- the summary they opted into sharing out to `public`, and friends read only
-- from `public`. Privacy is then structural rather than a filter someone can
-- forget to apply, and the same pattern `shared_routines` already uses.
--
-- ─── WHY PRs ARE KEYED ON EXERCISE NAME ─────────────────────────────────────
--
-- exercise_id is gym-scoped: your "Barbell Bench Press" and your friend's are
-- different UUIDs issued by different gyms. An id is meaningless across the
-- boundary, so the comparison key is the lowercased NAME, exactly as routine
-- sharing and Explore already resolve.
--
-- ─── COST ───────────────────────────────────────────────────────────────────
--
-- Published sessions are the only table here that grows without bound, so the
-- publisher prunes rows older than 90 days on write. That needs no cron and no
-- scheduled job, and holds storage at roughly 40 rows per sharing member rather
-- than climbing forever. Everything else is naturally bounded: one PR row per
-- (member, exercise name), one kudos per person per session.
--
-- Sharing defaults to OFF, so a member who never opts in writes nothing at all.
--
-- Idempotent and additive. `public` only — no tenant schema is touched.

-- ─── Sharing switches ───────────────────────────────────────────────────────
-- On app_users rather than a separate preferences table: it is three booleans
-- about a person, and a table would add a join to every publish.
-- Default FALSE — accepting a friend request shares NOTHING until asked.
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS share_sessions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_prs      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_streak   boolean NOT NULL DEFAULT false;

-- ─── Friendships ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friendships (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  addressee_id  uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  -- 'pending'  — sent, not yet answered
  -- 'accepted' — mutual; the only state that grants any read
  -- 'blocked'  — addressee refused; kept so the requester cannot simply re-ask
  status        text NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now(),
  responded_at  timestamptz,
  CONSTRAINT friendships_status_chk CHECK (status IN ('pending', 'accepted', 'blocked')),
  -- Nobody friends themselves; without this the feed shows you your own sessions.
  CONSTRAINT friendships_not_self_chk CHECK (requester_id <> addressee_id)
);

-- One relationship per pair REGARDLESS of who asked. Without the least/greatest
-- normalisation, A→B and B→A are two rows, and accepting one leaves the other
-- pending forever.
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_uidx
  ON public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- "My friends", the query behind every screen here.
CREATE INDEX IF NOT EXISTS friendships_requester_idx ON public.friendships (requester_id, status);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON public.friendships (addressee_id, status);

-- ─── Published session summaries ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_user_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id    uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  -- The tenant workout_logs row this came from. Carried so a re-publish of the
  -- same session updates rather than duplicating, NOT for joining back into the
  -- gym schema — which is exactly what this table exists to avoid.
  source_log_id  uuid,
  performed_at   timestamptz NOT NULL,
  title          text,
  exercise_count integer NOT NULL DEFAULT 0,
  set_count      integer NOT NULL DEFAULT 0,
  -- Canonical kg, as everywhere else. Null for a session that moved no load.
  total_volume_kg numeric(10,2),
  duration_seconds integer,
  -- ["Barbell Bench Press", ...] — enough for a feed card and the "you both do
  -- this" hint, without storing every set.
  exercise_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  kudos_count    integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_user_sessions_source_uidx
  ON public.app_user_sessions (app_user_id, source_log_id)
  WHERE source_log_id IS NOT NULL;

-- The feed: a friend's sessions, newest first. Also the index the 90-day prune
-- uses, so retention costs no extra scan.
CREATE INDEX IF NOT EXISTS app_user_sessions_feed_idx
  ON public.app_user_sessions (app_user_id, performed_at DESC);

-- ─── Published personal records ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_user_prs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id   uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  -- Lowercased at write time so comparison is a plain equality rather than a
  -- function scan on every read.
  exercise_name text NOT NULL,
  weight_kg     numeric(6,2) NOT NULL,
  reps          integer NOT NULL,
  achieved_at   timestamptz NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_user_prs_reps_chk CHECK (reps > 0)
);

-- One PR per lift per person — upserted in place, never appended, which is what
-- keeps this table bounded.
CREATE UNIQUE INDEX IF NOT EXISTS app_user_prs_uidx
  ON public.app_user_prs (app_user_id, exercise_name);

-- ─── Kudos ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_kudos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.app_user_sessions(id) ON DELETE CASCADE,
  app_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One kudos per person per session; the UI toggles rather than accumulates.
CREATE UNIQUE INDEX IF NOT EXISTS session_kudos_uidx
  ON public.session_kudos (session_id, app_user_id);

-- ─── Routine sent to a friend ───────────────────────────────────────────────
-- Reuses shared_routines: the token already carries the name-keyed snapshot and
-- the importer already knows how to resolve it against the receiver's own gym.
-- This table is only the delivery record — who sent what to whom.
CREATE TABLE IF NOT EXISTS public.friend_routine_shares (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_app_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  to_app_user_id   uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token       text NOT NULL REFERENCES public.shared_routines(token) ON DELETE CASCADE,
  routine_name text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  imported_at timestamptz,
  CONSTRAINT friend_routine_shares_not_self_chk CHECK (from_app_user_id <> to_app_user_id)
);

-- The receiver's inbox: what has been sent to me, newest first.
CREATE INDEX IF NOT EXISTS friend_routine_shares_inbox_idx
  ON public.friend_routine_shares (to_app_user_id, created_at DESC);
