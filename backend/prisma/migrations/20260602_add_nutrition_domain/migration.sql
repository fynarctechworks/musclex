-- Nutrition domain for the Member App (V2.1): per-gym food catalog, logged
-- meals + their item macro snapshots, water logs, and per-member daily goals.
-- All tables are gym_id-scoped (studio_template) and registered in TENANT_MODELS
-- so the $use middleware + tenant extension auto-filter by gym_id. Idempotent +
-- additive; applied to staging via the Supabase migration tool (this DB's
-- _prisma_migrations history is untracked, so it is NOT deployed via
-- `prisma migrate deploy`).

CREATE TABLE IF NOT EXISTS studio_template.food_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id       uuid NOT NULL,
  name         text NOT NULL,
  brand        text,
  barcode      text,
  serving_size numeric(8,2) NOT NULL DEFAULT 100,
  serving_unit text NOT NULL DEFAULT 'g',
  kcal         numeric(8,2) NOT NULL DEFAULT 0,
  protein_g    numeric(7,2) NOT NULL DEFAULT 0,
  carbs_g      numeric(7,2) NOT NULL DEFAULT 0,
  fat_g        numeric(7,2) NOT NULL DEFAULT 0,
  source       text NOT NULL DEFAULT 'custom',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS food_items_gym_id_idx ON studio_template.food_items (gym_id);
CREATE INDEX IF NOT EXISTS food_items_gym_id_name_idx ON studio_template.food_items (gym_id, name);
CREATE INDEX IF NOT EXISTS food_items_gym_id_barcode_idx ON studio_template.food_items (gym_id, barcode);

CREATE TABLE IF NOT EXISTS studio_template.meal_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     uuid NOT NULL,
  member_id  uuid NOT NULL,
  meal_type  text NOT NULL DEFAULT 'snack',
  logged_at  timestamptz NOT NULL DEFAULT now(),
  notes      text,
  client_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meal_logs_member_id_fkey FOREIGN KEY (member_id)
    REFERENCES studio_template.members(id) ON DELETE CASCADE
);
-- Offline-outbox idempotency: a replayed client_key returns the original row.
CREATE UNIQUE INDEX IF NOT EXISTS meal_logs_gym_id_client_key_key
  ON studio_template.meal_logs (gym_id, client_key);
CREATE INDEX IF NOT EXISTS meal_logs_member_logged_idx
  ON studio_template.meal_logs (member_id, logged_at);

CREATE TABLE IF NOT EXISTS studio_template.meal_log_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id       uuid NOT NULL,
  meal_log_id  uuid NOT NULL,
  food_item_id uuid,
  name         text NOT NULL,
  quantity     numeric(8,2) NOT NULL DEFAULT 1,
  unit         text NOT NULL DEFAULT 'serving',
  kcal         numeric(8,2) NOT NULL DEFAULT 0,
  protein_g    numeric(7,2) NOT NULL DEFAULT 0,
  carbs_g      numeric(7,2) NOT NULL DEFAULT 0,
  fat_g        numeric(7,2) NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meal_log_items_meal_log_id_fkey FOREIGN KEY (meal_log_id)
    REFERENCES studio_template.meal_logs(id) ON DELETE CASCADE,
  CONSTRAINT meal_log_items_food_item_id_fkey FOREIGN KEY (food_item_id)
    REFERENCES studio_template.food_items(id)
);
CREATE INDEX IF NOT EXISTS meal_log_items_meal_log_idx ON studio_template.meal_log_items (meal_log_id);
CREATE INDEX IF NOT EXISTS meal_log_items_food_item_idx ON studio_template.meal_log_items (food_item_id);

CREATE TABLE IF NOT EXISTS studio_template.water_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     uuid NOT NULL,
  member_id  uuid NOT NULL,
  amount_ml  integer NOT NULL,
  logged_at  timestamptz NOT NULL DEFAULT now(),
  client_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT water_logs_member_id_fkey FOREIGN KEY (member_id)
    REFERENCES studio_template.members(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS water_logs_gym_id_client_key_key
  ON studio_template.water_logs (gym_id, client_key);
CREATE INDEX IF NOT EXISTS water_logs_member_logged_idx
  ON studio_template.water_logs (member_id, logged_at);

CREATE TABLE IF NOT EXISTS studio_template.nutrition_goals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id           uuid NOT NULL,
  member_id        uuid NOT NULL,
  kcal_target      integer NOT NULL DEFAULT 2000,
  protein_g_target integer NOT NULL DEFAULT 120,
  carbs_g_target   integer NOT NULL DEFAULT 220,
  fat_g_target     integer NOT NULL DEFAULT 60,
  water_ml_target  integer NOT NULL DEFAULT 2500,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_goals_member_id_fkey FOREIGN KEY (member_id)
    REFERENCES studio_template.members(id) ON DELETE CASCADE
);
-- One goal row per member.
CREATE UNIQUE INDEX IF NOT EXISTS nutrition_goals_member_id_key
  ON studio_template.nutrition_goals (member_id);
CREATE INDEX IF NOT EXISTS nutrition_goals_gym_id_idx ON studio_template.nutrition_goals (gym_id);
