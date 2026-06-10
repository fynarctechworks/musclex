-- ============================================================================
-- MIGRATION: Combo / bundle products (Phase 5)
-- ============================================================================
--
-- bundles: sellable composite product with its own price (independent of components).
-- bundle_items: components (product + quantity); a product appears at most once.
-- pos_sale_items.bundle_id: groups component sale rows from the same bundle sale.
--
-- Idempotent, replicated across every studio_* tenant schema.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "studio_template"."bundles" (
    "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
    "gym_id"          UUID          NOT NULL,
    "organization_id" UUID,
    "branch_id"       UUID,
    "name"            TEXT          NOT NULL,
    "description"     TEXT,
    "sku"             TEXT,
    "price"           DECIMAL(10,2) NOT NULL,
    "tax_rate"        DECIMAL(5,2)  NOT NULL DEFAULT 0,
    "image_url"       TEXT,
    "status"          TEXT          NOT NULL DEFAULT 'active',
    "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT "bundles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_bundles_gym_sku"
    ON "studio_template"."bundles" ("gym_id", "sku") WHERE "sku" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "bundles_branch_id_idx"
    ON "studio_template"."bundles" ("branch_id");
CREATE INDEX IF NOT EXISTS "bundles_status_idx"
    ON "studio_template"."bundles" ("status");

CREATE TABLE IF NOT EXISTS "studio_template"."bundle_items" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "gym_id"     UUID        NOT NULL,
    "bundle_id"  UUID        NOT NULL,
    "product_id" UUID        NOT NULL,
    "quantity"   INTEGER     NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "bundle_items_bundle_id_product_id_key"
    ON "studio_template"."bundle_items" ("bundle_id", "product_id");
CREATE INDEX IF NOT EXISTS "bundle_items_bundle_id_idx"
    ON "studio_template"."bundle_items" ("bundle_id");
CREATE INDEX IF NOT EXISTS "bundle_items_product_id_idx"
    ON "studio_template"."bundle_items" ("product_id");

ALTER TABLE "studio_template"."pos_sale_items"
  ADD COLUMN IF NOT EXISTS "bundle_id" UUID;
CREATE INDEX IF NOT EXISTS "pos_sale_items_bundle_id_idx"
    ON "studio_template"."pos_sale_items" ("bundle_id");

-- ── Replicate to every existing studio_* tenant schema ──────────────────────
DO $$
DECLARE s TEXT;
BEGIN
    FOR s IN
        SELECT nspname FROM pg_namespace
         WHERE nspname LIKE 'studio_%' AND nspname <> 'studio_template'
    LOOP
        EXECUTE format($f$
            CREATE TABLE IF NOT EXISTS %1$I.bundles (
                id              UUID          NOT NULL DEFAULT gen_random_uuid(),
                gym_id          UUID          NOT NULL,
                organization_id UUID,
                branch_id       UUID,
                name            TEXT          NOT NULL,
                description     TEXT,
                sku             TEXT,
                price           DECIMAL(10,2) NOT NULL,
                tax_rate        DECIMAL(5,2)  NOT NULL DEFAULT 0,
                image_url       TEXT,
                status          TEXT          NOT NULL DEFAULT 'active',
                created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
                updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
                CONSTRAINT bundles_pkey PRIMARY KEY (id)
            );
            CREATE UNIQUE INDEX IF NOT EXISTS uq_bundles_gym_sku
                ON %1$I.bundles (gym_id, sku) WHERE sku IS NOT NULL;
            CREATE INDEX IF NOT EXISTS bundles_branch_id_idx ON %1$I.bundles (branch_id);
            CREATE INDEX IF NOT EXISTS bundles_status_idx    ON %1$I.bundles (status);

            CREATE TABLE IF NOT EXISTS %1$I.bundle_items (
                id         UUID        NOT NULL DEFAULT gen_random_uuid(),
                gym_id     UUID        NOT NULL,
                bundle_id  UUID        NOT NULL,
                product_id UUID        NOT NULL,
                quantity   INTEGER     NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT bundle_items_pkey PRIMARY KEY (id)
            );
            CREATE UNIQUE INDEX IF NOT EXISTS bundle_items_bundle_id_product_id_key
                ON %1$I.bundle_items (bundle_id, product_id);
            CREATE INDEX IF NOT EXISTS bundle_items_bundle_id_idx ON %1$I.bundle_items (bundle_id);
            CREATE INDEX IF NOT EXISTS bundle_items_product_id_idx ON %1$I.bundle_items (product_id);

            ALTER TABLE %1$I.pos_sale_items
              ADD COLUMN IF NOT EXISTS bundle_id UUID;
            CREATE INDEX IF NOT EXISTS pos_sale_items_bundle_id_idx
                ON %1$I.pos_sale_items (bundle_id);
        $f$, s);
    END LOOP;
END $$;
