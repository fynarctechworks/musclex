-- Health Data Platform for the Member App: quantified-health telemetry synced
-- from wearables (Apple HealthKit / Google Health Connect / Fitbit / Garmin) or
-- entered manually. Three tables, all gym_id-scoped (studio_template) and
-- registered in TENANT_MODELS so the $use middleware + tenant extension
-- auto-filter by gym_id:
--   member_health_samples       raw idempotent time-series (one row per sample)
--   member_health_daily         per-metric daily rollup the dashboards read
--   member_wearable_connections linked providers + GDPR consent timestamp
-- Idempotent + additive; applied to staging via the Supabase migration tool
-- (this DB's _prisma_migrations history is untracked, so it is NOT deployed via
-- `prisma migrate deploy`).

CREATE TABLE IF NOT EXISTS studio_template.member_health_samples (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id      uuid NOT NULL,
  member_id   uuid NOT NULL,
  type        text NOT NULL,
  value       numeric(12, 3) NOT NULL,
  unit        text NOT NULL,
  start_at    timestamptz NOT NULL,
  end_at      timestamptz NOT NULL,
  source      text NOT NULL,
  source_uuid text NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_health_samples_member_id_fkey FOREIGN KEY (member_id)
    REFERENCES studio_template.members(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS member_health_samples_dedupe_uidx
  ON studio_template.member_health_samples (member_id, type, source, source_uuid);
CREATE INDEX IF NOT EXISTS member_health_samples_gym_id_idx
  ON studio_template.member_health_samples (gym_id);
CREATE INDEX IF NOT EXISTS member_health_samples_member_type_start_idx
  ON studio_template.member_health_samples (member_id, type, start_at);

CREATE TABLE IF NOT EXISTS studio_template.member_health_daily (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id         uuid NOT NULL,
  member_id      uuid NOT NULL,
  day            date NOT NULL,
  type           text NOT NULL,
  total          numeric(14, 3) NOT NULL,
  min            numeric(12, 3),
  max            numeric(12, 3),
  avg            numeric(12, 3),
  sample_count   integer NOT NULL DEFAULT 0,
  unit           text NOT NULL,
  primary_source text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_health_daily_member_id_fkey FOREIGN KEY (member_id)
    REFERENCES studio_template.members(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS member_health_daily_member_day_type_uidx
  ON studio_template.member_health_daily (member_id, day, type);
CREATE INDEX IF NOT EXISTS member_health_daily_gym_id_idx
  ON studio_template.member_health_daily (gym_id);
CREATE INDEX IF NOT EXISTS member_health_daily_member_type_day_idx
  ON studio_template.member_health_daily (member_id, type, day);

CREATE TABLE IF NOT EXISTS studio_template.member_wearable_connections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id           uuid NOT NULL,
  member_id        uuid NOT NULL,
  provider         text NOT NULL,
  status           text NOT NULL DEFAULT 'connected',
  scopes           jsonb,
  external_user_id text,
  consented_at     timestamptz NOT NULL,
  last_synced_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_wearable_connections_member_id_fkey FOREIGN KEY (member_id)
    REFERENCES studio_template.members(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS member_wearable_connections_member_provider_uidx
  ON studio_template.member_wearable_connections (member_id, provider);
CREATE INDEX IF NOT EXISTS member_wearable_connections_gym_id_idx
  ON studio_template.member_wearable_connections (gym_id);
