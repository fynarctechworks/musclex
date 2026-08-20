-- Activities: GPS and manual workouts of every sport (2026-08-20).
--
-- ─── WHY `public`, NOT A STUDIO SCHEMA ──────────────────────────────────────
--
-- A run in a park has no gym. Tying an activity to a studio schema would mean a
-- member who changes gyms loses their training history, and a member with no
-- gym at all cannot record one — both wrong. Activities therefore belong to the
-- app_user, beside friendships, published sessions and health rollups, and the
-- tenant model set is not touched at all. Check-ins, classes and membership stay
-- gym-scoped where they belong.
--
-- ─── WHY STREAMS ARE ARRAYS, NOT ROWS ───────────────────────────────────────
--
-- A three-hour ride sampled at 1 Hz is ~11,000 points. One row per point per
-- stream would be ~70,000 rows for a single afternoon, and a member with a year
-- of riding would carry millions — for data that is only ever read whole, to
-- draw one chart. Each stream is stored as a single JSON array instead, so an
-- activity is a handful of rows however long the ride.
--
-- `polyline` on the activity is a separate, heavily simplified copy for map
-- previews. A feed of twenty activities must not fetch twenty full tracks.
--
-- ─── PRIVACY ────────────────────────────────────────────────────────────────
--
-- `visibility` is stored per activity and defaults to 'followers', not
-- 'everyone'. Precise location traces are the most sensitive data this product
-- has ever held: they reveal a home address, a daily schedule and when a house
-- is empty. Defaulting them to public would be a decision made on a member's
-- behalf that they cannot undo once it is indexed.
--
-- `privacy_zone_m` hides a radius around the start and end of the track when it
-- is rendered for anyone else. Null means the member has not set one.

CREATE TABLE IF NOT EXISTS public.app_user_activities (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id        uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,

  -- One of the SPORT_TYPES list in the API. Deliberately text with a check
  -- rather than a pg enum: Strava adds sports regularly, and adding a value to
  -- a pg enum inside a transaction locks the table.
  sport_type         text NOT NULL,
  title              text,
  description        text,

  -- 'gps'    recorded by us          'manual' typed in by the member
  -- 'import' from a GPX/FIT file     'device' synced from a partner
  source             text NOT NULL DEFAULT 'manual',

  started_at         timestamptz NOT NULL,
  ended_at           timestamptz,
  -- Elapsed is wall clock; moving excludes auto-paused time. A ride with a long
  -- coffee stop has very different numbers, and both are worth keeping.
  elapsed_seconds    integer NOT NULL DEFAULT 0,
  moving_seconds     integer,

  distance_m         numeric(10,2),
  elevation_gain_m   numeric(8,2),
  elevation_loss_m   numeric(8,2),
  avg_speed_mps      numeric(6,3),
  max_speed_mps      numeric(6,3),

  avg_heart_rate     integer,
  max_heart_rate     integer,
  calories           integer,

  -- Simplified track for map previews, Google encoded-polyline format. Null for
  -- a manual entry or an indoor session, which is not an error — it is a
  -- workout that happened in one place.
  polyline           text,
  start_latitude     numeric(10,7),
  start_longitude    numeric(10,7),

  visibility         text NOT NULL DEFAULT 'followers',
  -- Metres of track hidden at each end when someone else views this.
  privacy_zone_m     integer,

  kudos_count        integer NOT NULL DEFAULT 0,
  comment_count      integer NOT NULL DEFAULT 0,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT activities_source_chk
    CHECK (source IN ('gps', 'manual', 'import', 'device')),
  CONSTRAINT activities_visibility_chk
    CHECK (visibility IN ('everyone', 'followers', 'only_me')),
  -- An activity that ends before it starts is corrupt input, not a short one.
  CONSTRAINT activities_span_chk
    CHECK (ended_at IS NULL OR ended_at >= started_at),
  CONSTRAINT activities_elapsed_chk
    CHECK (elapsed_seconds >= 0 AND elapsed_seconds <= 604800),
  CONSTRAINT activities_distance_chk
    CHECK (distance_m IS NULL OR distance_m >= 0)
);

-- The feed and the member's own list both read newest-first for one person.
CREATE INDEX IF NOT EXISTS app_user_activities_owner_idx
  ON public.app_user_activities (app_user_id, started_at DESC);

-- "How much have I run this month" filters by sport before date.
CREATE INDEX IF NOT EXISTS app_user_activities_sport_idx
  ON public.app_user_activities (app_user_id, sport_type, started_at DESC);

CREATE TABLE IF NOT EXISTS public.app_user_activity_streams (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id  uuid NOT NULL REFERENCES public.app_user_activities(id) ON DELETE CASCADE,
  -- latlng | time | distance | altitude | heartrate | cadence | velocity |
  -- watts | temperature | moving
  type         text NOT NULL,
  -- The whole series as one array. Read whole, written once.
  data         jsonb NOT NULL DEFAULT '[]'::jsonb,
  point_count  integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- One series of each type per activity, so a resumed upload replaces rather
  -- than appends a second copy of the same ride.
  CONSTRAINT activity_streams_unique UNIQUE (activity_id, type),
  CONSTRAINT activity_streams_count_chk CHECK (point_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.app_user_activity_laps (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id      uuid NOT NULL REFERENCES public.app_user_activities(id) ON DELETE CASCADE,
  lap_index        integer NOT NULL,
  elapsed_seconds  integer NOT NULL DEFAULT 0,
  moving_seconds   integer,
  distance_m       numeric(10,2),
  avg_heart_rate   integer,
  max_heart_rate   integer,
  -- Where this lap sits in the streams above, so a lap can be highlighted on
  -- the chart without storing its points a second time.
  start_index      integer,
  end_index        integer,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT activity_laps_unique UNIQUE (activity_id, lap_index)
);

CREATE TABLE IF NOT EXISTS public.app_user_activity_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id  uuid NOT NULL REFERENCES public.app_user_activities(id) ON DELETE CASCADE,
  -- Storage path in the private bucket. Served as a signed URL, never public.
  storage_path text NOT NULL,
  is_primary   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_user_activity_photos_activity_idx
  ON public.app_user_activity_photos (activity_id);
