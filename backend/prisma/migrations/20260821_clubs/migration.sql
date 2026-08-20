-- Clubs and club events (2026-08-21).
--
-- ─── A CLUB IS NOT A GYM ────────────────────────────────────────────────────
--
-- Gyms are tenants, with membership, billing and staff. A club is a group of
-- PEOPLE who train together — often across gyms, sometimes at none. So this
-- lives in `public` beside follows and activities, carries no gym_id, and
-- never joins into a studio schema.
--
-- ─── PRIVATE MEANS UNLISTED, NOT LOCKED ─────────────────────────────────────
--
-- A `private` club is simply absent from discovery: you join it because
-- somebody gave you the link. Deliberately NOT a join-request queue — that
-- needs an approvals inbox, notifications and a moderation story, and half of
-- one is worse than none. When we need real gating it gets built properly.
--
-- ─── THE CLUB FEED HAS NO RULES OF ITS OWN ──────────────────────────────────
--
-- It is "activities by people in this club", passed through the SAME visibility
-- filter the main feed uses. Joining a club must not become a way to see
-- activities a member chose not to share.

CREATE TABLE IF NOT EXISTS public.clubs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  -- Null means "any sport" — a running club filters, a gym club usually does not.
  sport_type   text,
  city         text,
  visibility   text NOT NULL DEFAULT 'public',
  member_count integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT clubs_visibility_chk CHECK (visibility IN ('public', 'private')),
  CONSTRAINT clubs_name_chk CHECK (length(btrim(name)) BETWEEN 2 AND 80)
);

-- Discovery lists public clubs newest-first, optionally by sport.
CREATE INDEX IF NOT EXISTS clubs_discovery_idx
  ON public.clubs (visibility, created_at DESC);

CREATE TABLE IF NOT EXISTS public.club_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  app_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  -- owner  the one who made it; cannot leave without handing it over
  -- admin   may post events and remove members
  -- member  everyone else
  role        text NOT NULL DEFAULT 'member',
  joined_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT club_members_role_chk CHECK (role IN ('owner', 'admin', 'member')),
  CONSTRAINT club_members_unique UNIQUE (club_id, app_user_id)
);

CREATE INDEX IF NOT EXISTS club_members_person_idx ON public.club_members (app_user_id);

CREATE TABLE IF NOT EXISTS public.club_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_by     uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  title          text NOT NULL,
  description    text,
  starts_at      timestamptz NOT NULL,
  location_name  text,
  latitude       numeric(10,7),
  longitude      numeric(10,7),
  attendee_count integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT club_events_title_chk CHECK (length(btrim(title)) BETWEEN 2 AND 120)
);

-- "What's coming up in this club" — the only way this table is ever read.
CREATE INDEX IF NOT EXISTS club_events_upcoming_idx
  ON public.club_events (club_id, starts_at);

CREATE TABLE IF NOT EXISTS public.event_attendees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
  app_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  -- 'going' is a commitment other people plan around; 'interested' is not.
  status      text NOT NULL DEFAULT 'going',
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT event_attendees_status_chk CHECK (status IN ('going', 'interested')),
  CONSTRAINT event_attendees_unique UNIQUE (event_id, app_user_id)
);
