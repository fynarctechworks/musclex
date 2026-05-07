-- ============================================================
-- Migration: Add domain_events (Event Store) + version fields to dashboard_metrics
-- Run: psql $DATABASE_URL -f migration.sql
-- ============================================================

-- 1. Add version + last_event_id to dashboard_metrics in studio_template
ALTER TABLE "studio_template"."dashboard_metrics"
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_event_id UUID;

-- 2. Create domain_events table in studio_template
CREATE TABLE IF NOT EXISTS "studio_template"."domain_events" (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id         UUID NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id   UUID NOT NULL,
    event_type     TEXT NOT NULL,
    payload        JSONB NOT NULL DEFAULT '{}',
    actor_id       UUID,
    branch_id      UUID,
    version        BIGSERIAL,
    processed      BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_de_gym_unprocessed ON "studio_template"."domain_events" (gym_id, processed, created_at);
CREATE INDEX IF NOT EXISTS idx_de_aggregate ON "studio_template"."domain_events" (aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_de_gym_version ON "studio_template"."domain_events" (gym_id, version);
CREATE INDEX IF NOT EXISTS idx_de_event_type ON "studio_template"."domain_events" (event_type, created_at);

-- RLS on event store
ALTER TABLE "studio_template"."domain_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_template"."domain_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY gym_isolation ON "studio_template"."domain_events"
    USING (gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid);

-- 3. Apply to ALL existing tenant schemas
DO $$
DECLARE
    tenant_schema TEXT;
    studio_record RECORD;
BEGIN
    FOR studio_record IN
        SELECT s.id, s.schema_name AS sname FROM public.studios s WHERE s.subscription_status = 'active'
    LOOP
        tenant_schema := studio_record.sname;

        -- Skip if schema doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.schemata s2 WHERE s2.schema_name = tenant_schema) THEN
            CONTINUE;
        END IF;

        -- Add version columns to dashboard_metrics
        BEGIN
            EXECUTE format('ALTER TABLE %I."dashboard_metrics" ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0', tenant_schema);
            EXECUTE format('ALTER TABLE %I."dashboard_metrics" ADD COLUMN IF NOT EXISTS last_event_id UUID', tenant_schema);
        EXCEPTION WHEN undefined_table THEN NULL;
        END;

        -- Create domain_events
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I."domain_events" (
                id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                gym_id         UUID NOT NULL,
                aggregate_type TEXT NOT NULL,
                aggregate_id   UUID NOT NULL,
                event_type     TEXT NOT NULL,
                payload        JSONB NOT NULL DEFAULT ''{}'',
                actor_id       UUID,
                branch_id      UUID,
                version        BIGSERIAL,
                processed      BOOLEAN NOT NULL DEFAULT false,
                created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )', tenant_schema
        );

        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_de_gym_unproc ON %I."domain_events" (gym_id, processed, created_at)', tenant_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_de_agg ON %I."domain_events" (aggregate_type, aggregate_id)', tenant_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_de_ver ON %I."domain_events" (gym_id, version)', tenant_schema);

        -- RLS
        BEGIN
            EXECUTE format('ALTER TABLE %I."domain_events" ENABLE ROW LEVEL SECURITY', tenant_schema);
            EXECUTE format('ALTER TABLE %I."domain_events" FORCE ROW LEVEL SECURITY', tenant_schema);
            EXECUTE format('CREATE POLICY gym_iso ON %I."domain_events" USING (gym_id = NULLIF(current_setting(''app.gym_id'', true), '''')::uuid)', tenant_schema);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        RAISE NOTICE 'Created domain_events in %', tenant_schema;
    END LOOP;
END $$;
