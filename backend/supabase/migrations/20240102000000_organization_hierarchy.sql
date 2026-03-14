-- ============================================================
-- Migration: Organization Hierarchy & Branch Management
-- Adds: organizations, organization_settings, regions,
--        branch_settings, franchise_owners, branch_franchises
-- Extends: branches with org hierarchy fields
-- ============================================================

-- ── Organizations ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  industry_type TEXT NOT NULL DEFAULT 'fitness',
  country TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_status
  ON studio_template.organizations (status);

-- ── Organization Settings ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE
    REFERENCES studio_template.organizations(id) ON DELETE CASCADE,
  default_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  default_currency TEXT NOT NULL DEFAULT 'INR',
  billing_plan TEXT,
  feature_flags JSONB NOT NULL DEFAULT '{}',
  branding JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Regions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES studio_template.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country TEXT,
  timezone TEXT,
  manager_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regions_organization_id
  ON studio_template.regions (organization_id);

-- ── Extend Branches ────────────────────────────────────────────

ALTER TABLE studio_template.branches
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES studio_template.organizations(id),
  ADD COLUMN IF NOT EXISTS region_id UUID
    REFERENCES studio_template.regions(id),
  ADD COLUMN IF NOT EXISTS code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS opening_time TEXT,
  ADD COLUMN IF NOT EXISTS closing_time TEXT;

CREATE INDEX IF NOT EXISTS idx_branches_organization_id
  ON studio_template.branches (organization_id);

CREATE INDEX IF NOT EXISTS idx_branches_region_id
  ON studio_template.branches (region_id);

CREATE INDEX IF NOT EXISTS idx_branches_status
  ON studio_template.branches (status);

-- ── Branch Settings ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.branch_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL UNIQUE
    REFERENCES studio_template.branches(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'INR',
  tax_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0,
  membership_policy JSONB NOT NULL DEFAULT '{}',
  checkin_policy JSONB NOT NULL DEFAULT '{}',
  notification_prefs JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Franchise Owners ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.franchise_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES studio_template.organizations(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  user_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_franchise_owners_organization_id
  ON studio_template.franchise_owners (organization_id);

-- ── Branch-Franchise Mapping ──────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.branch_franchises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL
    REFERENCES studio_template.branches(id) ON DELETE CASCADE,
  franchise_owner_id UUID NOT NULL
    REFERENCES studio_template.franchise_owners(id) ON DELETE CASCADE,
  revenue_share_pct DECIMAL(5, 2),
  contract_start DATE,
  contract_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, franchise_owner_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_franchises_franchise_owner_id
  ON studio_template.branch_franchises (franchise_owner_id);

-- ── Permissions Seed (organizations module) ────────────────────

INSERT INTO public.permissions (code, module, action, description) VALUES
  ('organizations.view', 'organizations', 'view', 'view access for organizations'),
  ('organizations.create', 'organizations', 'create', 'create access for organizations'),
  ('organizations.edit', 'organizations', 'edit', 'edit access for organizations'),
  ('organizations.delete', 'organizations', 'delete', 'delete access for organizations')
ON CONFLICT (code) DO NOTHING;
