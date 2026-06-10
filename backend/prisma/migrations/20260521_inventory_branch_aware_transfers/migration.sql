-- ============================================================================
-- MIGRATION: Branch-aware inventory + per-branch pricing + stock transfers
--            (Inventory Phase 3)
-- ============================================================================
--
-- 1. Shared catalog, per-branch stock:
--      - Drop global UNIQUE(inventory.product_id); add UNIQUE(product_id, branch_id)
--        so one product can hold stock at many branches.
--      - Drop global UNIQUE(products.sku) / UNIQUE(products.barcode); rely on the
--        per-gym partial unique indexes uq_products_gym_sku / _gym_barcode
--        (created here IF NOT EXISTS for safety).
-- 2. branch_product_prices: per-branch price/tax override (falls back to product).
-- 3. stock_transfers + stock_transfer_items: branch-to-branch transfer workflow,
--      batch-aware (source_batch_id + expiry carried to destination).
--
-- Tenant tables are currently empty, so no data backfill is required. All DDL is
-- idempotent (IF [NOT] EXISTS) and replicated across every studio_* tenant schema.
-- ============================================================================

-- ── studio_template ─────────────────────────────────────────────────────────

-- 1a. inventory: per-branch uniqueness
DROP INDEX IF EXISTS "studio_template"."inventory_product_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_product_id_branch_id_key"
    ON "studio_template"."inventory" ("product_id", "branch_id");

-- 1b. products: drop global sku/barcode uniqueness, keep per-gym partial uniques
DROP INDEX IF EXISTS "studio_template"."products_sku_key";
DROP INDEX IF EXISTS "studio_template"."products_barcode_key";
CREATE UNIQUE INDEX IF NOT EXISTS "uq_products_gym_sku"
    ON "studio_template"."products" ("gym_id", "sku") WHERE "sku" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "uq_products_gym_barcode"
    ON "studio_template"."products" ("gym_id", "barcode") WHERE "barcode" IS NOT NULL;

