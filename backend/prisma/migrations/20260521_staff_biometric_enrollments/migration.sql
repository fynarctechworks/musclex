-- ============================================================================
-- MIGRATION: Staff biometric enrollments + face_vec on staff
-- ============================================================================
--
-- Mirrors the member-side enrollment pipeline for the staff attendance use
-- case. Same provider contract (face-api on-device, pgvector matching) but a
-- separate table because the FK target is `staff(id)`, not `members(id)`.
--
-- Adds:
--   1. staff.face_descriptor (Float[]) + staff.face_vec (vector(128)).
--   2. staff_biometric_enrollments — audit registry mirroring biometric_enrollments.
--   3. IVFFlat index on staff.face_vec for 1:N match.
--
-- Idempotent. Replicated across every studio_* schema.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────
-- 1. staff face columns
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE "studio_template"."staff"
  ADD COLUMN IF NOT EXISTS "face_descriptor" DOUBLE PRECISION[],
  ADD COLUMN IF NOT EXISTS "face_vec"        vector(128);

CREATE INDEX IF NOT EXISTS "staff_face_vec_ivfflat"
    ON "studio_template"."staff"
 USING ivfflat (face_vec vector_cosine_ops) WITH (lists = 100);

-- ────────────────────────────────────────────────────────────────────────
-- 2. staff_biometric_enrollments
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "studio_template"."staff_biometric_enrollments" (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id          UUID         NOT NULL,
    staff_id        UUID         NOT NULL,
    provider        TEXT         NOT NULL,
    modality        TEXT         NOT NULL,
    template_ref    TEXT         NOT NULL,
    consent_log_id  UUID,
    enrolled_by     UUID         NOT NULL,
    enrolled_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_staff_biometric_enrollment UNIQUE (staff_id, modality, provider)
);

CREATE INDEX IF NOT EXISTS idx_staff_biometric_enrollments_gym_modality
    ON "studio_template"."staff_biometric_enrollments" (gym_id, modality);

-- ────────────────────────────────────────────────────────────────────────
-- 3. Replicate to every tenant schema
-- ────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    schema_name TEXT;
BEGIN
    FOR schema_name IN
        SELECT nspname FROM pg_namespace
         WHERE nspname LIKE 'studio_%' AND nspname != 'studio_template'
    LOOP
        EXECUTE format($f$
            ALTER TABLE %I.staff
              ADD COLUMN IF NOT EXISTS face_descriptor DOUBLE PRECISION[],
              ADD COLUMN IF NOT EXISTS face_vec        vector(128);

            CREATE INDEX IF NOT EXISTS staff_face_vec_ivfflat
                ON %I.staff
             USING ivfflat (face_vec vector_cosine_ops) WITH (lists = 100);

            CREATE TABLE IF NOT EXISTS %I.staff_biometric_enrollments (
                id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
                gym_id          UUID         NOT NULL,
                staff_id        UUID         NOT NULL,
                provider        TEXT         NOT NULL,
                modality        TEXT         NOT NULL,
                template_ref    TEXT         NOT NULL,
                consent_log_id  UUID,
                enrolled_by     UUID         NOT NULL,
                enrolled_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                revoked_at      TIMESTAMPTZ,
                created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_staff_biometric_enrollment_%I UNIQUE (staff_id, modality, provider)
            );
            CREATE INDEX IF NOT EXISTS idx_staff_biometric_enrollments_gym_modality_%I
                ON %I.staff_biometric_enrollments (gym_id, modality);
        $f$, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name);
    END LOOP;
END $$;

ANALYZE "studio_template"."staff";

-- End of migration.
