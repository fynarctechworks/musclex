-- ============================================================================
-- MIGRATION: Member wallet & loyalty (Phase 4)
-- ============================================================================
--
-- 1. wallets: one stored-value + points wallet per member.
-- 2. wallet_transactions: append-only ledger of money/points movements.
-- 3. loyalty_configs: per-gym earn/redeem economics (one row per gym).
-- 4. pos_sales: points_earned, points_redeemed, wallet_amount columns.
--
-- Backward compatible (new tables + defaulted columns). Idempotent, replicated
-- across every studio_* tenant schema.
-- ============================================================================

-- ── studio_template ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "studio_template"."wallets" (
    "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
    "gym_id"         UUID          NOT NULL,
    "member_id"      UUID          NOT NULL,
    "balance"        DECIMAL(10,2) NOT NULL DEFAULT 0,
    "points_balance" INTEGER       NOT NULL DEFAULT 0,
    "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "wallets_member_id_key"
    ON "studio_template"."wallets" ("member_id");
CREATE INDEX IF NOT EXISTS "wallets_gym_id_idx"
    ON "studio_template"."wallets" ("gym_id");

CREATE TABLE IF NOT EXISTS "studio_template"."wallet_transactions" (
    "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
    "gym_id"         UUID          NOT NULL,
    "wallet_id"      UUID          NOT NULL,
    "type"           TEXT          NOT NULL,
    "amount"         DECIMAL(10,2) NOT NULL DEFAULT 0,
    "points"         INTEGER       NOT NULL DEFAULT 0,
    "balance_after"  DECIMAL(10,2) NOT NULL,
    "points_after"   INTEGER       NOT NULL,
    "reference_id"   UUID,
    "reference_type" TEXT,
    "notes"          TEXT,
    "created_by"     UUID,
    "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "wallet_transactions_wallet_id_created_at_idx"
    ON "studio_template"."wallet_transactions" ("wallet_id", "created_at");
CREATE INDEX IF NOT EXISTS "wallet_transactions_type_idx"
    ON "studio_template"."wallet_transactions" ("type");
CREATE INDEX IF NOT EXISTS "wallet_transactions_reference_id_idx"
    ON "studio_template"."wallet_transactions" ("reference_id");

CREATE TABLE IF NOT EXISTS "studio_template"."loyalty_configs" (
    "id"                     UUID          NOT NULL DEFAULT gen_random_uuid(),
    "gym_id"                 UUID          NOT NULL,
    "is_active"              BOOLEAN       NOT NULL DEFAULT false,
    "points_per_currency"    DECIMAL(10,4) NOT NULL DEFAULT 1,
    "redeem_value_per_point" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "min_redeem_points"      INTEGER       NOT NULL DEFAULT 0,
    "created_at"             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT "loyalty_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_configs_gym_id_key"
    ON "studio_template"."loyalty_configs" ("gym_id");

ALTER TABLE "studio_template"."pos_sales"
  ADD COLUMN IF NOT EXISTS "points_earned"   INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "points_redeemed" INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "wallet_amount"   DECIMAL(10,2) NOT NULL DEFAULT 0;

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
            CREATE TABLE IF NOT EXISTS %1$I.wallets (
                id             UUID          NOT NULL DEFAULT gen_random_uuid(),
                gym_id         UUID          NOT NULL,
                member_id      UUID          NOT NULL,
                balance        DECIMAL(10,2) NOT NULL DEFAULT 0,
                points_balance INTEGER       NOT NULL DEFAULT 0,
                created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
                updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
                CONSTRAINT wallets_pkey PRIMARY KEY (id)
            );
            CREATE UNIQUE INDEX IF NOT EXISTS wallets_member_id_key ON %1$I.wallets (member_id);
            CREATE INDEX IF NOT EXISTS wallets_gym_id_idx ON %1$I.wallets (gym_id);

            CREATE TABLE IF NOT EXISTS %1$I.wallet_transactions (
                id             UUID          NOT NULL DEFAULT gen_random_uuid(),
                gym_id         UUID          NOT NULL,
                wallet_id      UUID          NOT NULL,
                type           TEXT          NOT NULL,
                amount         DECIMAL(10,2) NOT NULL DEFAULT 0,
                points         INTEGER       NOT NULL DEFAULT 0,
                balance_after  DECIMAL(10,2) NOT NULL,
                points_after   INTEGER       NOT NULL,
                reference_id   UUID,
                reference_type TEXT,
                notes          TEXT,
                created_by     UUID,
                created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
                CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id)
            );
            CREATE INDEX IF NOT EXISTS wallet_transactions_wallet_id_created_at_idx
                ON %1$I.wallet_transactions (wallet_id, created_at);
            CREATE INDEX IF NOT EXISTS wallet_transactions_type_idx ON %1$I.wallet_transactions (type);
            CREATE INDEX IF NOT EXISTS wallet_transactions_reference_id_idx
                ON %1$I.wallet_transactions (reference_id);

            CREATE TABLE IF NOT EXISTS %1$I.loyalty_configs (
                id                     UUID          NOT NULL DEFAULT gen_random_uuid(),
                gym_id                 UUID          NOT NULL,
                is_active              BOOLEAN       NOT NULL DEFAULT false,
                points_per_currency    DECIMAL(10,4) NOT NULL DEFAULT 1,
                redeem_value_per_point DECIMAL(10,4) NOT NULL DEFAULT 1,
                min_redeem_points      INTEGER       NOT NULL DEFAULT 0,
                created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
                updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
                CONSTRAINT loyalty_configs_pkey PRIMARY KEY (id)
            );
            CREATE UNIQUE INDEX IF NOT EXISTS loyalty_configs_gym_id_key ON %1$I.loyalty_configs (gym_id);

            ALTER TABLE %1$I.pos_sales
              ADD COLUMN IF NOT EXISTS points_earned   INTEGER       NOT NULL DEFAULT 0,
              ADD COLUMN IF NOT EXISTS points_redeemed INTEGER       NOT NULL DEFAULT 0,
              ADD COLUMN IF NOT EXISTS wallet_amount   DECIMAL(10,2) NOT NULL DEFAULT 0;
        $f$, s);
    END LOOP;
END $$;

-- End of migration.
