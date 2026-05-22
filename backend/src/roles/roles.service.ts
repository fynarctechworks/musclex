import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantGymId } from '../common/tenant-context';
import { CreateRoleDto, UpdateRoleDto } from './dto';
import { DEFAULT_ROLE_PERMISSIONS } from '../common/guards/default-permissions';
import { ENTERPRISE_ROLES, ALL_PERMISSIONS } from '../auth/rbac-seed.service';

const VALID_MODULES = [
  'dashboard',
  'members',
  'check_ins',
  'payments',
  'classes',
  'staff',
  'marketing',
  'ai',
  'settings',
  'branches',
  'reports',
  'roles',
  'inventory',
];

const VALID_ACTIONS = ['view', 'create', 'edit', 'delete', 'export'];
const VALID_PERMISSION_CODES = new Set(ALL_PERMISSIONS.map((p) => p.code));

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const roles = await this.prisma.role.findMany({
      orderBy: { created_at: 'asc' },
      include: {
        _count: { select: { staff: true } },
        role_permissions: { select: { permission_code: true } },
      },
    });

    // Build enterprise role defaults for display
    const systemRoles = Object.entries(ENTERPRISE_ROLES)
      .filter(([name]) => name !== 'super_admin')
      .map(([name, def]) => {
        const dbRole = roles.find((r) => r.is_system && r.name === name);
        const permissionCodes = dbRole
          ? dbRole.role_permissions.map((rp) => rp.permission_code)
          : def.permissions;
        return {
          id: dbRole?.id ?? `system_${name}`,
          name,
          description: def.description,
          permissions: this.codesToMap(permissionCodes),
          permission_codes: permissionCodes,
          is_system: true,
          staff_count: dbRole?._count?.staff ?? 0,
        };
      });

    const customRoles = roles
      .filter((r) => !r.is_system)
      .map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: r.role_permissions.length > 0
          ? this.codesToMap(r.role_permissions.map((rp) => rp.permission_code))
          : r.permissions,
        permission_codes: r.role_permissions.map((rp) => rp.permission_code),
        is_system: false,
        staff_count: r._count.staff,
      }));

    return { system_roles: systemRoles, custom_roles: customRoles };
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: { select: { staff: true } },
        role_permissions: { select: { permission_code: true } },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      ...role,
      permission_codes: role.role_permissions.map((rp) => rp.permission_code),
    };
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException('A role with this name already exists');
    }

    // Compute permission codes from the permissions map
    const permissionCodes = dto.permissions
      ? this.mapToCodes(dto.permissions)
      : [];

    const role = await this.prisma.role.create({
      data: {
        gym_id: getTenantGymId()!,
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions ? this.sanitizePermissions(dto.permissions) : {},
        is_system: false,
      },
    });

    // Create normalized RolePermission entries
    if (permissionCodes.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: permissionCodes.map((code) => ({
          gym_id: getTenantGymId()!,
          role_id: role.id,
          permission_code: code,
        })),
        skipDuplicates: true,
      });
    }

    return {
      ...role,
      permission_codes: permissionCodes,
    };
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.is_system) {
      throw new ConflictException('System roles cannot be modified');
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.permissions !== undefined) {
      data.permissions = this.sanitizePermissions(dto.permissions);
    }

    const updated = await this.prisma.role.update({ where: { id }, data });

    // Sync RolePermission entries
    if (dto.permissions !== undefined) {
      const newCodes = this.mapToCodes(dto.permissions);
      // Delete all existing and recreate
      await this.prisma.rolePermission.deleteMany({ where: { role_id: id } });
      if (newCodes.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: newCodes.map((code) => ({
            gym_id: getTenantGymId()!,
            role_id: id,
            permission_code: code,
          })),
          skipDuplicates: true,
        });
      }
    }

    return updated;
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { staff: true } } },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.is_system) {
      throw new ConflictException('System roles cannot be deleted');
    }
    if (role._count.staff > 0) {
      throw new ConflictException(
        'Cannot delete role that is assigned to staff members',
      );
    }

    // Delete role_permissions first (cascaded by FK, but explicit for clarity)
    await this.prisma.rolePermission.deleteMany({ where: { role_id: id } });
    return this.prisma.role.delete({ where: { id } });
  }

  async getPermissionModules() {
    return {
      modules: VALID_MODULES,
      actions: VALID_ACTIONS,
      permissions: ALL_PERMISSIONS.map((p) => ({
        code: p.code,
        module: p.module,
        action: p.action,
        description: p.description,
      })),
      defaults: DEFAULT_ROLE_PERMISSIONS,
      enterprise_roles: Object.entries(ENTERPRISE_ROLES).map(([name, def]) => ({
        name,
        description: def.description,
        permission_count: def.permissions.length,
      })),
    };
  }

  // ── Helpers ──

  private sanitizePermissions(
    permissions: Record<string, string[]>,
  ): Record<string, string[]> {
    const sanitized: Record<string, string[]> = {};
    for (const mod of VALID_MODULES) {
      if (permissions[mod] && Array.isArray(permissions[mod])) {
        sanitized[mod] = permissions[mod].filter((a: string) =>
          VALID_ACTIONS.includes(a),
        );
      } else {
        sanitized[mod] = [];
      }
    }
    return sanitized;
  }

  /** Convert a permissions map { members: ['view','create'] } to codes ['members.view','members.create'] */
  private mapToCodes(permissions: Record<string, string[]>): string[] {
    const codes: string[] = [];
    for (const [mod, actions] of Object.entries(permissions)) {
      if (!Array.isArray(actions)) continue;
      for (const action of actions) {
        const code = `${mod}.${action}`;
        if (VALID_PERMISSION_CODES.has(code)) {
          codes.push(code);
        }
      }
    }
    return codes;
  }

  /** Convert codes ['members.view','members.create'] to map { members: ['view','create'] } */
  private codesToMap(codes: string[]): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    for (const code of codes) {
      const [mod, action] = code.split('.');
      if (!mod || !action) continue;
      if (!map[mod]) map[mod] = [];
      if (!map[mod].includes(action)) map[mod].push(action);
    }
    return map;
  }
}
