-- Workout domain for the Member App (Phase 1 core loop): exercise library,
-- workout plans + plan exercises, trainer assignments, logged sessions/sets,
-- and per-exercise personal records. All tables are gym_id-scoped (studio_template)
-- and registered in TENANT_MODELS so the $use middleware + tenant extension
-- auto-filter by gym_id. Idempotent + additive; applied to staging via the
-- Supabase migration tool (this DB's _prisma_migrations history is untracked,
-- so it is NOT deployed via `prisma migrate deploy`).

CREATE TABLE IF NOT EXISTS studio_template.exercises (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id       uuid NOT NULL,
  name         text NOT NULL,
  muscle_group text,
  equipment    text,
  media_url    text,
  instructions text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exercises_gym_id_idx ON studio_template.exercises (gym_id);
CREATE INDEX IF NOT EXISTS exercises_gym_id_muscle_group_idx ON studio_template.exercises (gym_id, muscle_group);

CREATE TABLE IF NOT EXISTS studio_template.workout_plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              uuid NOT NULL,
  title               text NOT NULL,
  description         text,
  goal                text,
  difficulty          text,
  created_by_staff_id uuid,
  is_template         boolean NOT NULL DEFAULT true,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workout_plans_created_by_staff_id_fkey FOREIGN KEY (created_by_staff_id)
    REFERENCES studio_template.staff(id)
);
CREATE INDEX IF NOT EXISTS workout_plans_gym_id_idx ON studio_template.workout_plans (gym_id);
CREATE INDEX IF NOT EXISTS workout_plans_gym_template_active_idx ON studio_template.workout_plans (gym_id, is_template, is_active);

CREATE TABLE IF NOT EXISTS studio_template.workout_plan_exercises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL,
  workout_plan_id uuid NOT NULL,
  exercise_id     uuid NOT NULL,
  position        integer NOT NULL DEFAULT 0,
  target_sets     integer NOT NULL DEFAULT 3,
  target_reps     integer NOT NULL DEFAULT 10,
  target_weight   numeric(6,2),
  rest_seconds    integer NOT NULL DEFAULT 60,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wpe_workout_plan_id_fkey FOREIGN KEY (workout_plan_id)
    REFERENCES studio_template.workout_plans(id) ON DELETE CASCADE,
  CONSTRAINT wpe_exercise_id_fkey FOREIGN KEY (exercise_id)
    REFERENCES studio_template.exercises(id)
);
CREATE INDEX IF NOT EXISTS wpe_plan_position_idx ON studio_template.workout_plan_exercises (workout_plan_id, position);

CREATE TABLE IF NOT EXISTS studio_template.assigned_workouts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id               uuid NOT NULL,
  member_id            uuid NOT NULL,
  workout_plan_id      uuid NOT NULL,
  assigned_by_staff_id uuid,
  scheduled_date       date NOT NULL,
  status               text NOT NULL DEFAULT 'assigned',
  completed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aw_member_id_fkey FOREIGN KEY (member_id)
    REFERENCES studio_template.members(id) ON DELETE CASCADE,
  CONSTRAINT aw_workout_plan_id_fkey FOREIGN KEY (workout_plan_id)
    REFERENCES studio_template.workout_plans(id),
  CONSTRAINT aw_assigned_by_staff_id_fkey FOREIGN KEY (assigned_by_staff_id)
    REFERENCES studio_template.staff(id)
);
CREATE INDEX IF NOT EXISTS aw_member_scheduled_idx ON studio_template.assigned_workouts (member_id, scheduled_date);
CREATE INDEX IF NOT EXISTS aw_member_status_idx ON studio_template.assigned_workouts (member_id, status);

CREATE TABLE IF NOT EXISTS studio_template.workout_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              uuid NOT NULL,
  member_id           uuid NOT NULL,
  assigned_workout_id uuid,
  workout_plan_id     uuid,
  client_key          text,
  logged_at           timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wl_member_id_fkey FOREIGN KEY (member_id)
    REFERENCES studio_template.members(id) ON DELETE CASCADE,
  CONSTRAINT wl_assigned_workout_id_fkey FOREIGN KEY (assigned_workout_id)
    REFERENCES studio_template.assigned_workouts(id),
  CONSTRAINT wl_workout_plan_id_fkey FOREIGN KEY (workout_plan_id)
    REFERENCES studio_template.workout_plans(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS wl_gym_client_key_key ON studio_template.workout_logs (gym_id, client_key);
CREATE INDEX IF NOT EXISTS wl_member_logged_idx ON studio_template.workout_logs (member_id, logged_at);

CREATE TABLE IF NOT EXISTS studio_template.workout_set_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id         uuid NOT NULL,
  workout_log_id uuid NOT NULL,
  exercise_id    uuid NOT NULL,
  set_number     integer NOT NULL,
  reps           integer NOT NULL,
  weight         numeric(6,2) NOT NULL DEFAULT 0,
  unit           text NOT NULL DEFAULT 'kg',
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wsl_workout_log_id_fkey FOREIGN KEY (workout_log_id)
    REFERENCES studio_template.workout_logs(id) ON DELETE CASCADE,
  CONSTRAINT wsl_exercise_id_fkey FOREIGN KEY (exercise_id)
    REFERENCES studio_template.exercises(id)
);
CREATE INDEX IF NOT EXISTS wsl_workout_log_idx ON studio_template.workout_set_logs (workout_log_id);
CREATE INDEX IF NOT EXISTS wsl_exercise_idx ON studio_template.workout_set_logs (exercise_id);

CREATE TABLE IF NOT EXISTS studio_template.personal_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id         uuid NOT NULL,
  member_id      uuid NOT NULL,
  exercise_id    uuid NOT NULL,
  weight         numeric(6,2) NOT NULL,
  reps           integer NOT NULL,
  unit           text NOT NULL DEFAULT 'kg',
  achieved_at    timestamptz NOT NULL DEFAULT now(),
  workout_log_id uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pr_member_id_fkey FOREIGN KEY (member_id)
    REFERENCES studio_template.members(id) ON DELETE CASCADE,
  CONSTRAINT pr_exercise_id_fkey FOREIGN KEY (exercise_id)
    REFERENCES studio_template.exercises(id),
  CONSTRAINT pr_workout_log_id_fkey FOREIGN KEY (workout_log_id)
    REFERENCES studio_template.workout_logs(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS pr_member_exercise_key ON studio_template.personal_records (member_id, exercise_id);
CREATE INDEX IF NOT EXISTS pr_member_idx ON studio_template.personal_records (member_id);
