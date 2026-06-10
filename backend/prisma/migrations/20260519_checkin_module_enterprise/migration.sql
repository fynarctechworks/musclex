-- ============================================================================
-- MIGRATION: Enterprise Check-In Module — Foundation (Phase 3a)
-- ============================================================================
--
-- Purpose:
--   Lay the data foundation for the enterprise check-in upgrade. This
--   migration is STRICTLY ADDITIVE — no columns dropped, no types changed,
--   no behavior change to the live check-in path. All new structures are
--   inert until subsequent phases wire them in.
--
-- What this adds:
--   1. pgvector extension (Supabase-supported).
--   2. members.face_vec vector(128) — for 1:N facial matching at scale.
--      Backfilled from members.face_descriptor (Float[]) where present.
--      The old face_descriptor column is kept for safe rollback; cleanup
--      happens in a later phase after the new matcher is verified live.
--   3. members.qr_version INT, members.qr_regenerated_at TIMESTAMPTZ —
--      foundation for HMAC-signed QR + "Regenerate QR" UX. qr_version=1
--      means "current static UUID is the v1 key".
--   4. branches.timezone TEXT — per-branch IANA tz for duplicate-window
--      and opening-hour rules. Defaults Asia/Kolkata for back-compat.
--   5. New tables in studio_template (replicated to every studio_*):
--        - check_in_events       (append-only event log; idempotency by client_event_id)
--        - check_in_devices      (kiosk / turnstile registry)
--        - qr_token_audits       (replay-protection forensic trail)
--        - biometric_enrollments (consent-audited enrollment registry)
--
-- Not in scope for THIS migration:
--   - Backfilling check_ins → check_in_events (legacy table stays primary
--     until orchestrator cutover; a separate one-off backfill job will
--     replay history once we're ready).
--   - Dropping members.face_descriptor (deferred to Phase 4 cleanup).
--   - RLS policies on the new tables (will be enabled by the existing
--     enable_tenant_rls helper in a follow-up; gym_id column is in place).
--
-- Idempotent: every CREATE uses IF NOT EXISTS; every ADD COLUMN uses
-- IF NOT EXISTS. Safe to re-run.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────
-- 1. pgvector extension
-- ────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- ────────────────────────────────────────────────────────────────────────
-- 2. branches.timezone
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE "studio_template"."branches"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

DO $$
DECLARE
    schema_name TEXT;
BEGIN
    FOR schema_name IN
        SELECT nspname FROM pg_namespace
         WHERE nspname LIKE 'studio_%' AND nspname != 'studio_template'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.branches ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT ''Asia/Kolkata'';',
            schema_name
        );
    END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────
-- 3. members: face_vec + qr_version + qr_regenerated_at
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE "studio_template"."members"
  ADD COLUMN IF NOT EXISTS "face_vec"          vector(128),
  ADD COLUMN IF NOT EXISTS "qr_version"        INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "qr_regenerated_at" TIMESTAMPTZ;

-- Backfill face_vec from face_descriptor (Float[]) — only for rows that
-- have a descriptor of the expected length. The `::vector` cast accepts
-- a Postgres array literal directly.
UPDATE "studio_template"."members"
   SET face_vec = face_descriptor::text::vector
 WHERE face_descriptor IS NOT NULL
   AND array_length(face_descriptor, 1) = 128
   AND face_vec IS NULL;

-- IVFFlat index for cosine distance — `lists` chosen for ~thousands of
-- members; can be rebuilt with larger `lists` as datasets grow. ANALYZE
-- before/after for accurate query planning.
CREATE INDEX IF NOT EXISTS "members_face_vec_ivfflat"
    ON "studio_template"."members"
 USING ivfflat (face_vec vector_cosine_ops) WITH (lists = 100);

-- Replicate to every tenant schema.
DO $$
DECLARE
    schema_name TEXT;
BEGIN
    FOR schema_name IN
        SELECT nspname FROM pg_namespace
         WHERE nspname LIKE 'studio_%' AND nspname != 'studio_template'
    LOOP
        EXECUTE format($f$
            ALTER TABLE %I.members
              ADD COLUMN IF NOT EXISTS face_vec          vector(128),
              ADD COLUMN IF NOT EXISTS qr_version        INTEGER NOT NULL DEFAULT 1,
              ADD COLUMN IF NOT EXISTS qr_regenerated_at TIMESTAMPTZ;

            UPDATE %I.members
               SET face_vec = face_descriptor::text::vector
             WHERE face_descriptor IS NOT NULL
               AND array_length(face_descriptor, 1) = 128
               AND face_vec IS NULL;

            CREATE INDEX IF NOT EXISTS members_face_vec_ivfflat
                ON %I.members
             USING ivfflat (face_vec vector_cosine_ops) WITH (lists = 100);
        $f$, schema_name, schema_name, schema_name);
    END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────
