-- Trainer-assigned diet plans + member AI coach conversations (2026-07-16).
-- Mirrors the 20260601 workout domain: gym_id-scoped tables in studio_template,
-- registered in TENANT_MODELS. Idempotent + additive. Applied via the Supabase
-- migration tool to studio_template AND every live studio_% schema (this DB's
-- _prisma_migrations history is untracked — NOT deployed via prisma migrate).

CREATE TABLE IF NOT EXISTS studio_template.diet_plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              uuid NOT NULL,
  title               text NOT NULL,
  description         text,
  goal                text,
  daily_calories      integer,
  protein_g           integer,
  carbs_g             integer,
  fat_g               integer,
  created_by_staff_id uuid,
  is_template         boolean NOT NULL DEFAULT true,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diet_plans_created_by_staff_id_fkey FOREIGN KEY (created_by_staff_id)
    REFERENCES studio_template.staff(id)
);
CREATE INDEX IF NOT EXISTS diet_plans_gym_id_idx ON studio_template.diet_plans (gym_id);
CREATE INDEX IF NOT EXISTS diet_plans_gym_template_active_idx ON studio_template.diet_plans (gym_id, is_template, is_active);

CREATE TABLE IF NOT EXISTS studio_template.diet_plan_meals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id       uuid NOT NULL,
  diet_plan_id uuid NOT NULL,
  meal_type    text NOT NULL,
  position     integer NOT NULL DEFAULT 0,
  title        text NOT NULL,
  items        jsonb NOT NULL DEFAULT '[]',
  calories     integer,
  protein_g    integer,
  carbs_g      integer,
  fat_g        integer,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diet_plan_meals_diet_plan_id_fkey FOREIGN KEY (diet_plan_id)
    REFERENCES studio_template.diet_plans(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS diet_plan_meals_plan_position_idx ON studio_template.diet_plan_meals (diet_plan_id, position);

CREATE TABLE IF NOT EXISTS studio_template.assigned_diet_plans (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id               uuid NOT NULL,
  member_id            uuid NOT NULL,
  diet_plan_id         uuid NOT NULL,
  assigned_by_staff_id uuid,
  starts_on            date NOT NULL,
  ends_on              date,
  status               text NOT NULL DEFAULT 'active',
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assigned_diet_plans_member_id_fkey FOREIGN KEY (member_id)
    REFERENCES studio_template.members(id) ON DELETE CASCADE,
  CONSTRAINT assigned_diet_plans_diet_plan_id_fkey FOREIGN KEY (diet_plan_id)
    REFERENCES studio_template.diet_plans(id),
  CONSTRAINT assigned_diet_plans_assigned_by_staff_id_fkey FOREIGN KEY (assigned_by_staff_id)
    REFERENCES studio_template.staff(id)
);
CREATE INDEX IF NOT EXISTS assigned_diet_plans_member_status_idx ON studio_template.assigned_diet_plans (member_id, status);
CREATE INDEX IF NOT EXISTS assigned_diet_plans_plan_idx ON studio_template.assigned_diet_plans (diet_plan_id);

CREATE TABLE IF NOT EXISTS studio_template.member_ai_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     uuid NOT NULL,
  member_id  uuid NOT NULL,
  messages   jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_ai_conversations_member_id_fkey FOREIGN KEY (member_id)
    REFERENCES studio_template.members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS member_ai_conversations_member_idx ON studio_template.member_ai_conversations (member_id);
