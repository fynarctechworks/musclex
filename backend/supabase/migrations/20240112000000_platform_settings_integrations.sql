-- Platform Settings & Integrations Engine
-- Migration: 20240112000000_platform_settings_integrations.sql

-- =============================================
-- Webhooks
-- =============================================

CREATE TABLE IF NOT EXISTS webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL,
  secret          TEXT NOT NULL,
  events          TEXT[] NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  retry_count     INTEGER NOT NULL DEFAULT 3,
  timeout_ms      INTEGER NOT NULL DEFAULT 5000,
  failure_count   INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhooks_org ON webhooks(organization_id);
CREATE INDEX idx_webhooks_active ON webhooks(is_active);

-- =============================================
-- Webhook Deliveries
-- =============================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event           TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  response_status INTEGER,
  response_body   TEXT,
  attempt         INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'pending',
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_created ON webhook_deliveries(created_at);

-- =============================================
-- Integrations
-- =============================================

CREATE TABLE IF NOT EXISTS integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  config          JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'inactive',
  is_enabled      BOOLEAN NOT NULL DEFAULT false,
  last_synced_at  TIMESTAMPTZ,
  error_message   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_integrations_org_provider ON integrations(organization_id, provider);
CREATE INDEX idx_integrations_org ON integrations(organization_id);
CREATE INDEX idx_integrations_provider ON integrations(provider);

-- =============================================
-- Feature Flags
-- =============================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  is_enabled      BOOLEAN NOT NULL DEFAULT false,
  description     TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_feature_flags_org_key ON feature_flags(organization_id, key);
CREATE INDEX idx_feature_flags_org ON feature_flags(organization_id);

-- =============================================
-- White Label Configs
-- =============================================

CREATE TABLE IF NOT EXISTS white_label_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  custom_domain     TEXT UNIQUE,
  logo_url          TEXT,
  favicon_url       TEXT,
  primary_color     TEXT NOT NULL DEFAULT '#4A9FD4',
  secondary_color   TEXT NOT NULL DEFAULT '#1A2F45',
  accent_color      TEXT NOT NULL DEFAULT '#6BBFE8',
  font_family       TEXT NOT NULL DEFAULT 'Inter',
  email_from_name   TEXT,
  email_from_address TEXT,
  support_email     TEXT,
  support_url       TEXT,
  terms_url         TEXT,
  privacy_url       TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- System Notifications
-- =============================================

CREATE TABLE IF NOT EXISTS system_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  action_url      TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_notif_org_read ON system_notifications(organization_id, is_read);
CREATE INDEX idx_system_notif_created ON system_notifications(created_at);
