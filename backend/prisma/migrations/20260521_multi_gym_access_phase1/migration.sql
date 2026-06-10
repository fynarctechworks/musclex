-- ============================================================================
-- MIGRATION: Multi-Gym Membership Access — Phase 1 (schema additions)
-- ============================================================================
--
-- Adds the columns and join table needed to express richer membership access
-- scopes (single-branch / multi-branch / all-access / city / time-based) without
-- changing how any existing membership behaves.
--
-- 1. membership_plans
--      + access_type             text default 'single_branch'
--      + tier                    text default 'basic'
--      + allowed_branch_ids      uuid[] default '{}'
--      + allowed_city            text
--      + allowed_hours_json      jsonb
--      + feature_flags           jsonb default '{}'
--      + branch_price_overrides  jsonb default '{}'
--      + indexes on (access_type), (tier)
--
-- 2. membership_branch_access (NEW)
--      Normalized join replacing the unindexed
--      global_access_passes.allowed_branch_ids array for fast cross-branch
--      lookups. Backfilled 1:1 from existing memberships so every active
--      membership continues to grant access to its home branch.
--
-- Idempotent: every ADD COLUMN / CREATE TABLE / CREATE INDEX uses IF NOT
-- EXISTS, then the same DDL is replayed across every studio_* schema.
-- Existing rows default to access_type='single_branch' so the legacy
-- BranchAccessRule keeps working unchanged.
-- ============================================================================

-- ── studio_template (canonical) ──────────────────────────────────────────

