-- Shared routine snapshots (2026-08-20).
--
-- WHY this table was missing: `SharedRoutine` was added to schema.prisma and
-- schema.public.prisma and is used by member-routine.service.ts, but no
-- migration ever created it. It existed only in the local database, so applying
-- the migration set to a fresh environment produced a schema where every
-- share-link publish and import fails at the query.
--
-- WHY `public` and not per-tenant: a share link is followed by a member at a
-- DIFFERENT gym, and a per-studio schema is unreachable from another tenant's
-- session. Exercises are therefore stored as NAMES, not ids: exercise ids are
-- gym-scoped and each gym stocks a different catalogue, so an id means nothing
-- outside the gym that issued it. The importer re-matches by name against the
-- member's own gym and reports whatever that gym does not stock.
--
-- WHY no gym_id / member_id: deliberately none. The snapshot carries the
-- routine's name and its exercise names and nothing else, so following a link
-- reveals neither who authored it nor which gym they train at. That is also why
-- this model is correctly ABSENT from tenant-models.ts — it is not tenant state,
-- and auto-injecting gym_id here would break cross-gym import, which is the
-- entire point of the feature.
--
-- `token` is the primary key and is the unguessable share secret itself, so a
-- routine is reachable only by someone holding the link.
--
-- Idempotent and additive.

CREATE TABLE IF NOT EXISTS public.shared_routines (
  token        text PRIMARY KEY,
  name         text NOT NULL,
  -- [{ name, position, targetSets, targetReps, targetDurationSeconds }]
  exercises    jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  import_count integer NOT NULL DEFAULT 0
);
