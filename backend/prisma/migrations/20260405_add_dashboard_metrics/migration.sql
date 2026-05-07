-- ============================================================
-- Migration: Add dashboard_metrics table to studio_template
-- and all existing tenant schemas
--
-- This table stores pre-aggregated counters for instant dashboard loads.
-- Counters are maintained atomically alongside source writes.
-- A nightly resync job corrects any drift.
--
-- Run: psql $DATABASE_URL -f migration.sql
-- ============================================================

-- 1. Create table in studio_template (template for new tenants)
CREATE TABLE IF NOT EXISTS "studio_template"."dashboard_metrics" (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id               UUID NOT NULL,
    branch_id            UUID,
    total_members        INT NOT NULL DEFAULT 0,
    active_members       INT NOT NULL DEFAULT 0,
    total_staff          INT NOT NULL DEFAULT 0,
    active_staff         INT NOT NULL DEFAULT 0,
    total_revenue        DECIMAL(12, 2) NOT NULL DEFAULT 0,
    monthly_revenue      DECIMAL(12, 2) NOT NULL DEFAULT 0,
    check_ins_today      INT NOT NULL DEFAULT 0,
    check_ins_month      INT NOT NULL DEFAULT 0,
    expiring_memberships INT NOT NULL DEFAULT 0,
    revenue_month        TEXT,
    last_synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_dashboard_metrics_branch FOREIGN KEY (branch_id)
        REFERENCES "studio_template"."branches"(id),

    CONSTRAINT uq_dashboard_metrics_gym_branch UNIQUE (gym_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_gym_id
    ON "studio_template"."dashboard_metrics" (gym_id);

-- Add CHECK constraints to prevent negative counters
ALTER TABLE "studio_template"."dashboard_metrics"
    ADD CONSTRAINT chk_total_members_nonneg CHECK (total_members >= 0),
    ADD CONSTRAINT chk_active_members_nonneg CHECK (active_members >= 0),
    ADD CONSTRAINT chk_total_staff_nonneg CHECK (total_staff >= 0),
    ADD CONSTRAINT chk_active_staff_nonneg CHECK (active_staff >= 0),
    ADD CONSTRAINT chk_check_ins_today_nonneg CHECK (check_ins_today >= 0),
    ADD CONSTRAINT chk_check_ins_month_nonneg CHECK (check_ins_month >= 0),
    ADD CONSTRAINT chk_expiring_nonneg CHECK (expiring_memberships >= 0);

-- 2. Apply to ALL existing tenant schemas
DO $$
DECLARE
    tenant_schema TEXT;
    studio_record RECORD;
BEGIN
    FOR studio_record IN
        SELECT s.id, s.slug, s.schema_name AS sname FROM public.studios s WHERE s.subscription_status = 'active'
    LOOP
        tenant_schema := studio_record.sname;

        -- Skip if schema doesn't exist yet (will be created at next onboarding)
        IF NOT EXISTS (SELECT 1 FROM information_schema.schemata s2 WHERE s2.schema_name = tenant_schema) THEN
            CONTINUE;
        END IF;

        -- Create the table in this tenant schema
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I."dashboard_metrics" (
                id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                gym_id               UUID NOT NULL,
                branch_id            UUID,
                total_members        INT NOT NULL DEFAULT 0,
                active_members       INT NOT NULL DEFAULT 0,
                total_staff          INT NOT NULL DEFAULT 0,
                active_staff         INT NOT NULL DEFAULT 0,
                total_revenue        DECIMAL(12, 2) NOT NULL DEFAULT 0,
                monthly_revenue      DECIMAL(12, 2) NOT NULL DEFAULT 0,
                check_ins_today      INT NOT NULL DEFAULT 0,
                check_ins_month      INT NOT NULL DEFAULT 0,
                expiring_memberships INT NOT NULL DEFAULT 0,
                revenue_month        TEXT,
                last_synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )', tenant_schema
        );

        -- Add unique constraint
        BEGIN
            EXECUTE format(
                'ALTER TABLE %I."dashboard_metrics" ADD CONSTRAINT uq_dm_gym_branch UNIQUE (gym_id, branch_id)',
                tenant_schema
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        -- Add index
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS idx_dm_gym_id ON %I."dashboard_metrics" (gym_id)',
            tenant_schema
        );

        -- Add FK to branches
        BEGIN
            EXECUTE format(
                'ALTER TABLE %I."dashboard_metrics" ADD CONSTRAINT fk_dm_branch FOREIGN KEY (branch_id) REFERENCES %I."branches"(id)',
                tenant_schema, tenant_schema
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        -- Add CHECK constraints
        BEGIN
            EXECUTE format('ALTER TABLE %I."dashboard_metrics" ADD CONSTRAINT chk_tm_nonneg CHECK (total_members >= 0)', tenant_schema);
            EXECUTE format('ALTER TABLE %I."dashboard_metrics" ADD CONSTRAINT chk_am_nonneg CHECK (active_members >= 0)', tenant_schema);
            EXECUTE format('ALTER TABLE %I."dashboard_metrics" ADD CONSTRAINT chk_ts_nonneg CHECK (total_staff >= 0)', tenant_schema);
            EXECUTE format('ALTER TABLE %I."dashboard_metrics" ADD CONSTRAINT chk_as_nonneg CHECK (active_staff >= 0)', tenant_schema);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        -- Seed initial metrics row from live data
        EXECUTE format(
            'INSERT INTO %I."dashboard_metrics" (gym_id, total_members, active_members, total_staff, active_staff, monthly_revenue, total_revenue, check_ins_month, revenue_month, last_synced_at)
             SELECT
                 %L::uuid,
                 (SELECT COUNT(*) FROM %I."members"),
                 (SELECT COUNT(*) FROM %I."members" WHERE status = ''active''),
                 (SELECT COUNT(*) FROM %I."staff"),
                 (SELECT COUNT(*) FROM %I."staff" WHERE is_active = true),
                 COALESCE((SELECT SUM(amount) FROM %I."payments" WHERE status = ''paid'' AND paid_at >= DATE_TRUNC(''month'', NOW())), 0),
                 COALESCE((SELECT SUM(amount) FROM %I."payments" WHERE status = ''paid''), 0),
                 (SELECT COUNT(*) FROM %I."check_ins" WHERE status = ''success'' AND checked_in_at >= DATE_TRUNC(''month'', NOW())),
                 TO_CHAR(NOW(), ''YYYY-MM''),
                 NOW()
             ON CONFLICT (gym_id, branch_id) DO NOTHING',
            tenant_schema,
            studio_record.id,
            tenant_schema, tenant_schema,
            tenant_schema, tenant_schema,
            tenant_schema, tenant_schema,
            tenant_schema
        );

        RAISE NOTICE 'Created dashboard_metrics in schema %', tenant_schema;
    END LOOP;
END $$;

-- 3. Enable RLS on the new table (matches existing 3-layer defense)
ALTER TABLE "studio_template"."dashboard_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_template"."dashboard_metrics" FORCE ROW LEVEL SECURITY;

CREATE POLICY gym_isolation ON "studio_template"."dashboard_metrics"
    USING (gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid);

-- Verify
SELECT 'studio_template' AS schema, COUNT(*) AS rows
FROM "studio_template"."dashboard_metrics";
