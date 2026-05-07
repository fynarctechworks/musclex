-- ============================================================
-- Migration: Wave 14 — User Dashboard Layouts
-- Adds public.user_dashboard_layouts so DashboardLayoutService
-- can persist per-user tile show/hide/order/size selections.
-- Run: psql $DATABASE_URL -f migration.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."user_dashboard_layouts" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    studio_id   UUID NOT NULL,
    role        TEXT NOT NULL,
    layout_json JSONB NOT NULL,
    version     INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_dashboard_layouts_user_studio_role_key
    ON "public"."user_dashboard_layouts" (user_id, studio_id, role);

CREATE INDEX IF NOT EXISTS user_dashboard_layouts_user_studio_idx
    ON "public"."user_dashboard_layouts" (user_id, studio_id);
