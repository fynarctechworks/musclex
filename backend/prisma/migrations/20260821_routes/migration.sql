-- Routes, and PostGIS (2026-08-21).
--
-- ─── WHY POSTGIS NOW ────────────────────────────────────────────────────────
--
-- "Routes near me" and, later, segment matching are spatial questions. Answered
-- without PostGIS they become "fetch every route and measure them in Node",
-- which works at ten routes and falls over at ten thousand. The extension is
-- available on this project (3.3.7) and was simply never enabled.
--
-- ─── TWO COPIES OF THE SAME LINE, ON PURPOSE ────────────────────────────────
--
-- `path` is a geography LineString, indexed, and exists to be QUERIED — how far
-- is this from me, does it cross that. `polyline` is the encoded copy the app
-- draws, small enough to sit on a row that a list renders twenty of at a time.
-- Deriving one from the other on every read would mean either decoding in the
-- client or a PostGIS call per row of a list.
--
-- ─── START POINT IS SEPARATE ────────────────────────────────────────────────
--
-- Nearly every query is "routes starting near here", and asking that of the
-- whole line means measuring distance to a shape rather than to a point. The
-- start is stored and indexed on its own so the common case is an index hit.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS public.routes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id    uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  description    text,
  -- One of SPORT_TYPES, or null for "any".
  sport_type     text,
  -- gpx | drawn | activity — where the line came from. An imported route and
  -- one traced from a ride you actually did are different things to a member.
  source         text NOT NULL DEFAULT 'drawn',
  -- The line itself, for spatial queries.
  path           geography(LineString, 4326),
  -- Indexed separately: "routes starting near me" is nearly every query.
  start_point    geography(Point, 4326),
  -- The encoded copy the app draws. Simplified; never used for maths.
  polyline       text,
  distance_m     numeric(10,2),
  elevation_gain_m numeric(8,2),
  -- everyone | only_me. A saved route usually starts at somebody's front door,
  -- so it follows the same default as an activity: not public.
  visibility     text NOT NULL DEFAULT 'only_me',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT routes_name_chk CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT routes_source_chk CHECK (source IN ('gpx', 'drawn', 'activity')),
  CONSTRAINT routes_visibility_chk CHECK (visibility IN ('everyone', 'only_me')),
  CONSTRAINT routes_distance_chk CHECK (distance_m IS NULL OR distance_m >= 0)
);

CREATE INDEX IF NOT EXISTS routes_owner_idx ON public.routes (app_user_id, created_at DESC);
-- GIST is what makes ST_DWithin an index lookup rather than a full scan.
CREATE INDEX IF NOT EXISTS routes_start_gix ON public.routes USING GIST (start_point);
CREATE INDEX IF NOT EXISTS routes_path_gix ON public.routes USING GIST (path);