-- 2. branch_product_prices
CREATE TABLE IF NOT EXISTS "studio_template"."branch_product_prices" (
    "id"         UUID          NOT NULL DEFAULT gen_random_uuid(),
    "gym_id"     UUID          NOT NULL,
    "product_id" UUID          NOT NULL,
    "branch_id"  UUID          NOT NULL,
    "price"      DECIMAL(10,2) NOT NULL,
    "tax_rate"   DECIMAL(5,2),
    "created_at" TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT "branch_product_prices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "branch_product_prices_product_id_branch_id_key"
    ON "studio_template"."branch_product_prices" ("product_id", "branch_id");
CREATE INDEX IF NOT EXISTS "branch_product_prices_branch_id_idx"
    ON "studio_template"."branch_product_prices" ("branch_id");

-- 3. stock_transfers
CREATE TABLE IF NOT EXISTS "studio_template"."stock_transfers" (
    "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
    "gym_id"          UUID        NOT NULL,
    "transfer_number" TEXT        NOT NULL,
    "from_branch_id"  UUID        NOT NULL,
    "to_branch_id"    UUID        NOT NULL,
    "status"          TEXT        NOT NULL DEFAULT 'pending',
    "notes"           TEXT,
    "initiated_by"    UUID,
    "received_by"     UUID,
    "dispatched_at"   TIMESTAMPTZ,
    "received_at"     TIMESTAMPTZ,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "stock_transfers_transfer_number_key"
    ON "studio_template"."stock_transfers" ("transfer_number");
CREATE INDEX IF NOT EXISTS "stock_transfers_from_branch_id_created_at_idx"
    ON "studio_template"."stock_transfers" ("from_branch_id", "created_at");
CREATE INDEX IF NOT EXISTS "stock_transfers_to_branch_id_created_at_idx"
    ON "studio_template"."stock_transfers" ("to_branch_id", "created_at");
CREATE INDEX IF NOT EXISTS "stock_transfers_status_idx"
    ON "studio_template"."stock_transfers" ("status");

-- 3b. stock_transfer_items
CREATE TABLE IF NOT EXISTS "studio_template"."stock_transfer_items" (
    "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
    "gym_id"          UUID        NOT NULL,
    "transfer_id"     UUID        NOT NULL,
    "product_id"      UUID        NOT NULL,
    "source_batch_id" UUID,
    "batch_number"    TEXT,
    "expiry_date"     DATE,
    "quantity"        INTEGER     NOT NULL,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "stock_transfer_items_transfer_id_idx"
    ON "studio_template"."stock_transfer_items" ("transfer_id");
CREATE INDEX IF NOT EXISTS "stock_transfer_items_product_id_idx"
    ON "studio_template"."stock_transfer_items" ("product_id");

-- ── Replicate to every existing studio_* tenant schema ──────────────────────
DO $$
DECLARE
    s TEXT;
BEGIN
    FOR s IN
        SELECT nspname FROM pg_namespace
         WHERE nspname LIKE 'studio_%' AND nspname <> 'studio_template'
    LOOP
        EXECUTE format($f$
            DROP INDEX IF EXISTS %1$I.inventory_product_id_key;
            CREATE UNIQUE INDEX IF NOT EXISTS inventory_product_id_branch_id_key
                ON %1$I.inventory (product_id, branch_id);

            DROP INDEX IF EXISTS %1$I.products_sku_key;
            DROP INDEX IF EXISTS %1$I.products_barcode_key;
            CREATE UNIQUE INDEX IF NOT EXISTS uq_products_gym_sku
                ON %1$I.products (gym_id, sku) WHERE sku IS NOT NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS uq_products_gym_barcode
                ON %1$I.products (gym_id, barcode) WHERE barcode IS NOT NULL;

            CREATE TABLE IF NOT EXISTS %1$I.branch_product_prices (
                id         UUID          NOT NULL DEFAULT gen_random_uuid(),
                gym_id     UUID          NOT NULL,
                product_id UUID          NOT NULL,
                branch_id  UUID          NOT NULL,
                price      DECIMAL(10,2) NOT NULL,
                tax_rate   DECIMAL(5,2),
                created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
                CONSTRAINT branch_product_prices_pkey PRIMARY KEY (id)
            );
            CREATE UNIQUE INDEX IF NOT EXISTS branch_product_prices_product_id_branch_id_key
                ON %1$I.branch_product_prices (product_id, branch_id);
            CREATE INDEX IF NOT EXISTS branch_product_prices_branch_id_idx
                ON %1$I.branch_product_prices (branch_id);

            CREATE TABLE IF NOT EXISTS %1$I.stock_transfers (
                id              UUID        NOT NULL DEFAULT gen_random_uuid(),
                gym_id          UUID        NOT NULL,
                transfer_number TEXT        NOT NULL,
                from_branch_id  UUID        NOT NULL,
                to_branch_id    UUID        NOT NULL,
                status          TEXT        NOT NULL DEFAULT 'pending',
                notes           TEXT,
                initiated_by    UUID,
                received_by     UUID,
                dispatched_at   TIMESTAMPTZ,
                received_at     TIMESTAMPTZ,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT stock_transfers_pkey PRIMARY KEY (id)
            );
            CREATE UNIQUE INDEX IF NOT EXISTS stock_transfers_transfer_number_key
                ON %1$I.stock_transfers (transfer_number);
            CREATE INDEX IF NOT EXISTS stock_transfers_from_branch_id_created_at_idx
                ON %1$I.stock_transfers (from_branch_id, created_at);
            CREATE INDEX IF NOT EXISTS stock_transfers_to_branch_id_created_at_idx
                ON %1$I.stock_transfers (to_branch_id, created_at);
            CREATE INDEX IF NOT EXISTS stock_transfers_status_idx
                ON %1$I.stock_transfers (status);

            CREATE TABLE IF NOT EXISTS %1$I.stock_transfer_items (
                id              UUID        NOT NULL DEFAULT gen_random_uuid(),
                gym_id          UUID        NOT NULL,
                transfer_id     UUID        NOT NULL,
                product_id      UUID        NOT NULL,
                source_batch_id UUID,
                batch_number    TEXT,
                expiry_date     DATE,
                quantity        INTEGER     NOT NULL,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT stock_transfer_items_pkey PRIMARY KEY (id)
            );
            CREATE INDEX IF NOT EXISTS stock_transfer_items_transfer_id_idx
                ON %1$I.stock_transfer_items (transfer_id);
            CREATE INDEX IF NOT EXISTS stock_transfer_items_product_id_idx
                ON %1$I.stock_transfer_items (product_id);
        $f$, s);
    END LOOP;
END $$;

-- End of migration.
