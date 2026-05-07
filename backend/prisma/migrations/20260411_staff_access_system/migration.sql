-- ============================================================
-- Migration: Staff Access System
-- Adds invite-based auth + custom permission overrides for staff
-- ============================================================

-- 1. StaffInvitation in public schema (accessible without tenant context)
CREATE TABLE IF NOT EXISTS "public"."staff_invitations" (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id            UUID NOT NULL,
    staff_id             UUID NOT NULL,
    email                TEXT NOT NULL,
    token                TEXT NOT NULL UNIQUE,
    role_name            TEXT NOT NULL,
    branch_id            UUID,
    permission_overrides JSONB NOT NULL DEFAULT '{}',
    status               TEXT NOT NULL DEFAULT 'pending',
    invited_by           UUID NOT NULL,
    expires_at           TIMESTAMPTZ NOT NULL,
    accepted_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_inv_email ON public.staff_invitations (email);
CREATE INDEX IF NOT EXISTS idx_staff_inv_studio ON public.staff_invitations (studio_id);
CREATE INDEX IF NOT EXISTS idx_staff_inv_staff ON public.staff_invitations (staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_inv_token ON public.staff_invitations (token);
CREATE INDEX IF NOT EXISTS idx_staff_inv_status ON public.staff_invitations (status);

-- 2. StaffPermissionOverride in studio_template
CREATE TABLE IF NOT EXISTS "studio_template"."staff_permission_overrides" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id          UUID NOT NULL,
    staff_id        UUID NOT NULL,
    permission_code TEXT NOT NULL,
    type            TEXT NOT NULL, -- 'grant' or 'deny'
    granted_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_spo_staff FOREIGN KEY (staff_id)
        REFERENCES "studio_template"."staff"(id) ON DELETE CASCADE,
    CONSTRAINT uq_spo_staff_perm UNIQUE (staff_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_spo_staff_id ON "studio_template"."staff_permission_overrides" (staff_id);
CREATE INDEX IF NOT EXISTS idx_spo_gym_id ON "studio_template"."staff_permission_overrides" (gym_id);

-- 3. Add user_id index to staff table (for efficient lookups during login)
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON "studio_template"."staff" (user_id)
    WHERE user_id IS NOT NULL;

-- 4. Apply staff_permission_overrides to existing tenant schemas
DO $$
DECLARE
    tenant_schema TEXT;
    studio_record RECORD;
BEGIN
    FOR studio_record IN
        SELECT s.id, s.schema_name AS sname FROM public.studios s
        WHERE s.subscription_status = 'active'
    LOOP
        tenant_schema := studio_record.sname;

        IF NOT EXISTS (SELECT 1 FROM information_schema.schemata s2 WHERE s2.schema_name = tenant_schema) THEN
            CONTINUE;
        END IF;

        -- Create staff_permission_overrides table
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I."staff_permission_overrides" (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                gym_id          UUID NOT NULL,
                staff_id        UUID NOT NULL,
                permission_code TEXT NOT NULL,
                type            TEXT NOT NULL,
                granted_by      UUID,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )', tenant_schema
        );

        -- Add unique constraint
        BEGIN
            EXECUTE format(
                'ALTER TABLE %I."staff_permission_overrides" ADD CONSTRAINT uq_spo_staff_perm UNIQUE (staff_id, permission_code)',
                tenant_schema
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        -- Add FK to staff
        BEGIN
            EXECUTE format(
                'ALTER TABLE %I."staff_permission_overrides" ADD CONSTRAINT fk_spo_staff FOREIGN KEY (staff_id) REFERENCES %I."staff"(id) ON DELETE CASCADE',
                tenant_schema, tenant_schema
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        -- Indexes
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_spo_staff ON %I."staff_permission_overrides" (staff_id)', tenant_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_spo_gym ON %I."staff_permission_overrides" (gym_id)', tenant_schema);

        -- Add user_id index to staff if not exists
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_staff_uid ON %I."staff" (user_id) WHERE user_id IS NOT NULL', tenant_schema);

        RAISE NOTICE 'Created staff_permission_overrides in %', tenant_schema;
    END LOOP;
END $$;
