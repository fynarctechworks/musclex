-- Member-authored routines (2026-08-20).
--
-- WHY: a member repeating the same Push Day every Monday currently rebuilds it
-- from scratch every Monday. Trainer-assigned plans exist, but the TRAINER
-- authors those in the admin app; there is nothing a member can save and reuse.
--
-- Ownership: routines are PERSONAL. `member_id` is the owner and every read is
-- scoped to it, so one member's routines are invisible to another even inside
-- the same gym. They are NOT added to the gym's shared library — a member must
-- not be able to change what every other member at that gym sees.
--
-- Sharing is by link, not by visibility: `share_token` is a random, unguessable
-- id that resolves the routine read-only for anyone holding it, who can then
-- COPY it into their own collection. Copying rather than referencing means the
-- recipient's routine is theirs — the author editing or deleting theirs later
-- cannot change or remove someone else's.
--
-- `share_token` is NULL until the owner explicitly shares, so nothing is
-- reachable by link by default.
--
-- Additive and idempotent. studio_template AND every live studio_%.

DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT nspname FROM pg_namespace
    WHERE nspname = 'studio_template' OR nspname LIKE 'studio\_%'
  LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.member_routines (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        gym_id       uuid NOT NULL,
        member_id    uuid NOT NULL REFERENCES %I.members(id) ON DELETE CASCADE,
        title        text NOT NULL,
        notes        text,
        share_token  text UNIQUE,
        /* Set when this routine was copied from someone else's share link, so
           provenance survives and a copy is never mistaken for an original. */
        copied_from  uuid,
        last_used_at timestamptz,
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      )$f$, s, s);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.member_routine_exercises (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        gym_id       uuid NOT NULL,
        routine_id   uuid NOT NULL REFERENCES %I.member_routines(id) ON DELETE CASCADE,
        exercise_id  uuid NOT NULL,
        position     integer NOT NULL,
        target_sets  integer,
        target_reps  integer,
        /* For interval exercises, mirroring workout_set_logs. */
        target_seconds integer,
        created_at   timestamptz NOT NULL DEFAULT now()
      )$f$, s, s);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS member_routines_member_idx ON %I.member_routines (gym_id, member_id)', s);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS member_routine_exercises_routine_idx ON %I.member_routine_exercises (routine_id, position)', s);

    RAISE NOTICE 'member routines ready on %', s;
  END LOOP;
END $$;
