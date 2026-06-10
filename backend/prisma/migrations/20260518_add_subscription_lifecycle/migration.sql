-- =============================================================
-- Subscription Lifecycle Enforcement
-- Adds: lifecycle_status / grace_until / locked_at / suspended_at /
-- last_status_computed_at on studios, grace_days on subscription_plans,
-- and an immutable subscription_events ledger.
-- =============================================================

-- ── 1. studios: lifecycle columns ─────────────────────────────
ALTER TABLE "public"."studios"
  ADD COLUMN IF NOT EXISTS "lifecycle_status"        TEXT      NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "grace_until"             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "locked_at"               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "suspended_at"            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "last_status_computed_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "studios_lifecycle_status_idx"  ON "public"."studios" ("lifecycle_status");
CREATE INDEX IF NOT EXISTS "studios_next_billing_date_idx" ON "public"."studios" ("next_billing_date");
CREATE INDEX IF NOT EXISTS "studios_grace_until_idx"       ON "public"."studios" ("grace_until");

-- ── 2. subscription_plans: per-plan grace_days ───────────────
ALTER TABLE "public"."subscription_plans"
  ADD COLUMN IF NOT EXISTS "grace_days" INTEGER NOT NULL DEFAULT 3;

-- Sensible per-tier defaults (only update if still at default 3)
UPDATE "public"."subscription_plans" SET "grace_days" = 7 WHERE "name" = 'enterprise' AND "grace_days" = 3;
UPDATE "public"."subscription_plans" SET "grace_days" = 5 WHERE "name" = 'pro'        AND "grace_days" = 3;
-- starter/free keep 3

-- ── 3. subscription_events: immutable ledger ─────────────────
CREATE TABLE IF NOT EXISTS "public"."subscription_events" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "studio_id"     UUID         NOT NULL,
  "event_type"    TEXT         NOT NULL,
  "from_status"   TEXT,
  "to_status"     TEXT,
  "plan_name"     TEXT,
  "billing_cycle" TEXT,
  "amount"        DECIMAL(10,2),
  "currency"      TEXT,
  "period_start"  TIMESTAMPTZ,
  "period_end"    TIMESTAMPTZ,
  "actor_id"      UUID,
  "actor_type"    TEXT         NOT NULL DEFAULT 'system',
  "metadata"      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscription_events_studio_id_fkey"
    FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "subscription_events_studio_created_idx"
  ON "public"."subscription_events" ("studio_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "subscription_events_studio_event_type_idx"
  ON "public"."subscription_events" ("studio_id", "event_type");

-- Append-only: revoke UPDATE/DELETE from the app role. App must INSERT only.
-- (No-op if role doesn't exist in this environment; harmless.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    REVOKE UPDATE, DELETE ON "public"."subscription_events" FROM authenticator;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ── 4. Backfill lifecycle_status for existing studios ────────
-- Rule: derive from current state at migration time.
--   trial_ends_at in future  → 'active'      (trial running)
--   next_billing_date >= now → 'active'
--   within grace (next_billing_date + plan.grace_days)  → 'grace_period'
--   past grace                → 'locked'
WITH plan_grace AS (
  SELECT name, grace_days FROM "public"."subscription_plans"
)
UPDATE "public"."studios" s
SET
  "lifecycle_status" = CASE
    WHEN s."trial_ends_at" IS NOT NULL AND s."trial_ends_at" >= now() THEN 'active'
    WHEN s."next_billing_date" IS NULL                                  THEN 'active'  -- never billed
    WHEN s."next_billing_date" >= now()                                 THEN 'active'
    WHEN s."next_billing_date" + (COALESCE(pg.grace_days, 3) || ' days')::interval >= now()
                                                                        THEN 'grace_period'
    ELSE 'locked'
  END,
  "grace_until" = CASE
    WHEN s."next_billing_date" IS NOT NULL
     AND s."next_billing_date" < now()
     AND s."next_billing_date" + (COALESCE(pg.grace_days, 3) || ' days')::interval >= now()
    THEN s."next_billing_date" + (COALESCE(pg.grace_days, 3) || ' days')::interval
    ELSE NULL
  END,
  "locked_at" = CASE
    WHEN s."next_billing_date" IS NOT NULL
     AND s."next_billing_date" + (COALESCE(pg.grace_days, 3) || ' days')::interval < now()
    THEN s."next_billing_date" + (COALESCE(pg.grace_days, 3) || ' days')::interval
    ELSE NULL
  END,
  "last_status_computed_at" = now()
FROM plan_grace pg
WHERE pg.name = s."subscription_plan";

-- Studios whose plan_name is unknown (shouldn't happen, but safe): leave as 'active'.
UPDATE "public"."studios"
SET "last_status_computed_at" = now()
WHERE "last_status_computed_at" IS NULL;

-- ── 5. Seed a CREATED event for every existing studio (audit baseline) ──
INSERT INTO "public"."subscription_events"
  (studio_id, event_type, to_status, plan_name, billing_cycle, period_start, period_end, actor_type, metadata)
SELECT
  s.id,
  'backfill_baseline',
  s.lifecycle_status,
  s.subscription_plan,
  s.billing_cycle,
  s.subscription_start,
  s.next_billing_date,
  'system',
  jsonb_build_object('migration', '20260518_add_subscription_lifecycle')
FROM "public"."studios" s
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."subscription_events" e
  WHERE e.studio_id = s.id AND e.event_type = 'backfill_baseline'
);
