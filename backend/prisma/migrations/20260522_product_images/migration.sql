-- ============================================================================
-- MIGRATION: Multi-image products
-- ============================================================================
-- Adds studio_*.product_images — ordered image gallery per product.
-- Product.image_url is retained as the denormalized primary thumbnail.
--
-- Idempotent, replicated to every existing studio_* tenant schema.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "studio_template"."product_images" (
    "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
    "gym_id"     UUID         NOT NULL,
    "product_id" UUID         NOT NULL,
    "image_url"  TEXT         NOT NULL,
    "alt_text"   TEXT,
    "sort_order" INTEGER      NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN      NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id")
        REFERENCES "studio_template"."products"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "product_images_product_id_idx"
    ON "studio_template"."product_images"("product_id");
CREATE INDEX IF NOT EXISTS "product_images_gym_id_idx"
    ON "studio_template"."product_images"("gym_id");

DO $$
DECLARE s TEXT;
BEGIN
    FOR s IN
        SELECT nspname FROM pg_namespace
         WHERE nspname LIKE 'studio_%' AND nspname <> 'studio_template'
    LOOP
        EXECUTE format($f$
            CREATE TABLE IF NOT EXISTS %1$I.product_images (
                id         UUID        NOT NULL DEFAULT gen_random_uuid(),
                gym_id     UUID        NOT NULL,
                product_id UUID        NOT NULL,
                image_url  TEXT        NOT NULL,
                alt_text   TEXT,
                sort_order INTEGER     NOT NULL DEFAULT 0,
                is_primary BOOLEAN     NOT NULL DEFAULT false,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT product_images_pkey PRIMARY KEY (id),
                CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id)
                    REFERENCES %1$I.products(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS product_images_product_id_idx
                ON %1$I.product_images(product_id);
            CREATE INDEX IF NOT EXISTS product_images_gym_id_idx
                ON %1$I.product_images(gym_id);
        $f$, s);
    END LOOP;
END $$;
