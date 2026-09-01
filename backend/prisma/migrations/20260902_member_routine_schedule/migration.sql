-- Routine scheduling: schema.prisma gained MemberRoutineSchedule,
-- members.schedule_offset_days and workout_logs.routine_id, but no migration
-- was ever generated. The live DB lacks all three, so every Prisma query that
-- selects Member.* fails with P2022 — this is what 500s /api/v1/members.
--
-- Idempotent + propagated across studio_template AND every live studio_* schema,
-- matching the convention in scripts/run-pending-migrations.ts.
DO $$
DECLARE s text;
BEGIN
  FOR s IN
    SELECT nspname FROM pg_namespace
    WHERE nspname = 'studio_template' OR nspname LIKE 'studio\_%'
    ORDER BY nspname
  LOOP
    EXECUTE format('ALTER TABLE %I.members ADD COLUMN IF NOT EXISTS schedule_offset_days integer NOT NULL DEFAULT 0', s);
    EXECUTE format('ALTER TABLE %I.workout_logs ADD COLUMN IF NOT EXISTS routine_id uuid', s);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.member_routine_schedule (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        gym_id     uuid NOT NULL,
        member_id  uuid NOT NULL,
        routine_id uuid NOT NULL,
        weekday    smallint NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )$f$, s);

    -- One weekday resolves to exactly one routine (enforced in the DB).
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS member_routine_schedule_member_weekday_key ON %I.member_routine_schedule (member_id, weekday)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS member_routine_schedule_gym_member_idx ON %I.member_routine_schedule (gym_id, member_id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS member_routine_schedule_routine_idx ON %I.member_routine_schedule (routine_id)', s);
  END LOOP;
END $$;
