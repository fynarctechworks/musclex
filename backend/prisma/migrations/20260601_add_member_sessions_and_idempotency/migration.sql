-- Member app sessions (rotating refresh tokens) + Idempotency-Key store.
-- Public schema (session is keyed by member+tenant, not gym-scoped data).
-- Idempotent + additive; applied to staging via the Supabase migration tool
-- (this DB's _prisma_migrations history is untracked — NOT `migrate deploy`).

CREATE TABLE IF NOT EXISTS public.member_refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL,
  tenant_id   uuid NOT NULL,
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  replaced_by uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_refresh_tokens_token_hash_key UNIQUE (token_hash)
);
CREATE INDEX IF NOT EXISTS member_refresh_tokens_member_id_tenant_id_idx
  ON public.member_refresh_tokens (member_id, tenant_id);

CREATE TABLE IF NOT EXISTS public.member_idempotency_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  member_id       uuid NOT NULL,
  idempotency_key text NOT NULL,
  endpoint        text NOT NULL,
  request_hash    text NOT NULL,
  status          text NOT NULL DEFAULT 'in_progress',
  response_status integer,
  response_body   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  CONSTRAINT member_idempotency_keys_unique UNIQUE (tenant_id, member_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS member_idempotency_keys_expires_at_idx
  ON public.member_idempotency_keys (expires_at);
