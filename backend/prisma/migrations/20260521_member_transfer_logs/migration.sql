-- ============================================================================
-- MIGRATION: Member branch-transfer audit log (Phase 4 of multi-gym architecture)
-- ============================================================================
--
-- Append-only audit table. Created in studio_template and replicated to every
-- existing studio_* tenant schema. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "studio_template"."member_transfer_logs" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "gym_id"         UUID         NOT NULL,
    "member_id"      UUID         NOT NULL,
    "from_branch_id" UUID         NOT NULL,
    "to_branch_id"   UUID         NOT NULL,
    "reason"         TEXT,
    "transferred_by" UUID,
    "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT "member_transfer_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "member_transfer_logs_member_id_created_at_idx"
    ON "studio_template"."member_transfer_logs" ("member_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "member_transfer_logs_to_branch_id_created_at_idx"
    ON "studio_template"."member_transfer_logs" ("to_branch_id", "created_at" DESC);

DO $$
DECLARE
    s TEXT;
BEGIN
    FOR s IN
        SELECT nspname FROM pg_namespace
         WHERE nspname LIKE 'studio_%' AND nspname <> 'studio_template'
    LOOP
        EXECUTE format($f$
            CREATE TABLE IF NOT EXISTS %1$I.member_transfer_logs (
                id             UUID         NOT NULL DEFAULT gen_random_uuid(),
                gym_id         UUID         NOT NULL,
                member_id      UUID         NOT NULL,
                from_branch_id UUID         NOT NULL,
                to_branch_id   UUID         NOT NULL,
                reason         TEXT,
                transferred_by UUID,
                created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
                CONSTRAINT member_transfer_logs_pkey PRIMARY KEY (id)
            );

            CREATE INDEX IF NOT EXISTS member_transfer_logs_member_id_created_at_idx
                ON %1$I.member_transfer_logs (member_id, created_at DESC);

            CREATE INDEX IF NOT EXISTS member_transfer_logs_to_branch_id_created_at_idx
                ON %1$I.member_transfer_logs (to_branch_id, created_at DESC);
        $f$, s);
    END LOOP;
END $$;

-- End of migration.
