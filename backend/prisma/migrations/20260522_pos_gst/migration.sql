-- ============================================================================
-- MIGRATION: GST split on POS sales + line items
-- ============================================================================
-- Adds:
--   studio_*.pos_sales:      cgst_amount, sgst_amount, igst_amount, place_of_supply
--   studio_*.pos_sale_items: hsn_sac, tax_rate, cgst_amount, sgst_amount, igst_amount
--
-- Idempotent, replicated to every existing studio_* tenant schema.
-- ============================================================================

ALTER TABLE "studio_template"."pos_sales"
    ADD COLUMN IF NOT EXISTS "cgst_amount"     DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "sgst_amount"     DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "igst_amount"     DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "place_of_supply" TEXT;

ALTER TABLE "studio_template"."pos_sale_items"
    ADD COLUMN IF NOT EXISTS "hsn_sac"     TEXT,
    ADD COLUMN IF NOT EXISTS "tax_rate"    DECIMAL(5,2)  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "cgst_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "sgst_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "igst_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

DO $$
DECLARE s TEXT;
BEGIN
    FOR s IN
        SELECT nspname FROM pg_namespace
         WHERE nspname LIKE 'studio_%' AND nspname <> 'studio_template'
    LOOP
        EXECUTE format($f$
            ALTER TABLE %1$I.pos_sales
                ADD COLUMN IF NOT EXISTS cgst_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS sgst_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS igst_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS place_of_supply TEXT;

            ALTER TABLE %1$I.pos_sale_items
                ADD COLUMN IF NOT EXISTS hsn_sac     TEXT,
                ADD COLUMN IF NOT EXISTS tax_rate    DECIMAL(5,2)  NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS igst_amount DECIMAL(10,2) NOT NULL DEFAULT 0;
        $f$, s);
    END LOOP;
END $$;
