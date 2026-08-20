-- Direct messages, reporting, and who may start a conversation (2026-08-21).
--
-- ─── MODERATION IS PART OF THIS MIGRATION, NOT A LATER ONE ──────────────────
--
-- A DM is the first feature where a stranger can put text in front of someone
-- who did not ask for it. Shipping that without a report path means the first
-- member who needs one does not have it, and "we'll add it next sprint" is not
-- an answer when it is happening to them now.
--
-- ─── WHO MAY MESSAGE YOU ────────────────────────────────────────────────────
--
-- `message_privacy` on app_users mirrors the control Strava exposes, and
-- defaults to 'followers' rather than 'everyone'. An open inbox is a choice
-- somebody should make deliberately, not one they discover after the fact.
--
-- ─── ONE CONVERSATION PER PAIR ──────────────────────────────────────────────
--
-- Enforced by a unique index on the ordered pair, the same least/greatest trick
-- `friendships` uses. Without it, two people opening a thread at the same
-- moment create two conversations and each sees half the messages.

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS message_privacy text NOT NULL DEFAULT 'followers';

DO $$
BEGIN
  ALTER TABLE public.app_users
    ADD CONSTRAINT app_users_message_privacy_chk
    CHECK (message_privacy IN ('everyone', 'followers', 'nobody'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The pair, stored ordered so the unique index below can do its job.
  member_a_id     uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  member_b_id     uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT conversations_not_self_chk CHECK (member_a_id <> member_b_id),
  -- a < b always, so (x,y) and (y,x) cannot both exist.
  CONSTRAINT conversations_ordered_chk CHECK (member_a_id < member_b_id),
  CONSTRAINT conversations_pair_unique UNIQUE (member_a_id, member_b_id)
);

CREATE INDEX IF NOT EXISTS conversations_a_idx ON public.conversations (member_a_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_b_idx ON public.conversations (member_b_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Soft delete: the sender can retract, and the thread stays readable.
  deleted_at      timestamptz,

  CONSTRAINT direct_messages_body_chk CHECK (length(btrim(body)) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS direct_messages_thread_idx
  ON public.direct_messages (conversation_id, created_at);

-- Read state per person, not per message: "unread since" is all the UI needs
-- and it is one row per participant rather than one per message per reader.
CREATE TABLE IF NOT EXISTS public.conversation_reads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  app_user_id     uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  last_read_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT conversation_reads_unique UNIQUE (conversation_id, app_user_id)
);

CREATE TABLE IF NOT EXISTS public.reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  -- Who is being reported. Kept even if the target row is later removed, which
  -- is exactly when the report matters most.
  reported_id  uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  -- message | comment | activity | profile | club
  target_kind  text NOT NULL,
  target_id    uuid,
  reason       text NOT NULL,
  note         text,
  -- open | reviewed | actioned | dismissed
  status       text NOT NULL DEFAULT 'open',
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reports_kind_chk
    CHECK (target_kind IN ('message', 'comment', 'activity', 'profile', 'club')),
  CONSTRAINT reports_status_chk
    CHECK (status IN ('open', 'reviewed', 'actioned', 'dismissed')),
  CONSTRAINT reports_reason_chk CHECK (length(btrim(reason)) BETWEEN 2 AND 60)
);

CREATE INDEX IF NOT EXISTS reports_triage_idx ON public.reports (status, created_at);
