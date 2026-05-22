import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantGymId } from '../common/tenant-context';

// ── Permission Definitions ──────────────────────────────────────
// Each permission is "module.action" — seeded once in the public schema.

interface PermissionDef {
  code: string;
  module: string;
  action: string;
  description: string;
}

const MODULES_ACTIONS: Record<string, string[]> = {
  dashboard: ['view', 'export'],
  members: ['view', 'create', 'edit', 'delete', 'export'],
  check_ins: ['view', 'create', 'edit', 'delete', 'export'],
  payments: ['view', 'create', 'edit', 'delete', 'export'],
  classes: ['view', 'create', 'edit', 'delete', 'export'],
  staff: ['view', 'create', 'edit', 'delete', 'export'],
  marketing: ['view', 'create', 'edit', 'delete', 'export'],
  ai: ['view', 'create'],
  settings: ['view', 'edit'],
  branches: ['view', 'create', 'edit', 'delete'],
  organizations: ['view', 'create', 'edit', 'delete'],
  reports: ['view', 'export'],
  roles: ['view', 'create', 'edit', 'delete'],
  inventory: ['view', 'create', 'edit', 'delete', 'export'],
};

function buildPermissionDefs(): PermissionDef[] {
  const defs: PermissionDef[] = [];
  for (const [module, actions] of Object.entries(MODULES_ACTIONS)) {
    for (const action of actions) {
      defs.push({
        code: `${module}.${action}`,
        module,
        action,
        description: `${action} access for ${module}`,
      });
    }
  }
  return defs;
}

export const ALL_PERMISSIONS = buildPermissionDefs();

// ── Enterprise Role Definitions ─────────────────────────────────
// Maps role names to their granted permission codes.

export const ENTERPRISE_ROLES: Record<string, { description: string; permissions: string[] }> = {
  super_admin: {
    description: 'Platform super administrator — full access to everything',
    permissions: ALL_PERMISSIONS.map((p) => p.code),
  },
  owner: {
    description: 'Studio owner — full access within their studio',
    permissions: ALL_PERMISSIONS.map((p) => p.code),
  },
  brand_owner: {
    description: 'Brand owner — manages multiple studios',
    permissions: ALL_PERMISSIONS.map((p) => p.code),
  },
  regional_manager: {
    description: 'Regional manager — manages multiple branches',
    permissions: [
      'dashboard.view', 'dashboard.export',
      'members.view', 'members.create', 'members.edit', 'members.export',
      'check_ins.view', 'check_ins.create', 'check_ins.edit', 'check_ins.export',
      'payments.view', 'payments.create', 'payments.edit', 'payments.export',
      'classes.view', 'classes.create', 'classes.edit', 'classes.delete', 'classes.export',
      'staff.view', 'staff.create', 'staff.edit',
      'marketing.view', 'marketing.create', 'marketing.edit',
      'ai.view', 'ai.create',
      'settings.view',
      'branches.view', 'branches.edit',
      'organizations.view',
      'reports.view', 'reports.export',
      'roles.view',
      'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.export',
    ],
  },
  branch_manager: {
    description: 'Branch manager — full control of a single branch',
    permissions: [
      'dashboard.view', 'dashboard.export',
      'members.view', 'members.create', 'members.edit', 'members.export',
      'check_ins.view', 'check_ins.create', 'check_ins.edit', 'check_ins.export',
      'payments.view', 'payments.create', 'payments.edit', 'payments.export',
      'classes.view', 'classes.create', 'classes.edit', 'classes.delete',
      'staff.view', 'staff.create', 'staff.edit',
      'marketing.view', 'marketing.create', 'marketing.edit',
      'ai.view', 'ai.create',
      'settings.view',
      'branches.view', 'branches.edit',
      'organizations.view',
      'reports.view', 'reports.export',
      'roles.view',
      'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.export',
    ],
  },
  trainer: {
    description: 'Trainer — manages classes and views members',
    permissions: [
      'dashboard.view',
      'members.view',
      'check_ins.view', 'check_ins.create',
      'classes.view', 'classes.edit',
      'staff.view',
      'ai.view', 'ai.create',
      'branches.view',
      'reports.view',
      'inventory.view',
    ],
  },
  front_desk: {
    description: 'Front desk — member check-in and basic member management',
    permissions: [
      'dashboard.view',
      'members.view', 'members.create', 'members.edit',
      'check_ins.view', 'check_ins.create',
      'payments.view', 'payments.create',
      'classes.view',
      'staff.view',
      'branches.view',
      'reports.view',
      'inventory.view', 'inventory.create',
    ],
  },
  accountant: {
    description: 'Accountant — manages payments, invoices, and financial reports',
    permissions: [
      'dashboard.view', 'dashboard.export',
      'members.view',
      'payments.view', 'payments.create', 'payments.edit', 'payments.delete', 'payments.export',
      'branches.view',
      'reports.view', 'reports.export',
      'inventory.view', 'inventory.export',
    ],
  },
  marketing_manager: {
    description: 'Marketing manager — manages campaigns and member engagement',
    permissions: [
      'dashboard.view',
      'members.view', 'members.export',
      'marketing.view', 'marketing.create', 'marketing.edit', 'marketing.delete', 'marketing.export',
      'ai.view', 'ai.create',
      'branches.view',
      'reports.view',
    ],
  },
};

// ── Seeder Service ──────────────────────────────────────────────

@Injectable()
export class RbacSeedService implements OnModuleInit {
  private readonly logger = new Logger(RbacSeedService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedPermissions();
  }

  /** Upsert all global permission definitions into the public schema. */
  async seedPermissions() {
    let created = 0;
    for (const perm of ALL_PERMISSIONS) {
      const existing = await this.prisma.permission.findUnique({
        where: { code: perm.code },
      });
      if (!existing) {
        await this.prisma.permission.create({
          data: {
            code: perm.code,
            module: perm.module,
            action: perm.action,
            description: perm.description,
          },
        });
        created++;
      }
    }
    if (created > 0) {
      this.logger.log(`Seeded ${created} new permissions (${ALL_PERMISSIONS.length} total)`);
    }
  }

  /**
   * Seed enterprise system roles + their role_permissions for a given studio.
   * Called during studio onboarding or migration.
   * Requires tenant search_path to be set to the studio schema.
   */
  async seedStudioRoles() {
    let rolesCreated = 0;
    for (const [roleName, def] of Object.entries(ENTERPRISE_ROLES)) {
      // Skip super_admin — that's a platform role, not per-studio
      if (roleName === 'super_admin') continue;

      let role = await this.prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        role = await this.prisma.role.create({
          data: {
            gym_id: getTenantGymId()!,
            name: roleName,
            description: def.description,
            permissions: {}, // Legacy field, kept empty for new roles
            is_system: true,
          },
        });
        rolesCreated++;
      }

      // Sync role_permissions: ensure all defined permissions are assigned
      const existingRp = await this.prisma.rolePermission.findMany({
        where: { role_id: role.id },
        select: { permission_code: true },
      });
      const existingCodes = new Set(existingRp.map((rp) => rp.permission_code));

      const toCreate = def.permissions.filter((code) => !existingCodes.has(code));
      if (toCreate.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: toCreate.map((code) => ({
            gym_id: getTenantGymId()!,
            role_id: role.id,
            permission_code: code,
          })),
          skipDuplicates: true,
        });
      }
    }

    if (rolesCreated > 0) {
      this.logger.log(`Seeded ${rolesCreated} enterprise roles for current studio`);
    }
  }
}
