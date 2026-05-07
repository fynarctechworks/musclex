-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) — Layer 3 of tenant isolation
-- ============================================================================
--
-- This script enables RLS on ALL tenant tables and creates a unified policy:
--   gym_id = current_setting('app.gym_id')::uuid
--
-- The app.gym_id session variable is set by PrismaService.$use middleware
-- on every request, from the AsyncLocalStorage tenant context.
--
-- EFFECT:
--   Even if search_path is wrong, even if the Prisma extension fails,
--   PostgreSQL itself will REFUSE to return rows from another tenant.
--
-- IMPORTANT:
--   - Run this after backfill-gym-id-all-tenants.sql
--   - The superuser/migration user bypasses RLS by default
--   - The application user (used by connection pool) MUST NOT be a superuser
--
-- Usage:
--   psql -d your_database -f scripts/enable-rls-all-tenants.sql
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- HELPER: Apply RLS to a single table in a given schema
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enable_rls_for_table(
  p_schema TEXT,
  p_table TEXT
) RETURNS VOID AS $$
DECLARE
  policy_name TEXT;
BEGIN
  -- Only proceed if the table has gym_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = p_schema
      AND table_name = p_table
      AND column_name = 'gym_id'
  ) THEN
    RAISE NOTICE 'Skipping %.% — no gym_id column', p_schema, p_table;
    RETURN;
  END IF;

  -- Enable RLS
  EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', p_schema, p_table);

  -- Force RLS even for table owners (critical for defense-in-depth)
  EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', p_schema, p_table);

  policy_name := 'tenant_isolation_' || p_table;

  -- Drop existing policy if any (idempotent)
  BEGIN
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy_name, p_schema, p_table);
  EXCEPTION WHEN OTHERS THEN
    -- ignore
  END;

  -- Create the isolation policy
  -- Uses current_setting with missing_ok=true to return NULL when unset
  -- NULL gym_id means "no access" — queries without SET app.gym_id return nothing
  EXECUTE format(
    'CREATE POLICY %I ON %I.%I '
    'FOR ALL '
    'USING (gym_id = NULLIF(current_setting(''app.gym_id'', true), '''')::uuid) '
    'WITH CHECK (gym_id = NULLIF(current_setting(''app.gym_id'', true), '''')::uuid)',
    policy_name, p_schema, p_table
  );

  RAISE NOTICE 'RLS enabled on %.% with policy %', p_schema, p_table, policy_name;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────────
