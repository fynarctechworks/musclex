-- ============================================================
-- Migration: dashboard_kpi_snapshots
--
-- Stores end-of-period snapshots of each Pulse KPI per (gym, branch,
-- snapshot_date, metric). Used for Wave 7 "restatement markers" — when
-- a current value differs >5% from the snapshot, the dashboard surfaces
-- a "▴ restated" pill so users know yesterday's number changed.
--
-- Run: psql $DATABASE_URL -f migration.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS "studio_template"."dashboard_kpi_snapshots" (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id        UUID NOT NULL,
    branch_id     UUID,
    snapshot_date DATE NOT NULL,
    metric        TEXT NOT NULL,
    value         DOUBLE PRECISION NOT NULL,
    captured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_kpi_snapshot UNIQUE (gym_id, branch_id, snapshot_date, metric)
);

CREATE INDEX IF NOT EXISTS idx_kpi_snap_gym_date
    ON "studio_template"."dashboard_kpi_snapshots" (gym_id, snapshot_date DESC);

DO $$
DECLARE
    schema_name TEXT;
BEGIN
    FOR schema_name IN
        SELECT nspname FROM pg_namespace WHERE nspname LIKE 'studio_%' AND nspname != 'studio_template'
    LOOP
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I.dashboard_kpi_snapshots (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                gym_id        UUID NOT NULL,
                branch_id     UUID,
                snapshot_date DATE NOT NULL,
                metric        TEXT NOT NULL,
                value         DOUBLE PRECISION NOT NULL,
                captured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_kpi_snapshot_%I UNIQUE (gym_id, branch_id, snapshot_date, metric)
            );
            CREATE INDEX IF NOT EXISTS idx_kpi_snap_gym_date_%I
                ON %I.dashboard_kpi_snapshots (gym_id, snapshot_date DESC);
        ', schema_name, schema_name, schema_name, schema_name);
    END LOOP;
END $$;
