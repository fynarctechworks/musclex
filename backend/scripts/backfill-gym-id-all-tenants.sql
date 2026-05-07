-- ============================================================================
-- BACKFILL: Add gym_id to all live tenant schemas and set NOT NULL
-- ============================================================================
--
-- Run this AFTER the migration has been applied to studio_template.
-- This script:
--   1. Iterates over all studios in public.studios
--   2. For each studio's schema, adds gym_id column to every table
--   3. Backfills gym_id with the studio's UUID
--   4. Sets gym_id to NOT NULL
--   5. Creates indexes
--
-- IMPORTANT: Run during a maintenance window. This modifies every row
--            in every tenant schema.
--
-- Usage:
--   psql -d your_database -f scripts/backfill-gym-id-all-tenants.sql
-- ============================================================================

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
  -- Iterate over every studio (tenant)
  FOR studio IN
    SELECT id, schema_name FROM public.studios
    WHERE schema_name IS NOT NULL
      AND schema_name ~ '^studio_[0-9a-f_]+$'
  LOOP
    RAISE NOTICE 'Processing schema: % (studio: %)', studio.schema_name, studio.id;

    FOREACH tbl IN ARRAY tables
    LOOP
      -- Check if table exists in this schema
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = studio.schema_name AND table_name = tbl
      ) THEN
        -- Add column if not exists
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = studio.schema_name
            AND table_name = tbl
            AND column_name = 'gym_id'
        ) THEN
          EXECUTE format(
            'ALTER TABLE %I.%I ADD COLUMN gym_id UUID',
            studio.schema_name, tbl
          );
        END IF;

        -- Backfill gym_id with the studio's UUID
        EXECUTE format(
          'UPDATE %I.%I SET gym_id = %L WHERE gym_id IS NULL',
          studio.schema_name, tbl, studio.id
        );

        -- Set NOT NULL constraint
        EXECUTE format(
          'ALTER TABLE %I.%I ALTER COLUMN gym_id SET NOT NULL',
          studio.schema_name, tbl
        );

        -- Create index
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_gym_id ON %I.%I (gym_id)',
          tbl, studio.schema_name, tbl
        );
      END IF;
    END LOOP;

    RAISE NOTICE 'Completed schema: %', studio.schema_name;
  END LOOP;

  RAISE NOTICE 'Backfill complete for all tenant schemas.';
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- VALIDATION: Ensure no NULL gym_id values remain
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  studio RECORD;
  tbl TEXT;
  null_count BIGINT;
  tables TEXT[] := ARRAY[
    'organizations', 'members', 'staff', 'payments', 'check_ins',
    'branches', 'member_memberships', 'class_sessions'
  ];
BEGIN
  FOR studio IN
    SELECT id, schema_name FROM public.studios
    WHERE schema_name IS NOT NULL
      AND schema_name ~ '^studio_[0-9a-f_]+$'
  LOOP
    FOREACH tbl IN ARRAY tables
    LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = studio.schema_name
          AND table_name = tbl
          AND column_name = 'gym_id'
      ) THEN
        EXECUTE format(
          'SELECT count(*) FROM %I.%I WHERE gym_id IS NULL',
          studio.schema_name, tbl
        ) INTO null_count;

        IF null_count > 0 THEN
          RAISE WARNING 'INTEGRITY VIOLATION: %.% has % rows with NULL gym_id',
            studio.schema_name, tbl, null_count;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Validation complete.';
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- CROSS-TENANT LEAK CHECK
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  studio RECORD;
  leak_count BIGINT;
BEGIN
  FOR studio IN
    SELECT id, schema_name FROM public.studios
    WHERE schema_name IS NOT NULL
      AND schema_name ~ '^studio_[0-9a-f_]+$'
  LOOP
    -- Check members table for rows with wrong gym_id
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = studio.schema_name
        AND table_name = 'members'
        AND column_name = 'gym_id'
    ) THEN
      EXECUTE format(
        'SELECT count(*) FROM %I.members WHERE gym_id != %L',
        studio.schema_name, studio.id
      ) INTO leak_count;

      IF leak_count > 0 THEN
        RAISE WARNING 'DATA LEAK: %.members has % rows belonging to another gym!',
          studio.schema_name, leak_count;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Cross-tenant leak check complete.';
END;
$$;
