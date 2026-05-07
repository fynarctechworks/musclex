-- ============================================================
-- Migration: push_subscriptions
--
-- Stores Web Push subscription payloads per user. Used by the
-- Action Queue escalator to push high-severity items to mobile
-- devices when the user is away from the dashboard.
--
-- Run: psql $DATABASE_URL -f migration.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS "studio_template"."push_subscriptions" (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id       UUID NOT NULL,
    user_id      UUID NOT NULL,
    endpoint     TEXT NOT NULL,
    p256dh       TEXT NOT NULL,
    auth         TEXT NOT NULL,
    user_agent   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,

    CONSTRAINT uq_push_endpoint UNIQUE (gym_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_user ON "studio_template"."push_subscriptions" (user_id);

-- Apply to all existing tenant schemas
DO $$
DECLARE
    schema_name TEXT;
BEGIN
    FOR schema_name IN
        SELECT nspname FROM pg_namespace WHERE nspname LIKE 'studio_%' AND nspname != 'studio_template'
    LOOP
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I.push_subscriptions (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                gym_id       UUID NOT NULL,
                user_id      UUID NOT NULL,
                endpoint     TEXT NOT NULL,
                p256dh       TEXT NOT NULL,
                auth         TEXT NOT NULL,
                user_agent   TEXT,
                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_used_at TIMESTAMPTZ,
                CONSTRAINT uq_push_endpoint_%I UNIQUE (gym_id, endpoint)
            );
            CREATE INDEX IF NOT EXISTS idx_push_user_%I ON %I.push_subscriptions (user_id);
        ', schema_name, schema_name, schema_name, schema_name);
    END LOOP;
END $$;
