-- Segments and efforts (2026-08-21).
--
-- ─── WHAT A SEGMENT IS ──────────────────────────────────────────────────────
--
-- A named stretch of road or trail that anyone can race. The hard part is not
-- storing it — it is deciding, for every activity uploaded, which segments that
-- activity actually covered. That is a spatial join, which is why PostGIS had
-- to come first.
--
-- ─── MATCHING IS NARROW-THEN-VERIFY ─────────────────────────────────────────
--
-- Comparing every activity against every segment is O(activities x segments)
-- and dies early. Instead:
--
--   1. NARROW  ST_DWithin on the segment's START point against the activity's
--              track, using the GIST index. Turns thousands of segments into a
--              handful of candidates with an index lookup.
--   2. VERIFY  check the track actually follows the candidate's geometry —
--              ST_DWithin between the lines, plus a length sanity check so a
--              road that merely crosses the segment does not count.
--
-- Without step 2 you award a KOM to somebody who drove past the end of it.
--
-- ─── EFFORTS ARE IMMUTABLE FACTS ────────────────────────────────────────────
--
-- One row per (activity, segment). Deleting the activity deletes the effort,
-- which is correct: if the ride did not happen, neither did the time.

CREATE TABLE IF NOT EXISTS public.segments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who created it. Segments are public by nature — the whole point is that
  -- other people race them — so there is no visibility column here.
  created_by     uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  name           text NOT NULL,
  sport_type     text,
  path           geography(LineString, 4326) NOT NULL,
  start_point    geography(Point, 4326) NOT NULL,
  end_point      geography(Point, 4326) NOT NULL,
  polyline       text,
  distance_m     numeric(10,2) NOT NULL,
  elevation_gain_m numeric(8,2),
  -- Denormalised so a leaderboard header does not aggregate on every read.
  effort_count   integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT segments_name_chk CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  -- Shorter than this is not a segment, it is a doorway; longer than 100 km is
  -- not something anyone races.
  CONSTRAINT segments_distance_chk CHECK (distance_m BETWEEN 50 AND 100000)
);

CREATE INDEX IF NOT EXISTS segments_start_gix ON public.segments USING GIST (start_point);
CREATE INDEX IF NOT EXISTS segments_path_gix ON public.segments USING GIST (path);
CREATE INDEX IF NOT EXISTS segments_sport_idx ON public.segments (sport_type);

CREATE TABLE IF NOT EXISTS public.segment_efforts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id      uuid NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
  activity_id     uuid NOT NULL REFERENCES public.app_user_activities(id) ON DELETE CASCADE,
  app_user_id     uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  elapsed_seconds integer NOT NULL,
  started_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- One effort per activity per segment. A lap round the same block should not
  -- put the same ride on the board twice.
  CONSTRAINT segment_efforts_unique UNIQUE (segment_id, activity_id),
  CONSTRAINT segment_efforts_time_chk CHECK (elapsed_seconds > 0 AND elapsed_seconds < 86400)
);

-- The leaderboard: fastest first, for one segment.
CREATE INDEX IF NOT EXISTS segment_efforts_board_idx
  ON public.segment_efforts (segment_id, elapsed_seconds);
-- "My times on this segment", and the personal-best comparison.
CREATE INDEX IF NOT EXISTS segment_efforts_person_idx
  ON public.segment_efforts (app_user_id, segment_id, elapsed_seconds);

CREATE TABLE IF NOT EXISTS public.segment_stars (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id  uuid NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
  app_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT segment_stars_unique UNIQUE (segment_id, app_user_id)
);

CREATE INDEX IF NOT EXISTS segment_stars_person_idx ON public.segment_stars (app_user_id);
