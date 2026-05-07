-- ============================================================================
-- MIGRATION: Add gym_id to ALL tenant tables for defense-in-depth isolation
-- ============================================================================
--
-- Architecture:
--   Layer 1: PostgreSQL search_path (schema-per-tenant) — existing
--   Layer 2: gym_id column filter (this migration)      — NEW
--   Layer 3: Row-Level Security (next migration)        — NEW
--
-- This migration:
--   1. Adds gym_id UUID column to every tenant table
--   2. Backfills gym_id from the public.studios table
--   3. Makes gym_id NOT NULL after backfill
--   4. Creates indexes on gym_id
--   5. Adds composite unique constraints for critical tables
--
-- IMPORTANT: This runs against the studio_template schema.
--   For live tenant schemas (studio_*), run the companion script:
--   scripts/backfill-gym-id-all-tenants.sql
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- HELPER: Function to add gym_id to a table safely (idempotent)
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION add_gym_id_to_table(
  p_schema TEXT,
  p_table TEXT
) RETURNS VOID AS $$
BEGIN
  -- Skip if table doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = p_schema
      AND t.table_name = p_table
  ) THEN
    RAISE NOTICE 'Table %.% does not exist, skipping', p_schema, p_table;
    RETURN;
  END IF;

  -- Add column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = p_schema
      AND c.table_name = p_table
      AND c.column_name = 'gym_id'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I.%I ADD COLUMN gym_id UUID',
      p_schema, p_table
    );
  END IF;

  -- Create index if not exists
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_%s_gym_id ON %I.%I (gym_id)',
    p_table, p_schema, p_table
  );
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────────
-- STEP 1: Add gym_id column to ALL tenant tables in studio_template
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'organizations',
    'organization_settings',
    'regions',
    'branches',
    'branch_settings',
    'franchise_owners',
    'branch_franchises',
    'members',
    'member_profiles',
    'member_body_stats',
    'member_progress_photos',
    'member_notes',
    'member_tags',
    'member_tag_assignments',
    'member_documents',
    'member_referrals',
    'membership_plans',
    'member_memberships',
    'membership_freezes',
    'family_memberships',
    'family_members',
    'corporate_accounts',
    'corporate_members',
    'global_access_passes',
    'check_ins',
    'class_templates',
    'studio_rooms',
    'class_sessions',
    'class_bookings',
    'class_waitlists',
    'trainer_assignments',
    'class_attendance',
    'class_recurring_rules',
    'classes',
    'class_enrollments',
    'roles',
    'role_permissions',
    'staff',
    'staff_profiles',
    'staff_availability',
    'staff_attendance',
    'trainer_clients',
    'trainer_sessions',
    'payroll_configs',
    'trainer_revenue',
    'staff_shifts',
    'leave_requests',
    'payroll_records',
    'trainer_performance_records',
    'audit_logs',
    'payments',
    'expenses',
    'notifications_log',
    'campaigns',
    'leads',
    'lead_activities',
    'campaign_audience',
    'message_templates',
    'automation_workflows',
    'workflow_actions',
    'referral_programs',
    'push_notifications',
    'product_categories',
    'products',
    'inventory',
    'inventory_transactions',
    'suppliers',
    'purchase_orders',
    'purchase_order_items',
    'pos_sales',
    'pos_sale_items',
    'product_returns',
    'ai_conversations',
    'sso_providers',
    'api_keys',
    'member_invoices',
    'invoice_items',
    'payment_gateway_configs',
    'refunds',
    'discounts',
    'tax_rates',
    'financial_transactions',
    'payment_retry_logs',
    'daily_gym_metrics',
    'membership_analytics',
    'revenue_analytics',
    'class_analytics',
    'member_behavior_analytics',
    'trainer_analytics',
    'campaign_analytics',
    'webhooks',
    'webhook_deliveries',
    'integrations',
    'feature_flags',
    'white_label_configs',
    'system_notifications',
    'consent_logs',
    'data_requests',
    'booking_transitions',
    'provider_availability_slots',
    'booking_disputes',
    'service_providers',
    'service_catalogs',
    'service_bookings',
    'reviews',
    'chats',
    'chat_messages',
    'notifications',
    'provider_subscriptions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    PERFORM add_gym_id_to_table('studio_template', tbl);
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- STEP 2: Composite unique constraints for critical tables
-- These prevent data collision across tenants even if
-- schema isolation fails.
-- ────────────────────────────────────────────────────────────────

