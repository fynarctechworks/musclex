-- ============================================================================
-- MIGRATION: Document engine + GST tax-invoice fields
-- ============================================================================
-- Adds:
--   public.studios:        gstin, gst_state_code, default_hsn, invoice_prefix, invoice_terms
--   studio_*.branches:     gstin, gst_state_code
--   studio_*.member_invoices: cgst_amount, sgst_amount, igst_amount, place_of_supply
--   studio_*.invoice_items:   hsn_sac, tax_rate, cgst_amount, sgst_amount, igst_amount
--   studio_*.documents          (new)
--   studio_*.document_deliveries (new)
--
-- Idempotent, replicated to every existing studio_* tenant schema.
-- ============================================================================

-- ── public.studios (single row per studio) ─────────────────────────────────
ALTER TABLE "public"."studios"
    ADD COLUMN IF NOT EXISTS "gstin"           TEXT,
    ADD COLUMN IF NOT EXISTS "gst_state_code"  TEXT,
    ADD COLUMN IF NOT EXISTS "default_hsn"     TEXT,
    ADD COLUMN IF NOT EXISTS "invoice_prefix"  TEXT,
    ADD COLUMN IF NOT EXISTS "invoice_terms"   TEXT;

-- ── studio_template additions ──────────────────────────────────────────────
ALTER TABLE "studio_template"."branches"
    ADD COLUMN IF NOT EXISTS "gstin"          TEXT,
    ADD COLUMN IF NOT EXISTS "gst_state_code" TEXT;

ALTER TABLE "studio_template"."member_invoices"
    ADD COLUMN IF NOT EXISTS "cgst_amount"     DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "sgst_amount"     DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "igst_amount"     DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "place_of_supply" TEXT;

ALTER TABLE "studio_template"."invoice_items"
    ADD COLUMN IF NOT EXISTS "hsn_sac"     TEXT,
    ADD COLUMN IF NOT EXISTS "tax_rate"    DECIMAL(5,2)  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "cgst_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "sgst_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "igst_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "studio_template"."documents" (
    "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
    "gym_id"          UUID        NOT NULL,
    "branch_id"       UUID,
    "source_type"     TEXT        NOT NULL,
    "source_id"       UUID        NOT NULL,
    "doc_type"        TEXT        NOT NULL,
    "format"          TEXT        NOT NULL DEFAULT 'a4',
    "storage_bucket"  TEXT        NOT NULL DEFAULT 'documents',
    "storage_path"    TEXT        NOT NULL,
    "size_bytes"      INTEGER     NOT NULL DEFAULT 0,
    "checksum_sha256" TEXT,
    "status"          TEXT        NOT NULL DEFAULT 'ready',
    "error"           TEXT,
    "payload"         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    "invoice_number"  TEXT,
    "version"         INTEGER     NOT NULL DEFAULT 1,
    "generated_by"    UUID,
    "generated_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "documents_source_idx"
    ON "studio_template"."documents" ("source_type", "source_id");
CREATE INDEX IF NOT EXISTS "documents_gym_generated_idx"
    ON "studio_template"."documents" ("gym_id", "generated_at");
CREATE INDEX IF NOT EXISTS "documents_status_idx"
    ON "studio_template"."documents" ("status");

