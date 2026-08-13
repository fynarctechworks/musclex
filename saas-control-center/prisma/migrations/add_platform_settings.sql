-- Platform Settings — global key/value config owned by the SCC platform.
-- First use: the subscription GST rate applied (exclusive, on top) to gym
-- onboarding/renewal payments. Lives in the `scc` schema, which is internal
-- and NOT exposed to PostgREST/anon, so no RLS surface is added to `public`.
-- Idempotent (IF NOT EXISTS / ON CONFLICT) — safe to re-run via
-- `npx ts-node scripts/apply-migrations.ts`.

CREATE TABLE IF NOT EXISTS scc.platform_settings (
    key         TEXT        PRIMARY KEY,
    value       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    description TEXT        NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by  UUID        NULL
);

-- Seed the subscription GST setting once. ON CONFLICT DO NOTHING preserves any
-- admin-edited value on re-run. percent is a number in [0, 100]; enabled=false
-- turns GST off entirely (0 tax) without losing the configured percent.
INSERT INTO scc.platform_settings (key, value, description)
VALUES (
  'subscription_gst',
  '{"enabled": true, "percent": 18, "label": "GST"}'::jsonb,
  'GST added on top of subscription plan prices (exclusive). percent in [0,100].'
)
ON CONFLICT (key) DO NOTHING;
