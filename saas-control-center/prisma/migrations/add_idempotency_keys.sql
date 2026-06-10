-- Idempotency keys for money mutations (billing retry / mark-paid / refund).
-- A row is reserved on first request and persists the canonical response so
-- replays of the same Idempotency-Key return the original outcome instead of
-- re-executing the operation. Rows older than 24h are pruned by an hourly cron.

CREATE TABLE IF NOT EXISTS scc.idempotency_keys (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    key           TEXT        NOT NULL UNIQUE,
    endpoint      TEXT        NOT NULL,
    admin_id      UUID        NULL,
    request_hash  TEXT        NOT NULL,
    response_body JSONB       NULL,
    status_code   INTEGER     NULL,
    created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idempotency_keys_created_at_idx
    ON scc.idempotency_keys (created_at);