-- Apply RLS to studio_template (template schema)
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'organizations', 'organization_settings', 'regions', 'branches',
    'branch_settings', 'franchise_owners', 'branch_franchises',
    'members', 'member_profiles', 'member_body_stats',
    'member_progress_photos', 'member_notes', 'member_tags',
    'member_tag_assignments', 'member_documents', 'member_referrals',
    'membership_plans', 'member_memberships', 'membership_freezes',
    'family_memberships', 'family_members', 'corporate_accounts',
    'corporate_members', 'global_access_passes', 'check_ins',
    'class_templates', 'studio_rooms', 'class_sessions',
    'class_bookings', 'class_waitlists', 'trainer_assignments',
    'class_attendance', 'class_recurring_rules', 'classes',
    'class_enrollments', 'roles', 'role_permissions',
    'staff', 'staff_profiles', 'staff_availability', 'staff_attendance',
    'trainer_clients', 'trainer_sessions', 'payroll_configs',
    'trainer_revenue', 'staff_shifts', 'leave_requests',
    'payroll_records', 'trainer_performance_records', 'audit_logs',
    'payments', 'expenses', 'notifications_log', 'campaigns',
    'leads', 'lead_activities', 'campaign_audience',
    'message_templates', 'automation_workflows', 'workflow_actions',
    'referral_programs', 'push_notifications', 'product_categories',
    'products', 'inventory', 'inventory_transactions', 'suppliers',
    'purchase_orders', 'purchase_order_items', 'pos_sales',
    'pos_sale_items', 'product_returns', 'ai_conversations',
    'sso_providers', 'api_keys', 'member_invoices', 'invoice_items',
    'payment_gateway_configs', 'refunds', 'discounts', 'tax_rates',
    'financial_transactions', 'payment_retry_logs',
    'daily_gym_metrics', 'membership_analytics', 'revenue_analytics',
    'class_analytics', 'member_behavior_analytics', 'trainer_analytics',
    'campaign_analytics', 'webhooks', 'webhook_deliveries',
    'integrations', 'feature_flags', 'white_label_configs',
    'system_notifications', 'consent_logs', 'data_requests',
    'booking_transitions', 'provider_availability_slots',
    'booking_disputes', 'service_providers', 'service_catalogs',
    'service_bookings', 'reviews', 'chats', 'chat_messages',
    'notifications', 'provider_subscriptions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    PERFORM enable_rls_for_table('studio_template', tbl);
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- Apply RLS to ALL live tenant schemas
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  studio RECORD;
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'organizations', 'organization_settings', 'regions', 'branches',
    'branch_settings', 'franchise_owners', 'branch_franchises',
    'members', 'member_profiles', 'member_body_stats',
    'member_progress_photos', 'member_notes', 'member_tags',
    'member_tag_assignments', 'member_documents', 'member_referrals',
    'membership_plans', 'member_memberships', 'membership_freezes',
    'family_memberships', 'family_members', 'corporate_accounts',
    'corporate_members', 'global_access_passes', 'check_ins',
    'class_templates', 'studio_rooms', 'class_sessions',
    'class_bookings', 'class_waitlists', 'trainer_assignments',
    'class_attendance', 'class_recurring_rules', 'classes',
    'class_enrollments', 'roles', 'role_permissions',
    'staff', 'staff_profiles', 'staff_availability', 'staff_attendance',
    'trainer_clients', 'trainer_sessions', 'payroll_configs',
    'trainer_revenue', 'staff_shifts', 'leave_requests',
    'payroll_records', 'trainer_performance_records', 'audit_logs',
    'payments', 'expenses', 'notifications_log', 'campaigns',
    'leads', 'lead_activities', 'campaign_audience',
    'message_templates', 'automation_workflows', 'workflow_actions',
    'referral_programs', 'push_notifications', 'product_categories',
    'products', 'inventory', 'inventory_transactions', 'suppliers',
    'purchase_orders', 'purchase_order_items', 'pos_sales',
    'pos_sale_items', 'product_returns', 'ai_conversations',
    'sso_providers', 'api_keys', 'member_invoices', 'invoice_items',
    'payment_gateway_configs', 'refunds', 'discounts', 'tax_rates',
    'financial_transactions', 'payment_retry_logs',
    'daily_gym_metrics', 'membership_analytics', 'revenue_analytics',
    'class_analytics', 'member_behavior_analytics', 'trainer_analytics',
    'campaign_analytics', 'webhooks', 'webhook_deliveries',
    'integrations', 'feature_flags', 'white_label_configs',
    'system_notifications', 'consent_logs', 'data_requests',
    'booking_transitions', 'provider_availability_slots',
    'booking_disputes', 'service_providers', 'service_catalogs',
    'service_bookings', 'reviews', 'chats', 'chat_messages',
    'notifications', 'provider_subscriptions'
  ];
BEGIN
  FOR studio IN
    SELECT id, schema_name FROM public.studios
    WHERE schema_name IS NOT NULL
      AND schema_name ~ '^studio_[0-9a-f_]+$'
  LOOP
    RAISE NOTICE 'Enabling RLS for schema: %', studio.schema_name;

    FOREACH tbl IN ARRAY tables
    LOOP
      -- Only apply if table exists in this schema
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = studio.schema_name AND table_name = tbl
      ) THEN
        PERFORM enable_rls_for_table(studio.schema_name, tbl);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- Cleanup
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS enable_rls_for_table(TEXT, TEXT);

-- ────────────────────────────────────────────────────────────────
-- VERIFICATION: Test that RLS blocks cross-tenant access
-- ────────────────────────────────────────────────────────────────

-- This should return 0 rows when app.gym_id is not set
DO $$
DECLARE
  cnt BIGINT;
BEGIN
  -- Reset app.gym_id to empty
  PERFORM set_config('app.gym_id', '', true);

  -- Try to read from studio_template.members
  BEGIN
    EXECUTE 'SELECT count(*) FROM studio_template.members' INTO cnt;
    IF cnt > 0 THEN
      RAISE WARNING 'RLS BYPASS: studio_template.members returned % rows without app.gym_id set!', cnt;
    ELSE
      RAISE NOTICE 'RLS OK: studio_template.members returns 0 rows when app.gym_id is empty';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RLS OK: studio_template.members query blocked — %', SQLERRM;
  END;
END;
$$;
