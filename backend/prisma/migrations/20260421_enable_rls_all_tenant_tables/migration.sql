-- ============================================================================
-- MIGRATION: Enable Row-Level Security on ALL tenant tables
-- ============================================================================
--
-- Context:
--   Prior migration (20260405_add_gym_id_tenant_isolation) added the gym_id
--   column everywhere. The Prisma service sets `app.gym_id` at the top of
--   every query via set_config(). RLS was wired on only 2 tables, leaving
--   the other ~100 tables protected solely by application-layer filters.
--
-- What this migration does:
--   1. Creates an idempotent helper enable_tenant_rls(schema, table).
--   2. Enables + FORCEs RLS on every tenant table in studio_template.
--   3. Creates a single policy per table: rows are visible iff
--      gym_id = current_setting('app.gym_id', true)::uuid.
--   4. When app.gym_id is NULL (e.g. migrations, admin scripts), the session
--      must use a BYPASSRLS role or the policy denies access — this is the
--      desired fail-closed behavior.
--
-- Idempotent: safe to re-run. Drops the old policy by name before creating.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- HELPER: enable RLS + create tenant-isolation policy on a table
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enable_tenant_rls(
  p_schema TEXT,
  p_table TEXT
) RETURNS VOID AS $$
BEGIN
  -- Skip if the table doesn't exist in this schema
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = p_schema AND t.table_name = p_table
  ) THEN
    RAISE NOTICE 'Table %.% does not exist — skipping RLS', p_schema, p_table;
    RETURN;
  END IF;

  -- Skip if the table doesn't have a gym_id column (not actually tenant-scoped)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = p_schema
      AND c.table_name = p_table
      AND c.column_name = 'gym_id'
  ) THEN
    RAISE NOTICE 'Table %.% has no gym_id column — skipping RLS', p_schema, p_table;
    RETURN;
  END IF;

  -- Enable + force RLS (force also applies to table owner)
  EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', p_schema, p_table);
  EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', p_schema, p_table);

  -- Drop prior policy by that name (idempotent re-runs)
  EXECUTE format(
    'DROP POLICY IF EXISTS tenant_isolation ON %I.%I',
    p_schema, p_table
  );

  -- Create policy: row visible iff gym_id matches the current session's app.gym_id
  EXECUTE format(
    $POL$
    CREATE POLICY tenant_isolation ON %I.%I
      FOR ALL
      USING (
        gym_id IS NOT NULL
        AND gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid
      )
      WITH CHECK (
        gym_id IS NOT NULL
        AND gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid
      )
    $POL$,
    p_schema, p_table
  );
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────────
-- Apply to every tenant table in studio_template
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    -- Organization & region
    'organizations',
    'organization_settings',
    'regions',
    'branches',
    'branch_settings',
    'franchise_owners',
    'branch_franchises',
    -- Members
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
    -- Classes
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
    -- RBAC & staff
    'roles',
    'role_permissions',
    'staff',
    'staff_profiles',
    'staff_permission_overrides',
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
    -- Audit & finance
    'audit_logs',
    'payments',
    'expenses',
    'expense_categories',
    'expense_metrics',
    'notifications_log',
    -- Marketing
    'campaigns',
    'leads',
    'lead_activities',
    'campaign_audience',
    'message_templates',
    'automation_workflows',
    'workflow_actions',
    'referral_programs',
    'push_notifications',
    -- Inventory & POS
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
    -- AI / SSO / API
    'ai_conversations',
    'sso_providers',
    'api_keys',
    -- Invoices & gateway
    'member_invoices',
    'invoice_items',
    'payment_gateway_configs',
    'refunds',
    'discounts',
    'tax_rates',
    'financial_transactions',
    'payment_retry_logs',
    -- Analytics
    'daily_gym_metrics',
    'membership_analytics',
    'revenue_analytics',
    'class_analytics',
    'member_behavior_analytics',
    'trainer_analytics',
    'campaign_analytics',
    'dashboard_metrics',
    -- Webhooks / integrations / platform
    'webhooks',
    'webhook_deliveries',
    'integrations',
    'feature_flags',
    'white_label_configs',
    'system_notifications',
    'consent_logs',
    'data_requests',
    'domain_events',
    -- Marketplace (phase 2)
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
    PERFORM enable_tenant_rls('studio_template', tbl);
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- Sanity: log tables in studio_template that have gym_id but NOT RLS.
-- Useful for catching new models added after this migration.
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  missing RECORD;
  cnt INT := 0;
BEGIN
  FOR missing IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN pg_class pc ON pc.relname = c.table_name
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = c.table_schema
    WHERE c.table_schema = 'studio_template'
      AND c.column_name = 'gym_id'
      AND pc.relrowsecurity = false
  LOOP
    cnt := cnt + 1;
    RAISE NOTICE 'studio_template.% has gym_id but RLS is NOT enabled', missing.table_name;
  END LOOP;
  IF cnt > 0 THEN
    RAISE NOTICE 'Found % tenant table(s) without RLS — add them to the list above.', cnt;
  END IF;
END;
$$;
