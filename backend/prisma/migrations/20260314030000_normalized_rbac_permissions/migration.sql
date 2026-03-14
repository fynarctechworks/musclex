-- Normalized RBAC: Permission, UserRole (public schema), RolePermission (studio_template)
-- This migration adds granular permission management replacing JSON blob permissions.

-- =============================================
-- PUBLIC SCHEMA — Global Permission Definitions
-- =============================================

CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id"          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "code"        TEXT NOT NULL UNIQUE,
    "module"      TEXT NOT NULL,
    "action"      TEXT NOT NULL,
    "description" TEXT,
    "is_active"   BOOLEAN NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "permissions_module_idx" ON "public"."permissions" ("module");

-- =============================================
-- PUBLIC SCHEMA — User Role Assignments
-- =============================================

CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id"          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "user_id"     UUID NOT NULL,
    "studio_id"   UUID NOT NULL,
    "branch_id"   UUID,
    "role_name"   TEXT NOT NULL,
    "is_primary"  BOOLEAN NOT NULL DEFAULT false,
    "assigned_by" UUID,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "public"."user_identities" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_user_id_studio_id_branch_id_key"
    ON "public"."user_roles" ("user_id", "studio_id", "branch_id");
CREATE INDEX IF NOT EXISTS "user_roles_user_id_idx" ON "public"."user_roles" ("user_id");
CREATE INDEX IF NOT EXISTS "user_roles_studio_id_idx" ON "public"."user_roles" ("studio_id");
CREATE INDEX IF NOT EXISTS "user_roles_user_id_studio_id_idx" ON "public"."user_roles" ("user_id", "studio_id");

-- =============================================
-- STUDIO TEMPLATE — Role Permission Junction
-- =============================================

CREATE TABLE IF NOT EXISTS "studio_template"."role_permissions" (
    "id"              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "role_id"         UUID NOT NULL,
    "permission_code" TEXT NOT NULL,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id")
        REFERENCES "studio_template"."roles" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_role_id_permission_code_key"
    ON "studio_template"."role_permissions" ("role_id", "permission_code");
CREATE INDEX IF NOT EXISTS "role_permissions_role_id_idx"
    ON "studio_template"."role_permissions" ("role_id");

-- =============================================
-- Seed Global Permissions
-- =============================================

INSERT INTO "public"."permissions" ("code", "module", "action", "description") VALUES
    ('dashboard.view', 'dashboard', 'view', 'view access for dashboard'),
    ('dashboard.export', 'dashboard', 'export', 'export access for dashboard'),
    ('members.view', 'members', 'view', 'view access for members'),
    ('members.create', 'members', 'create', 'create access for members'),
    ('members.edit', 'members', 'edit', 'edit access for members'),
    ('members.delete', 'members', 'delete', 'delete access for members'),
    ('members.export', 'members', 'export', 'export access for members'),
    ('check_ins.view', 'check_ins', 'view', 'view access for check_ins'),
    ('check_ins.create', 'check_ins', 'create', 'create access for check_ins'),
    ('check_ins.edit', 'check_ins', 'edit', 'edit access for check_ins'),
    ('check_ins.delete', 'check_ins', 'delete', 'delete access for check_ins'),
    ('check_ins.export', 'check_ins', 'export', 'export access for check_ins'),
    ('payments.view', 'payments', 'view', 'view access for payments'),
    ('payments.create', 'payments', 'create', 'create access for payments'),
    ('payments.edit', 'payments', 'edit', 'edit access for payments'),
    ('payments.delete', 'payments', 'delete', 'delete access for payments'),
    ('payments.export', 'payments', 'export', 'export access for payments'),
    ('classes.view', 'classes', 'view', 'view access for classes'),
    ('classes.create', 'classes', 'create', 'create access for classes'),
    ('classes.edit', 'classes', 'edit', 'edit access for classes'),
    ('classes.delete', 'classes', 'delete', 'delete access for classes'),
    ('classes.export', 'classes', 'export', 'export access for classes'),
    ('staff.view', 'staff', 'view', 'view access for staff'),
    ('staff.create', 'staff', 'create', 'create access for staff'),
    ('staff.edit', 'staff', 'edit', 'edit access for staff'),
    ('staff.delete', 'staff', 'delete', 'delete access for staff'),
    ('staff.export', 'staff', 'export', 'export access for staff'),
    ('marketing.view', 'marketing', 'view', 'view access for marketing'),
    ('marketing.create', 'marketing', 'create', 'create access for marketing'),
    ('marketing.edit', 'marketing', 'edit', 'edit access for marketing'),
    ('marketing.delete', 'marketing', 'delete', 'delete access for marketing'),
    ('marketing.export', 'marketing', 'export', 'export access for marketing'),
    ('ai.view', 'ai', 'view', 'view access for ai'),
    ('ai.create', 'ai', 'create', 'create access for ai'),
    ('settings.view', 'settings', 'view', 'view access for settings'),
    ('settings.edit', 'settings', 'edit', 'edit access for settings'),
    ('branches.view', 'branches', 'view', 'view access for branches'),
    ('branches.create', 'branches', 'create', 'create access for branches'),
    ('branches.edit', 'branches', 'edit', 'edit access for branches'),
    ('branches.delete', 'branches', 'delete', 'delete access for branches'),
    ('reports.view', 'reports', 'view', 'view access for reports'),
    ('reports.export', 'reports', 'export', 'export access for reports'),
    ('roles.view', 'roles', 'view', 'view access for roles'),
    ('roles.create', 'roles', 'create', 'create access for roles'),
    ('roles.edit', 'roles', 'edit', 'edit access for roles'),
    ('roles.delete', 'roles', 'delete', 'delete access for roles')
ON CONFLICT ("code") DO NOTHING;