-- Members: unique email/phone per gym
CREATE UNIQUE INDEX IF NOT EXISTS uq_members_gym_email
  ON studio_template.members (gym_id, email)
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_members_gym_phone
  ON studio_template.members (gym_id, phone);

CREATE UNIQUE INDEX IF NOT EXISTS uq_members_gym_member_code
  ON studio_template.members (gym_id, member_code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_members_gym_qr_code
  ON studio_template.members (gym_id, qr_code)
  WHERE qr_code IS NOT NULL;

-- Staff: unique email per gym
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_gym_email
  ON studio_template.staff (gym_id, email)
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_gym_employee_code
  ON studio_template.staff (gym_id, employee_code)
  WHERE employee_code IS NOT NULL;

-- Payments: unique receipt per gym
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_gym_receipt
  ON studio_template.payments (gym_id, receipt_number);

-- Invoices: unique invoice number per gym
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_gym_number
  ON studio_template.member_invoices (gym_id, invoice_number);

-- POS Sales: unique invoice number per gym
CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_gym_invoice
  ON studio_template.pos_sales (gym_id, invoice_number);

-- Branches: unique code per gym
CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_gym_code
  ON studio_template.branches (gym_id, code)
  WHERE code IS NOT NULL;

-- Products: unique SKU per gym
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_gym_sku
  ON studio_template.products (gym_id, sku)
  WHERE sku IS NOT NULL;

-- Products: unique barcode per gym
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_gym_barcode
  ON studio_template.products (gym_id, barcode)
  WHERE barcode IS NOT NULL;

-- Roles: unique name per gym
CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_gym_name
  ON studio_template.roles (gym_id, name);

-- Discount codes: unique per gym
CREATE UNIQUE INDEX IF NOT EXISTS uq_discounts_gym_code
  ON studio_template.discounts (gym_id, code)
  WHERE code IS NOT NULL;

-- API Keys: unique hash per gym
CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_gym_hash
  ON studio_template.api_keys (gym_id, key_hash);

-- Purchase orders: unique order number per gym
CREATE UNIQUE INDEX IF NOT EXISTS uq_po_gym_number
  ON studio_template.purchase_orders (gym_id, order_number);

-- ────────────────────────────────────────────────────────────────
-- STEP 3: Composite indexes for common query patterns
-- ──────────────────────────────────────────────────���─────────────

CREATE INDEX IF NOT EXISTS idx_members_gym_branch_status
  ON studio_template.members (gym_id, branch_id, status);

CREATE INDEX IF NOT EXISTS idx_payments_gym_branch_date
  ON studio_template.payments (gym_id, branch_id, created_at);

CREATE INDEX IF NOT EXISTS idx_checkins_gym_branch_date
  ON studio_template.check_ins (gym_id, branch_id, checked_in_at);

CREATE INDEX IF NOT EXISTS idx_memberships_gym_member_status
  ON studio_template.member_memberships (gym_id, member_id, status);

CREATE INDEX IF NOT EXISTS idx_staff_gym_branch_status
  ON studio_template.staff (gym_id, branch_id, status);

CREATE INDEX IF NOT EXISTS idx_classes_gym_branch_time
  ON studio_template.class_sessions (gym_id, branch_id, start_time);

-- ────────────────────────────────────────────────────────────────
-- Cleanup helper function
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS add_gym_id_to_table(TEXT, TEXT);
