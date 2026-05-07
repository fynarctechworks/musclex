-- Expense Event System Migration
-- Transforms expenses into an append-only event-sourced system with:
--   * Enriched fields (vendor, notes, payment_method, status, reversal chaining, idempotency)
--   * Branch-scoped custom categories (expense_categories)
--   * Pre-computed daily/monthly rollups (expense_metrics)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend expenses table (additive — preserves existing data)
-- ─────────────────────────────────────────────────────────────────────────────

-- Widen amount column to support larger values & reversals
ALTER TABLE "studio_template"."expenses"
  ALTER COLUMN "amount" TYPE numeric(12, 2);

-- Add new nullable / defaulted columns
ALTER TABLE "studio_template"."expenses"
  ADD COLUMN IF NOT EXISTS "category_id"     uuid,
  ADD COLUMN IF NOT EXISTS "vendor"          text,
  ADD COLUMN IF NOT EXISTS "notes"           text,
  ADD COLUMN IF NOT EXISTS "payment_method"  text   NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS "status"          text   NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS "reference_id"    uuid,
  ADD COLUMN IF NOT EXISTS "idempotency_key" text;

-- Indexes on expenses
CREATE INDEX IF NOT EXISTS "expenses_branch_id_expense_date_idx"
  ON "studio_template"."expenses" ("branch_id", "expense_date");
CREATE INDEX IF NOT EXISTS "expenses_branch_id_status_idx"
  ON "studio_template"."expenses" ("branch_id", "status");
CREATE INDEX IF NOT EXISTS "expenses_category_id_idx"
  ON "studio_template"."expenses" ("category_id");

-- Unique composite (gym_id, idempotency_key) for offline dedup.
-- Using a partial unique index allows NULL idempotency_key values for legacy rows.
CREATE UNIQUE INDEX IF NOT EXISTS "expenses_gym_id_idempotency_key_key"
  ON "studio_template"."expenses" ("gym_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. expense_categories
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "studio_template"."expense_categories" (
  "id"         uuid        NOT NULL DEFAULT gen_random_uuid(),
  "gym_id"     uuid        NOT NULL,
  "branch_id"  uuid,
  "name"       text        NOT NULL,
  "slug"       text        NOT NULL,
  "icon"       text,
  "color"      text,
  "is_default" boolean     NOT NULL DEFAULT false,
  "is_active"  boolean     NOT NULL DEFAULT true,
  "sort_order" integer     NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_gym_id_branch_id_slug_key"
  ON "studio_template"."expense_categories" ("gym_id", "branch_id", "slug");
CREATE INDEX IF NOT EXISTS "expense_categories_gym_id_branch_id_is_active_idx"
  ON "studio_template"."expense_categories" ("gym_id", "branch_id", "is_active");

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. expense_metrics (pre-computed rollups)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "studio_template"."expense_metrics" (
  "id"            uuid           NOT NULL DEFAULT gen_random_uuid(),
  "gym_id"        uuid           NOT NULL,
  "branch_id"     uuid           NOT NULL,
  "period_type"   text           NOT NULL,
  "period_key"    text           NOT NULL,
  "category_id"   uuid,
  "total_amount"  numeric(14, 2) NOT NULL DEFAULT 0,
  "expense_count" integer        NOT NULL DEFAULT 0,
  "currency"      text           NOT NULL DEFAULT 'INR',
  "updated_at"    timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT "expense_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "expense_metrics_unique_key"
  ON "studio_template"."expense_metrics" ("gym_id", "branch_id", "period_type", "period_key", "category_id");
CREATE INDEX IF NOT EXISTS "expense_metrics_lookup_idx"
  ON "studio_template"."expense_metrics" ("gym_id", "branch_id", "period_type", "period_key");

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Foreign keys (deferred so table creation is resilient to ordering)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "studio_template"."expenses"
  ADD CONSTRAINT "expenses_category_id_fkey"
    FOREIGN KEY ("category_id")
    REFERENCES "studio_template"."expense_categories" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "studio_template"."expenses"
  ADD CONSTRAINT "expenses_reference_id_fkey"
    FOREIGN KEY ("reference_id")
    REFERENCES "studio_template"."expenses" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "studio_template"."expense_categories"
  ADD CONSTRAINT "expense_categories_branch_id_fkey"
    FOREIGN KEY ("branch_id")
    REFERENCES "studio_template"."branches" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "studio_template"."expense_metrics"
  ADD CONSTRAINT "expense_metrics_branch_id_fkey"
    FOREIGN KEY ("branch_id")
    REFERENCES "studio_template"."branches" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
