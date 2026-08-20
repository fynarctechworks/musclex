-- Explore: a central, MuscleX-curated workout library (2026-08-20).
--
-- WHY a `public` table and not per-tenant: this content is written once by us
-- and seen identically by every member at every gym. Copying it into 4 (or 400)
-- studio schemas would mean 400 places to update when a workout changes, and a
-- gym could silently drift from the canonical set.
--
-- Exercises are stored as NAMES, exactly as `shared_routines` does and for the
-- same reason: exercise ids are gym-scoped and gyms hold different catalogues,
-- so an id is meaningless outside the gym that issued it. Adding an Explore
-- workout re-matches by name against the member's own gym and reports whatever
-- that gym does not stock.
--
-- No member or gym data lives here. It is content, not tenant state.
--
-- Idempotent and additive.

CREATE TABLE IF NOT EXISTS public.explore_workouts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable, human-readable key so a workout can be linked to and re-seeded
  -- without depending on a generated id.
  slug             text UNIQUE NOT NULL,
  title            text NOT NULL,
  description      text,
  category         text NOT NULL,
  difficulty       text NOT NULL DEFAULT 'beginner',
  duration_minutes integer,
  -- [{ name, position, targetSets, targetReps, targetDurationSeconds }]
  exercises        jsonb NOT NULL,
  -- Unpublished rows are invisible to members, so a workout can be drafted and
  -- corrected before anyone sees it.
  is_published     boolean NOT NULL DEFAULT false,
  position         integer NOT NULL DEFAULT 0,
  add_count        integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'explore_workouts_difficulty_chk'
  ) THEN
    ALTER TABLE public.explore_workouts
      ADD CONSTRAINT explore_workouts_difficulty_chk
      CHECK (difficulty IN ('beginner', 'intermediate', 'advanced'));
  END IF;
END $$;

-- The only member-facing query is "published, by category, in order".
CREATE INDEX IF NOT EXISTS explore_workouts_browse_idx
  ON public.explore_workouts (category, position)
  WHERE is_published;
