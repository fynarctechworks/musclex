-- Mentions in comments (2026-08-21).
--
-- ─── WHY A TABLE AND NOT JUST TEXT ──────────────────────────────────────────
--
-- The comment body already carries the mention inline, so rendering needs no
-- table at all. This exists for the two questions text cannot answer: "who was
-- mentioned here" (for a notification, once push lands) and "where have I been
-- mentioned" — both of which would otherwise be a LIKE scan over every comment
-- ever written.
--
-- ─── A MENTION IS NOT A PERMISSION ──────────────────────────────────────────
--
-- Naming somebody grants nothing: it does not let them see an activity they
-- could not already see, and it does not let the author reach someone who has
-- blocked them. A mention of a blocked person is dropped at write time and the
-- text renders as plain words.

CREATE TABLE IF NOT EXISTS public.comment_mentions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  uuid NOT NULL REFERENCES public.activity_comments(id) ON DELETE CASCADE,
  app_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- Naming the same person twice in one comment is one mention.
  CONSTRAINT comment_mentions_unique UNIQUE (comment_id, app_user_id)
);

-- "Where have I been mentioned" — the whole reason this table exists.
CREATE INDEX IF NOT EXISTS comment_mentions_person_idx
  ON public.comment_mentions (app_user_id, created_at DESC);
