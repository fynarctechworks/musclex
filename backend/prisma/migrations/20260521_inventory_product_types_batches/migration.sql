-- ============================================================================
-- MIGRATION: Product types + batch/expiry tracking (Inventory Phase 2)
-- ============================================================================
--
-- 1. Adds enterprise product attributes to products:
--      product_type (physical|digital|service|subscription|consumable, default physical)
--      brand, unit_type, track_batches (default false)
-- 2. Creates product_batches: FIFO batch/expiry tracking per product+branch.
-- 3. Adds batch_id to pos_sale_items (which batch a sale line drew from).
--
-- Backward compatible: every new column is nullable or defaulted, so existing
-- products keep working as untracked "physical" goods until track_batches is set.
--
-- Idempotent: ADD COLUMN / CREATE TABLE IF NOT EXISTS, replicated across every
-- studio_* tenant schema (mirrors prior migrations in this project).
-- ============================================================================

-- ── products: new columns ──────────────────────────────────────────────────
ALTER TABLE "studio_template"."products"
  ADD COLUMN IF NOT EXISTS "product_type"  TEXT    NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS "brand"         TEXT,
  ADD COLUMN IF NOT EXISTS "unit_type"     TEXT,
  ADD COLUMN IF NOT EXISTS "track_batches" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "products_product_type_idx"
    ON "studio_template"."products" ("product_type");

-- ── product_batches ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "studio_template"."product_batches" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "gym_id"       UUID         NOT NULL,
    "product_id"   UUID         NOT NULL,
    "branch_id"    UUID         NOT NULL,
    "batch_number" TEXT         NOT NULL,
    "quantity"     INTEGER      NOT NULL DEFAULT 0,
    "cost_price"   DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expiry_date"  DATE,
    "received_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "supplier_id"  UUID,
    "status"       TEXT         NOT NULL DEFAULT 'active',
    "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT "product_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "product_batches_fifo_idx"
    ON "studio_template"."product_batches" ("product_id", "branch_id", "status", "expiry_date");
CREATE INDEX IF NOT EXISTS "product_batches_expiry_idx"
    ON "studio_template"."product_batches" ("gym_id", "status", "expiry_date");
CREATE INDEX IF NOT EXISTS "product_batches_product_id_idx"
    ON "studio_template"."product_batches" ("product_id");

-- ── pos_sale_items: batch_id ─────────────────────────────────────────────────
ALTER TABLE "studio_template"."pos_sale_items"
  ADD COLUMN IF NOT EXISTS "batch_id" UUID;

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
            ALTER TABLE %1$I.products
              ADD COLUMN IF NOT EXISTS product_type  TEXT    NOT NULL DEFAULT 'physical',
              ADD COLUMN IF NOT EXISTS brand         TEXT,
              ADD COLUMN IF NOT EXISTS unit_type     TEXT,
              ADD COLUMN IF NOT EXISTS track_batches BOOLEAN NOT NULL DEFAULT false;

            CREATE INDEX IF NOT EXISTS products_product_type_idx
                ON %1$I.products (product_type);

            CREATE TABLE IF NOT EXISTS %1$I.product_batches (
                id           UUID          NOT NULL DEFAULT gen_random_uuid(),
                gym_id       UUID          NOT NULL,
                product_id   UUID          NOT NULL,
                branch_id    UUID          NOT NULL,
                batch_number TEXT          NOT NULL,
                quantity     INTEGER       NOT NULL DEFAULT 0,
                cost_price   DECIMAL(10,2) NOT NULL DEFAULT 0,
                expiry_date  DATE,
                received_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
                supplier_id  UUID,
                status       TEXT          NOT NULL DEFAULT 'active',
                created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
                updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
                CONSTRAINT product_batches_pkey PRIMARY KEY (id)
            );

            CREATE INDEX IF NOT EXISTS product_batches_fifo_idx
                ON %1$I.product_batches (product_id, branch_id, status, expiry_date);
            CREATE INDEX IF NOT EXISTS product_batches_expiry_idx
                ON %1$I.product_batches (gym_id, status, expiry_date);
            CREATE INDEX IF NOT EXISTS product_batches_product_id_idx
                ON %1$I.product_batches (product_id);

            ALTER TABLE %1$I.pos_sale_items
              ADD COLUMN IF NOT EXISTS batch_id UUID;
        $f$, s);
    END LOOP;
END $$;

-- End of migration.