ALTER TABLE "studio_template"."membership_plans"
    ADD COLUMN IF NOT EXISTS "access_type" TEXT NOT NULL DEFAULT 'single_branch',
    ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'basic',
    ADD COLUMN IF NOT EXISTS "allowed_branch_ids" UUID[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS "allowed_city" TEXT,
    ADD COLUMN IF NOT EXISTS "allowed_hours_json" JSONB,
    ADD COLUMN IF NOT EXISTS "feature_flags" JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS "branch_price_overrides" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "membership_plans_access_type_idx"
    ON "studio_template"."membership_plans" ("access_type");

CREATE INDEX IF NOT EXISTS "membership_plans_tier_idx"
    ON "studio_template"."membership_plans" ("tier");

-- Backfill: any plan that historically had multi_branch_access=true is now
-- explicitly access_type='multi_branch'. Plans flagged plan_type='global_access'
-- become access_type='all_access'. Everything else stays single_branch.
UPDATE "studio_template"."membership_plans"
   SET "access_type" = 'multi_branch'
 WHERE "multi_branch_access" = TRUE
   AND "access_type" = 'single_branch'
   AND "plan_type" <> 'global_access';

UPDATE "studio_template"."membership_plans"
   SET "access_type" = 'all_access'
 WHERE "plan_type" = 'global_access'
   AND "access_type" = 'single_branch';

-- ── membership_branch_access (new join table) ────────────────────────────

CREATE TABLE IF NOT EXISTS "studio_template"."membership_branch_access" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "gym_id"        UUID         NOT NULL,
    "membership_id" UUID         NOT NULL,
    "branch_id"     UUID         NOT NULL,
    "granted_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "granted_by"    UUID,
    "expires_at"    TIMESTAMPTZ,
    "reason"        TEXT,
    "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "membership_branch_access_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "membership_branch_access_membership_id_branch_id_key"
        UNIQUE ("membership_id", "branch_id"),
    CONSTRAINT "membership_branch_access_membership_id_fkey"
        FOREIGN KEY ("membership_id")
        REFERENCES "studio_template"."member_memberships"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "membership_branch_access_branch_id_fkey"
        FOREIGN KEY ("branch_id")
        REFERENCES "studio_template"."branches"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "membership_branch_access_branch_id_expires_at_idx"
    ON "studio_template"."membership_branch_access" ("branch_id", "expires_at");

CREATE INDEX IF NOT EXISTS "membership_branch_access_membership_id_idx"
    ON "studio_template"."membership_branch_access" ("membership_id");

-- Backfill: every existing membership grants access to its home branch.
-- Safe to re-run — ON CONFLICT DO NOTHING uses the unique (membership_id, branch_id).
INSERT INTO "studio_template"."membership_branch_access"
       ("gym_id", "membership_id", "branch_id", "reason")
SELECT mm."gym_id", mm."id", mm."branch_id", 'phase1_backfill'
  FROM "studio_template"."member_memberships" mm
 WHERE NOT EXISTS (
     SELECT 1 FROM "studio_template"."membership_branch_access" mba
      WHERE mba."membership_id" = mm."id"
        AND mba."branch_id" = mm."branch_id"
 );

-- ── Replicate to every existing studio_* tenant schema ───────────────────

DO $$
DECLARE
    s TEXT;
BEGIN
    FOR s IN
        SELECT nspname FROM pg_namespace
         WHERE nspname LIKE 'studio_%' AND nspname <> 'studio_template'
    LOOP
        EXECUTE format($f$
            ALTER TABLE %1$I.membership_plans
                ADD COLUMN IF NOT EXISTS access_type            TEXT   NOT NULL DEFAULT 'single_branch',
                ADD COLUMN IF NOT EXISTS tier                   TEXT   NOT NULL DEFAULT 'basic',
                ADD COLUMN IF NOT EXISTS allowed_branch_ids     UUID[] NOT NULL DEFAULT '{}',
                ADD COLUMN IF NOT EXISTS allowed_city           TEXT,
                ADD COLUMN IF NOT EXISTS allowed_hours_json     JSONB,
                ADD COLUMN IF NOT EXISTS feature_flags          JSONB  NOT NULL DEFAULT '{}',
                ADD COLUMN IF NOT EXISTS branch_price_overrides JSONB  NOT NULL DEFAULT '{}';

            CREATE INDEX IF NOT EXISTS membership_plans_access_type_idx
                ON %1$I.membership_plans (access_type);

            CREATE INDEX IF NOT EXISTS membership_plans_tier_idx
                ON %1$I.membership_plans (tier);

            UPDATE %1$I.membership_plans
               SET access_type = 'multi_branch'
             WHERE multi_branch_access = TRUE
               AND access_type = 'single_branch'
               AND plan_type <> 'global_access';

            UPDATE %1$I.membership_plans
               SET access_type = 'all_access'
             WHERE plan_type = 'global_access'
               AND access_type = 'single_branch';

            CREATE TABLE IF NOT EXISTS %1$I.membership_branch_access (
                id            UUID         NOT NULL DEFAULT gen_random_uuid(),
                gym_id        UUID         NOT NULL,
                membership_id UUID         NOT NULL,
                branch_id     UUID         NOT NULL,
                granted_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
                granted_by    UUID,
                expires_at    TIMESTAMPTZ,
                reason        TEXT,
                created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
                CONSTRAINT membership_branch_access_pkey PRIMARY KEY (id),
                CONSTRAINT membership_branch_access_membership_id_branch_id_key
                    UNIQUE (membership_id, branch_id),
                CONSTRAINT membership_branch_access_membership_id_fkey
                    FOREIGN KEY (membership_id)
                    REFERENCES %1$I.member_memberships(id)
                    ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT membership_branch_access_branch_id_fkey
                    FOREIGN KEY (branch_id)
                    REFERENCES %1$I.branches(id)
                    ON DELETE RESTRICT ON UPDATE CASCADE
            );

            CREATE INDEX IF NOT EXISTS membership_branch_access_branch_id_expires_at_idx
                ON %1$I.membership_branch_access (branch_id, expires_at);

            CREATE INDEX IF NOT EXISTS membership_branch_access_membership_id_idx
                ON %1$I.membership_branch_access (membership_id);

            INSERT INTO %1$I.membership_branch_access
                   (gym_id, membership_id, branch_id, reason)
            SELECT mm.gym_id, mm.id, mm.branch_id, 'phase1_backfill'
              FROM %1$I.member_memberships mm
             WHERE NOT EXISTS (
                 SELECT 1 FROM %1$I.membership_branch_access mba
                  WHERE mba.membership_id = mm.id
                    AND mba.branch_id = mm.branch_id
             );
        $f$, s);
    END LOOP;
END $$;

-- End of migration.