CREATE TABLE IF NOT EXISTS "studio_template"."document_deliveries" (
    "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
    "gym_id"          UUID        NOT NULL,
    "document_id"     UUID        NOT NULL,
    "channel"         TEXT        NOT NULL,
    "recipient"       TEXT        NOT NULL,
    "status"          TEXT        NOT NULL DEFAULT 'queued',
    "provider"        TEXT,
    "provider_msg_id" TEXT,
    "error"           TEXT,
    "attempts"        INTEGER     NOT NULL DEFAULT 0,
    "sent_at"         TIMESTAMPTZ,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "document_deliveries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_deliveries_document_id_fkey"
        FOREIGN KEY ("document_id") REFERENCES "studio_template"."documents" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "document_deliveries_document_idx"
    ON "studio_template"."document_deliveries" ("document_id");
CREATE INDEX IF NOT EXISTS "document_deliveries_status_idx"
    ON "studio_template"."document_deliveries" ("status");
CREATE INDEX IF NOT EXISTS "document_deliveries_channel_status_idx"
    ON "studio_template"."document_deliveries" ("channel", "status");

-- ── Replicate to every existing studio_* tenant schema ─────────────────────
DO $$
DECLARE s TEXT;
BEGIN
    FOR s IN
        SELECT nspname FROM pg_namespace
         WHERE nspname LIKE 'studio_%' AND nspname <> 'studio_template'
    LOOP
        EXECUTE format($f$
            ALTER TABLE %1$I.branches
                ADD COLUMN IF NOT EXISTS gstin          TEXT,
                ADD COLUMN IF NOT EXISTS gst_state_code TEXT;

            ALTER TABLE %1$I.member_invoices
                ADD COLUMN IF NOT EXISTS cgst_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS sgst_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS igst_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS place_of_supply TEXT;

            ALTER TABLE %1$I.invoice_items
                ADD COLUMN IF NOT EXISTS hsn_sac     TEXT,
                ADD COLUMN IF NOT EXISTS tax_rate    DECIMAL(5,2)  NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS igst_amount DECIMAL(10,2) NOT NULL DEFAULT 0;

            CREATE TABLE IF NOT EXISTS %1$I.documents (
                id              UUID        NOT NULL DEFAULT gen_random_uuid(),
                gym_id          UUID        NOT NULL,
                branch_id       UUID,
                source_type     TEXT        NOT NULL,
                source_id       UUID        NOT NULL,
                doc_type        TEXT        NOT NULL,
                format          TEXT        NOT NULL DEFAULT 'a4',
                storage_bucket  TEXT        NOT NULL DEFAULT 'documents',
                storage_path    TEXT        NOT NULL,
                size_bytes      INTEGER     NOT NULL DEFAULT 0,
                checksum_sha256 TEXT,
                status          TEXT        NOT NULL DEFAULT 'ready',
                error           TEXT,
                payload         JSONB       NOT NULL DEFAULT '{}'::jsonb,
                invoice_number  TEXT,
                version         INTEGER     NOT NULL DEFAULT 1,
                generated_by    UUID,
                generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT documents_pkey PRIMARY KEY (id)
            );
            CREATE INDEX IF NOT EXISTS documents_source_idx
                ON %1$I.documents (source_type, source_id);
            CREATE INDEX IF NOT EXISTS documents_gym_generated_idx
                ON %1$I.documents (gym_id, generated_at);
            CREATE INDEX IF NOT EXISTS documents_status_idx
                ON %1$I.documents (status);

            CREATE TABLE IF NOT EXISTS %1$I.document_deliveries (
                id              UUID        NOT NULL DEFAULT gen_random_uuid(),
                gym_id          UUID        NOT NULL,
                document_id     UUID        NOT NULL,
                channel         TEXT        NOT NULL,
                recipient       TEXT        NOT NULL,
                status          TEXT        NOT NULL DEFAULT 'queued',
                provider        TEXT,
                provider_msg_id TEXT,
                error           TEXT,
                attempts        INTEGER     NOT NULL DEFAULT 0,
                sent_at         TIMESTAMPTZ,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT document_deliveries_pkey PRIMARY KEY (id),
                CONSTRAINT document_deliveries_document_id_fkey
                    FOREIGN KEY (document_id) REFERENCES %1$I.documents (id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS document_deliveries_document_idx
                ON %1$I.document_deliveries (document_id);
            CREATE INDEX IF NOT EXISTS document_deliveries_status_idx
                ON %1$I.document_deliveries (status);
            CREATE INDEX IF NOT EXISTS document_deliveries_channel_status_idx
                ON %1$I.document_deliveries (channel, status);
        $f$, s);
    END LOOP;
END $$;
