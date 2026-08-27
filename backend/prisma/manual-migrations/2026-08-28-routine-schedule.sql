-- ────────────────────────────────────────────────────────────────
-- Weekly routine schedules, and routine provenance on a logged workout
-- ────────────────────────────────────────────────────────────────
--
-- WHY THIS EXISTS
-- Routines carried a name, notes and a list of exercises — and no schedule.
-- Two consequences, both visible on the home screen every day:
--
--   * Home.todayWorkout is built only from assigned_workouts, which a trainer
--     writes. A self-directed member had NO path to a non-null value, so the
--     most prominent card on the home screen read "Nothing assigned today"
--     permanently for anyone without a trainer — against the app's own line
--     that a gym is a bonus rather than a requirement.
--   * nothing could be "missed", because nothing was ever planned.
--
-- WHAT IS ADDED
--   1. studio_template.member_routine_schedule  (per-weekday routine, gym members)
--   2. public.app_user_routine_schedule         (the same, gym-less members)
--   3. members.schedule_offset_days             (how far the week has slid)
--   4. workout_logs.routine_id                  (which routine a session was)
--
-- (3) is what makes "resume yesterday's, shift the week forward" reversible.
-- A weekday->routine map has no anchor, so shifting by rewriting the rows would
-- permanently rewrite the days the member chose: a Monday person quietly
-- becomes a Tuesday person, and a second missed day compounds it. Holding the
-- shift as an offset applied at RESOLUTION time keeps their stated week intact
-- and makes "back to my normal week" a reset to 0.
--
-- (4) exists because workout_logs recorded assigned_workout_id and
-- workout_plan_id but never a routine. The only answerable question was "did
-- they train that day", which is far too weak to conclude a member missed their
-- scheduled leg day and to move a whole week's plan on the strength of it.
--
-- PURELY ADDITIVE AND IDEMPOTENT
--   * only CREATE TABLE / ADD COLUMN / CREATE INDEX, all IF NOT EXISTS
--   * FKs are guarded on pg_constraint because ADD CONSTRAINT has no
--     IF NOT EXISTS, so an unguarded re-run fails on the second pass
--   * nothing is dropped, nothing is rewritten, no existing row is touched
--   * no backfill: every member starts with no schedule, which is the correct
--     initial state and reads as "nothing set up yet"
--
-- Deliberately NO BEGIN/COMMIT here: the applier wraps each file in its own
-- transaction, which is what lets it be rehearsed and rolled back. A file that
-- commits itself silently ends that transaction and makes the rehearsal a lie.
--
-- studio_template is INCLUDED in the loop below (unlike the expense fan-out,
-- which was repairing schemas the template already had) — this is new DDL, so
-- the template needs it too, and future gyms are provisioned from it.

DO $mig$
DECLARE
  s record;
BEGIN
  FOR s IN
    SELECT nspname FROM pg_namespace
     WHERE nspname LIKE 'studio\_%'
     ORDER BY nspname
  LOOP
    -- A studio schema with no members table is not one this migration
    -- describes; skip rather than fail the whole run.
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = s.nspname AND table_name = 'members'
    );

    -- ── 1. the schedule ────────────────────────────────────────────
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.member_routine_schedule (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        gym_id     uuid NOT NULL,
        member_id  uuid NOT NULL,
        routine_id uuid NOT NULL,
        weekday    smallint NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    $f$, s.nspname);

    -- One weekday resolves to exactly one routine. Enforced by the database
    -- rather than the app: a weekday[] column could not express it.
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS member_routine_schedule_member_weekday_key
         ON %I.member_routine_schedule (member_id, weekday)', s.nspname);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS member_routine_schedule_gym_member_idx
         ON %I.member_routine_schedule (gym_id, member_id)', s.nspname);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS member_routine_schedule_routine_idx
         ON %I.member_routine_schedule (routine_id)', s.nspname);

    -- 0 = Sunday .. 6 = Saturday. Checked in the database because an
    -- out-of-range weekday would silently never resolve to a workout.
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'member_routine_schedule_weekday_range'
         AND connamespace = s.nspname::regnamespace
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.member_routine_schedule
           ADD CONSTRAINT member_routine_schedule_weekday_range
           CHECK (weekday BETWEEN 0 AND 6)', s.nspname);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'member_routine_schedule_member_fk'
         AND connamespace = s.nspname::regnamespace
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.member_routine_schedule
           ADD CONSTRAINT member_routine_schedule_member_fk
           FOREIGN KEY (member_id) REFERENCES %I.members(id) ON DELETE CASCADE',
        s.nspname, s.nspname);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'member_routine_schedule_routine_fk'
         AND connamespace = s.nspname::regnamespace
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.member_routine_schedule
           ADD CONSTRAINT member_routine_schedule_routine_fk
           FOREIGN KEY (routine_id) REFERENCES %I.member_routines(id) ON DELETE CASCADE',
        s.nspname, s.nspname);
    END IF;

    -- ── 2. how far the week has slid ───────────────────────────────
    EXECUTE format(
      'ALTER TABLE %I.members
         ADD COLUMN IF NOT EXISTS schedule_offset_days integer NOT NULL DEFAULT 0',
      s.nspname);

    -- ── 3. routine provenance on a logged workout ──────────────────
    EXECUTE format(
      'ALTER TABLE %I.workout_logs ADD COLUMN IF NOT EXISTS routine_id uuid',
      s.nspname);

    -- Answers "was yesterday's scheduled routine actually done" in one hit.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS workout_logs_member_routine_logged_idx
         ON %I.workout_logs (member_id, routine_id, logged_at)', s.nspname);

    -- ON DELETE SET NULL, not CASCADE: deleting a routine must never delete
    -- the history of workouts done from it. The session happened.
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'workout_logs_routine_fk'
         AND connamespace = s.nspname::regnamespace
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.workout_logs
           ADD CONSTRAINT workout_logs_routine_fk
           FOREIGN KEY (routine_id) REFERENCES %I.member_routines(id) ON DELETE SET NULL',
        s.nspname, s.nspname);
    END IF;

    RAISE NOTICE 'routine schedule applied to %', s.nspname;
  END LOOP;
END
$mig$;

-- ── 4. the gym-less half, in public ──────────────────────────────
--
-- Keyed by app_user and living in public, so it has NO gym_id. It must never
-- enter the tenant model set: injecting a gym filter here would reference a
-- column that does not exist.

CREATE TABLE IF NOT EXISTS public.app_user_routine_schedule (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid NOT NULL,
  routine_id  uuid NOT NULL,
  weekday     smallint NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_user_routine_schedule_user_weekday_key
  ON public.app_user_routine_schedule (app_user_id, weekday);
CREATE INDEX IF NOT EXISTS app_user_routine_schedule_routine_idx
  ON public.app_user_routine_schedule (routine_id);

DO $pub$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_user_routine_schedule_weekday_range'
  ) THEN
    ALTER TABLE public.app_user_routine_schedule
      ADD CONSTRAINT app_user_routine_schedule_weekday_range
      CHECK (weekday BETWEEN 0 AND 6);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_user_routine_schedule_user_fk'
  ) THEN
    ALTER TABLE public.app_user_routine_schedule
      ADD CONSTRAINT app_user_routine_schedule_user_fk
      FOREIGN KEY (app_user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_user_routine_schedule_routine_fk'
  ) THEN
    ALTER TABLE public.app_user_routine_schedule
      ADD CONSTRAINT app_user_routine_schedule_routine_fk
      FOREIGN KEY (routine_id) REFERENCES public.app_user_routines(id) ON DELETE CASCADE;
  END IF;
END
$pub$;
