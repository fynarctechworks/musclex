-- ============================================================================
-- Phani Gym TEST DATA — full cleanup
-- Removes everything created by scripts/seed-phani-test.ts.
-- Scoped to gym_id = Phani Gym; touches ONLY tagged seed rows.
-- Run against the Supabase Postgres DB (psql or Supabase SQL editor / MCP).
-- ============================================================================

DO $$
DECLARE
  g uuid := '55243e01-170e-4346-a7cf-390658780dda';      -- Phani Gym
  trainer_ids uuid[];
  trainer_user_ids uuid[];
  member_ids uuid[];
BEGIN
  -- Collect seed trainer staff ids + their auth user ids
  SELECT array_agg(id), array_agg(user_id)
    INTO trainer_ids, trainer_user_ids
    FROM studio_template.staff
   WHERE gym_id = g AND employee_code LIKE 'PHT-TR-%';

  -- Collect seed member ids
  SELECT array_agg(id) INTO member_ids
    FROM studio_template.members
   WHERE gym_id = g AND member_code LIKE 'PHT-%';

  -- Classes + sessions taught by seed trainers
  IF trainer_ids IS NOT NULL THEN
    DELETE FROM studio_template.class_sessions WHERE gym_id = g AND trainer_id = ANY(trainer_ids);
    DELETE FROM studio_template.classes        WHERE gym_id = g AND trainer_id = ANY(trainer_ids);
  END IF;

  -- Member memberships + profiles + members
  IF member_ids IS NOT NULL THEN
    DELETE FROM studio_template.member_memberships WHERE gym_id = g AND member_id = ANY(member_ids);
    DELETE FROM studio_template.member_profiles    WHERE gym_id = g AND member_id = ANY(member_ids);
    DELETE FROM studio_template.members            WHERE gym_id = g AND id = ANY(member_ids);
  END IF;

  -- Trainer staff rows + RBAC (public schema)
  DELETE FROM studio_template.staff WHERE gym_id = g AND employee_code LIKE 'PHT-TR-%';
  IF trainer_user_ids IS NOT NULL THEN
    DELETE FROM public.user_roles      WHERE studio_id = g AND user_id = ANY(trainer_user_ids);
    DELETE FROM public.user_identities WHERE id = ANY(trainer_user_ids);
    -- Auth logins (cascades to auth.identities). Comment out to keep the logins.
    DELETE FROM auth.users WHERE id = ANY(trainer_user_ids);
  END IF;

  RAISE NOTICE 'Cleanup done. Removed % members, % trainers.',
    coalesce(array_length(member_ids,1),0), coalesce(array_length(trainer_ids,1),0);
END $$;