-- 4. check_in_events — append-only event log
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "studio_template"."check_in_events" (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id               UUID         NOT NULL,
    member_id            UUID         NOT NULL,
    membership_id        UUID,
    branch_id            UUID         NOT NULL,
    class_id             UUID,
    device_id            UUID,
    client_event_id      UUID         NOT NULL,
    method               TEXT         NOT NULL,
    source               TEXT         NOT NULL,
    outcome              TEXT         NOT NULL,
    denial_reason        TEXT,
    override_reason      TEXT,
    override_by_user_id  UUID,
    qr_token_jti         TEXT,
    policy_snapshot      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    rule_trace           JSONB        NOT NULL DEFAULT '[]'::jsonb,
    ip_address           TEXT,
    user_agent           TEXT,
    recorded_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_check_in_event_idempotency UNIQUE (gym_id, client_event_id)
);

CREATE INDEX IF NOT EXISTS idx_check_in_events_branch_recorded
    ON "studio_template"."check_in_events" (branch_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_in_events_member_recorded
    ON "studio_template"."check_in_events" (member_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_in_events_outcome_recorded
    ON "studio_template"."check_in_events" (outcome, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_in_events_device_recorded
    ON "studio_template"."check_in_events" (device_id, recorded_at DESC);

-- ────────────────────────────────────────────────────────────────────────
-- 5. check_in_devices — kiosk / turnstile registry
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "studio_template"."check_in_devices" (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id          UUID         NOT NULL,
    branch_id       UUID         NOT NULL,
    device_name     TEXT         NOT NULL,
    kind            TEXT         NOT NULL,
    hardware_id     TEXT,
    device_secret   TEXT         NOT NULL,
    pin_hash        TEXT         NOT NULL,
    status          TEXT         NOT NULL DEFAULT 'active',
    last_seen_at    TIMESTAMPTZ,
    registered_by   UUID         NOT NULL,
    registered_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_check_in_devices_branch_status
    ON "studio_template"."check_in_devices" (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_check_in_devices_gym
    ON "studio_template"."check_in_devices" (gym_id);

-- ────────────────────────────────────────────────────────────────────────
-- 6. qr_token_audits — signed-QR replay forensic trail
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "studio_template"."qr_token_audits" (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id      UUID         NOT NULL,
    jti         TEXT         NOT NULL UNIQUE,
    member_id   UUID         NOT NULL,
    qr_version  INTEGER      NOT NULL,
    token_kind  TEXT         NOT NULL,
    branch_id   UUID         NOT NULL,
    used_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_token_audits_member_used
    ON "studio_template"."qr_token_audits" (member_id, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_token_audits_gym_used
    ON "studio_template"."qr_token_audits" (gym_id, used_at DESC);

-- ────────────────────────────────────────────────────────────────────────
-- 7. biometric_enrollments — consent-audited enrollment registry
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "studio_template"."biometric_enrollments" (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id          UUID         NOT NULL,
    member_id       UUID         NOT NULL,
    provider        TEXT         NOT NULL,
    modality        TEXT         NOT NULL,
    template_ref    TEXT         NOT NULL,
    consent_log_id  UUID,
    enrolled_by     UUID         NOT NULL,
    enrolled_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_biometric_enrollment UNIQUE (member_id, modality, provider)
);

CREATE INDEX IF NOT EXISTS idx_biometric_enrollments_gym_modality
    ON "studio_template"."biometric_enrollments" (gym_id, modality);

-- ────────────────────────────────────────────────────────────────────────
-- 8. Replicate the 4 new tables to every existing studio_* schema
-- ────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    schema_name TEXT;
BEGIN
    FOR schema_name IN
        SELECT nspname FROM pg_namespace
         WHERE nspname LIKE 'studio_%' AND nspname != 'studio_template'
    LOOP
        -- check_in_events
        EXECUTE format($f$
            CREATE TABLE IF NOT EXISTS %I.check_in_events (
                id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
                gym_id               UUID         NOT NULL,
                member_id            UUID         NOT NULL,
                membership_id        UUID,
                branch_id            UUID         NOT NULL,
                class_id             UUID,
                device_id            UUID,
                client_event_id      UUID         NOT NULL,
                method               TEXT         NOT NULL,
                source               TEXT         NOT NULL,
                outcome              TEXT         NOT NULL,
                denial_reason        TEXT,
                override_reason      TEXT,
                override_by_user_id  UUID,
                qr_token_jti         TEXT,
                policy_snapshot      JSONB        NOT NULL DEFAULT '{}'::jsonb,
                rule_trace           JSONB        NOT NULL DEFAULT '[]'::jsonb,
                ip_address           TEXT,
                user_agent           TEXT,
                recorded_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_check_in_event_idempotency_%I UNIQUE (gym_id, client_event_id)
            );
            CREATE INDEX IF NOT EXISTS idx_check_in_events_branch_recorded_%I ON %I.check_in_events (branch_id, recorded_at DESC);
            CREATE INDEX IF NOT EXISTS idx_check_in_events_member_recorded_%I ON %I.check_in_events (member_id, recorded_at DESC);
            CREATE INDEX IF NOT EXISTS idx_check_in_events_outcome_recorded_%I ON %I.check_in_events (outcome, recorded_at DESC);
            CREATE INDEX IF NOT EXISTS idx_check_in_events_device_recorded_%I ON %I.check_in_events (device_id, recorded_at DESC);
        $f$, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name);

        -- check_in_devices
        EXECUTE format($f$
            CREATE TABLE IF NOT EXISTS %I.check_in_devices (
                id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
                gym_id          UUID         NOT NULL,
                branch_id       UUID         NOT NULL,
                device_name     TEXT         NOT NULL,
                kind            TEXT         NOT NULL,
                hardware_id     TEXT,
                device_secret   TEXT         NOT NULL,
                pin_hash        TEXT         NOT NULL,
                status          TEXT         NOT NULL DEFAULT 'active',
                last_seen_at    TIMESTAMPTZ,
                registered_by   UUID         NOT NULL,
                registered_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_check_in_devices_branch_status_%I ON %I.check_in_devices (branch_id, status);
            CREATE INDEX IF NOT EXISTS idx_check_in_devices_gym_%I            ON %I.check_in_devices (gym_id);
        $f$, schema_name, schema_name, schema_name, schema_name, schema_name);

        -- qr_token_audits
        EXECUTE format($f$
            CREATE TABLE IF NOT EXISTS %I.qr_token_audits (
                id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
                gym_id      UUID         NOT NULL,
                jti         TEXT         NOT NULL,
                member_id   UUID         NOT NULL,
                qr_version  INTEGER      NOT NULL,
                token_kind  TEXT         NOT NULL,
                branch_id   UUID         NOT NULL,
                used_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_qr_token_audit_jti_%I UNIQUE (jti)
            );
            CREATE INDEX IF NOT EXISTS idx_qr_token_audits_member_used_%I ON %I.qr_token_audits (member_id, used_at DESC);
            CREATE INDEX IF NOT EXISTS idx_qr_token_audits_gym_used_%I    ON %I.qr_token_audits (gym_id, used_at DESC);
        $f$, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name);

        -- biometric_enrollments
        EXECUTE format($f$
            CREATE TABLE IF NOT EXISTS %I.biometric_enrollments (
                id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
                gym_id          UUID         NOT NULL,
                member_id       UUID         NOT NULL,
                provider        TEXT         NOT NULL,
                modality        TEXT         NOT NULL,
                template_ref    TEXT         NOT NULL,
                consent_log_id  UUID,
                enrolled_by     UUID         NOT NULL,
                enrolled_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                revoked_at      TIMESTAMPTZ,
                created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_biometric_enrollment_%I UNIQUE (member_id, modality, provider)
            );
            CREATE INDEX IF NOT EXISTS idx_biometric_enrollments_gym_modality_%I ON %I.biometric_enrollments (gym_id, modality);
        $f$, schema_name, schema_name, schema_name, schema_name);
    END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────
-- 9. ANALYZE to refresh statistics after backfill / new columns
-- ────────────────────────────────────────────────────────────────────────

ANALYZE "studio_template"."members";
ANALYZE "studio_template"."branches";

DO $$
DECLARE
    schema_name TEXT;
BEGIN
    FOR schema_name IN
        SELECT nspname FROM pg_namespace
         WHERE nspname LIKE 'studio_%' AND nspname != 'studio_template'
    LOOP
        EXECUTE format('ANALYZE %I.members;', schema_name);
        EXECUTE format('ANALYZE %I.branches;', schema_name);
    END LOOP;
END $$;

-- End of migration.
