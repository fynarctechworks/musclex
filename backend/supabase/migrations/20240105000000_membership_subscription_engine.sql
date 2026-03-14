-- Module 5: Membership & Subscription Engine
-- Extends membership_plans and member_memberships, adds freeze history,
-- family memberships, corporate accounts, and global access passes.

-- ─── Extend membership_plans ────────────────────────────────────

ALTER TABLE "studio_template"."membership_plans"
  ADD COLUMN IF NOT EXISTS "organization_id" UUID REFERENCES "studio_template"."organizations"("id"),
  ADD COLUMN IF NOT EXISTS "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS "max_visits" INTEGER,
  ADD COLUMN IF NOT EXISTS "multi_branch_access" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "grace_period_days" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS "idx_membership_plans_organization_id"
  ON "studio_template"."membership_plans"("organization_id");

CREATE INDEX IF NOT EXISTS "idx_membership_plans_plan_type"
  ON "studio_template"."membership_plans"("plan_type");

-- ─── Extend member_memberships ──────────────────────────────────

ALTER TABLE "studio_template"."member_memberships"
  ADD COLUMN IF NOT EXISTS "remaining_visits" INTEGER,
  ADD COLUMN IF NOT EXISTS "grace_end_date" DATE;

CREATE INDEX IF NOT EXISTS "idx_member_memberships_status_end_date"
  ON "studio_template"."member_memberships"("status", "end_date");

CREATE INDEX IF NOT EXISTS "idx_member_memberships_auto_renew_status"
  ON "studio_template"."member_memberships"("auto_renew", "status");

-- ─── Membership Freeze History ──────────────────────────────────

CREATE TABLE IF NOT EXISTS "studio_template"."membership_freezes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "membership_id" UUID NOT NULL REFERENCES "studio_template"."member_memberships"("id") ON DELETE CASCADE,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "reason" TEXT,
  "approved_by_id" UUID REFERENCES "studio_template"."staff"("id"),
  "days_frozen" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_membership_freezes_membership_id"
  ON "studio_template"."membership_freezes"("membership_id");

-- ─── Family Memberships ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "studio_template"."family_memberships" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "primary_member_id" UUID NOT NULL REFERENCES "studio_template"."members"("id"),
  "membership_id" UUID NOT NULL UNIQUE REFERENCES "studio_template"."member_memberships"("id") ON DELETE CASCADE,
  "plan_id" UUID NOT NULL REFERENCES "studio_template"."membership_plans"("id"),
  "max_members" INTEGER NOT NULL DEFAULT 4,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_family_memberships_primary_member_id"
  ON "studio_template"."family_memberships"("primary_member_id");

CREATE TABLE IF NOT EXISTS "studio_template"."family_members" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "family_membership_id" UUID NOT NULL REFERENCES "studio_template"."family_memberships"("id") ON DELETE CASCADE,
  "member_id" UUID NOT NULL REFERENCES "studio_template"."members"("id"),
  "relation" VARCHAR(30) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("family_membership_id", "member_id")
);

CREATE INDEX IF NOT EXISTS "idx_family_members_member_id"
  ON "studio_template"."family_members"("member_id");

-- ─── Corporate Accounts ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "studio_template"."corporate_accounts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID REFERENCES "studio_template"."organizations"("id"),
  "company_name" VARCHAR(255) NOT NULL,
  "contact_person" VARCHAR(255) NOT NULL,
  "contact_email" VARCHAR(255) NOT NULL,
  "contact_phone" VARCHAR(50),
  "billing_cycle" VARCHAR(20) NOT NULL DEFAULT 'monthly',
  "discount_percent" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "max_members" INTEGER,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_corporate_accounts_organization_id"
  ON "studio_template"."corporate_accounts"("organization_id");

CREATE INDEX IF NOT EXISTS "idx_corporate_accounts_status"
  ON "studio_template"."corporate_accounts"("status");

CREATE TABLE IF NOT EXISTS "studio_template"."corporate_members" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "corporate_account_id" UUID NOT NULL REFERENCES "studio_template"."corporate_accounts"("id") ON DELETE CASCADE,
  "member_id" UUID NOT NULL REFERENCES "studio_template"."members"("id"),
  "membership_id" UUID REFERENCES "studio_template"."member_memberships"("id"),
  "employee_id" VARCHAR(100),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("corporate_account_id", "member_id")
);

CREATE INDEX IF NOT EXISTS "idx_corporate_members_member_id"
  ON "studio_template"."corporate_members"("member_id");

-- ─── Global Access Passes ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "studio_template"."global_access_passes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "member_id" UUID NOT NULL REFERENCES "studio_template"."members"("id"),
  "plan_id" UUID NOT NULL REFERENCES "studio_template"."membership_plans"("id"),
  "allowed_branch_ids" UUID[] NOT NULL,
  "expiry_date" DATE NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_global_access_passes_member_id"
  ON "studio_template"."global_access_passes"("member_id");

CREATE INDEX IF NOT EXISTS "idx_global_access_passes_status_expiry"
  ON "studio_template"."global_access_passes"("status", "expiry_date");
