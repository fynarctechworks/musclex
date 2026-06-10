-- System Monitoring & Observability Center.
-- Centralized error tracking for client gym apps AND the SCC platform itself.
-- Purely additive: creates new enum types + tables in the `scc` schema only.
-- Idempotent (IF NOT EXISTS / duplicate_object guards) — safe to re-run via
-- `npx ts-node scripts/apply-migrations.ts`. See docs/ERROR_CENTER_ARCHITECTURE.md.

-- ── Enum types ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE scc."ErrorSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scc."ErrorStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED', 'REOPENED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scc."ErrorSource" AS ENUM ('FRONTEND', 'BACKEND', 'API', 'DATABASE', 'PAYMENT', 'POS', 'BIOMETRIC', 'QR', 'CAMERA', 'AUTH', 'NETWORK', 'SCC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scc."AppEnvironment" AS ENUM ('PRODUCTION', 'STAGING', 'DEVELOPMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scc."AlertChannel" AS ENUM ('DASHBOARD', 'EMAIL', 'TELEGRAM', 'WHATSAPP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── release_tracking (referenced by system_errors, so created first) ───────────
CREATE TABLE IF NOT EXISTS scc.release_tracking (
    id          UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
    version     TEXT               NOT NULL,
    app         TEXT               NOT NULL,
    environment scc."AppEnvironment" NOT NULL DEFAULT 'PRODUCTION',
    released_at TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    commit_sha  TEXT               NULL,
    notes       TEXT               NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS release_tracking_app_version_environment_key
    ON scc.release_tracking (app, version, environment);

-- ── system_errors (the error group / fingerprint) ─────────────────────────────
CREATE TABLE IF NOT EXISTS scc.system_errors (
    id               UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint      TEXT                 NOT NULL UNIQUE,
    title            TEXT                 NOT NULL,
    message          TEXT                 NOT NULL,
    source           scc."ErrorSource"    NOT NULL,
    module           TEXT                 NULL,
    severity         scc."ErrorSeverity"  NOT NULL DEFAULT 'MEDIUM',
    status           scc."ErrorStatus"    NOT NULL DEFAULT 'OPEN',
    environment      scc."AppEnvironment" NOT NULL DEFAULT 'PRODUCTION',
    occurrence_count INTEGER              NOT NULL DEFAULT 0,
    affected_tenants INTEGER              NOT NULL DEFAULT 0,
    affected_users   INTEGER              NOT NULL DEFAULT 0,
    first_seen_at    TIMESTAMPTZ          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at     TIMESTAMPTZ          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_to      UUID                 NULL,
    resolution_note  TEXT                 NULL,
    resolved_at      TIMESTAMPTZ          NULL,
    resolved_by      UUID                 NULL,
    release_id       UUID                 NULL REFERENCES scc.release_tracking (id),
    created_at       TIMESTAMPTZ          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ          NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS system_errors_status_severity_last_seen_at_idx
    ON scc.system_errors (status, severity, last_seen_at);
CREATE INDEX IF NOT EXISTS system_errors_environment_source_idx
    ON scc.system_errors (environment, source);
CREATE INDEX IF NOT EXISTS system_errors_last_seen_at_idx
    ON scc.system_errors (last_seen_at);

-- ── error_occurrences (one row per individual event) ──────────────────────────
CREATE TABLE IF NOT EXISTS scc.error_occurrences (
    id               UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
    error_id         UUID                 NOT NULL REFERENCES scc.system_errors (id) ON DELETE CASCADE,
    tenant_id        TEXT                 NULL,
    user_id          TEXT                 NULL,
    stack_trace      TEXT                 NULL,
    page             TEXT                 NULL,
    api_endpoint     TEXT                 NULL,
    http_status      INTEGER              NULL,
    request_payload  JSONB                NULL,
    response_payload JSONB                NULL,
    breadcrumbs      JSONB                NULL,
    device_info      JSONB                NULL,
    browser_info     JSONB                NULL,
    ip_address       TEXT                 NULL,
    app_version      TEXT                 NULL,
    environment      scc."AppEnvironment" NOT NULL DEFAULT 'PRODUCTION',
    screenshot_url   TEXT                 NULL,
    occurred_at      TIMESTAMPTZ          NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS error_occurrences_error_id_occurred_at_idx
    ON scc.error_occurrences (error_id, occurred_at);
CREATE INDEX IF NOT EXISTS error_occurrences_tenant_id_idx
    ON scc.error_occurrences (tenant_id);

-- ── error_activity_logs (resolution/audit timeline) ───────────────────────────
CREATE TABLE IF NOT EXISTS scc.error_activity_logs (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    error_id   UUID        NOT NULL REFERENCES scc.system_errors (id) ON DELETE CASCADE,
    admin_id   UUID        NULL,
    action     TEXT        NOT NULL,
    from_value TEXT        NULL,
    to_value   TEXT        NULL,
    note       TEXT        NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS error_activity_logs_error_id_created_at_idx
    ON scc.error_activity_logs (error_id, created_at);

-- ── system_alerts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scc.system_alerts (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    error_id        UUID                NULL REFERENCES scc.system_errors (id) ON DELETE SET NULL,
    severity        scc."ErrorSeverity" NOT NULL,
    channel         scc."AlertChannel"  NOT NULL DEFAULT 'DASHBOARD',
    title           TEXT                NOT NULL,
    body            TEXT                NULL,
    delivered       BOOLEAN             NOT NULL DEFAULT FALSE,
    delivered_at    TIMESTAMPTZ         NULL,
    acknowledged    BOOLEAN             NOT NULL DEFAULT FALSE,
    acknowledged_by UUID                NULL,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS system_alerts_acknowledged_created_at_idx
    ON scc.system_alerts (acknowledged, created_at);
CREATE INDEX IF NOT EXISTS system_alerts_channel_delivered_idx
    ON scc.system_alerts (channel, delivered);
