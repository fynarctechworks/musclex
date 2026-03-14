import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsMap, PermissionModule, ModuleAction } from '../common/decorators/current-user.decorator';
import { ENTERPRISE_ROLES } from './rbac-seed.service';

export interface UserRoleInfo {
  id: string;
  studio_id: string;
  branch_id: string | null;
  role_name: string;
  is_primary: boolean;
}

export interface UserWorkspace {
  studio_id: string;
  studio_name: string;
  roles: UserRoleInfo[];
  branches: { id: string; name: string }[];
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(private prisma: PrismaService) {}

  // ── Query Methods ───────────────────────────────────────────

  /** Get all roles for a user in a specific studio. */
  async getUserRoles(userId: string, studioId: string): Promise<UserRoleInfo[]> {
    const roles = await this.prisma.userRole.findMany({
      where: { user_id: userId, studio_id: studioId },
      orderBy: { is_primary: 'desc' },
    });

    return roles.map((r) => ({
      id: r.id,
      studio_id: r.studio_id,
      branch_id: r.branch_id,
      role_name: r.role_name,
      is_primary: r.is_primary,
    }));
  }

  /** Get all studios/organizations a user belongs to. */
  async getUserWorkspaces(userId: string): Promise<UserWorkspace[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { user_id: userId },
      orderBy: { is_primary: 'desc' },
    });

    // Group by studio_id
    const studioMap = new Map<string, UserRoleInfo[]>();
    for (const r of userRoles) {
      const existing = studioMap.get(r.studio_id) || [];
      existing.push({
        id: r.id,
        studio_id: r.studio_id,
        branch_id: r.branch_id,
        role_name: r.role_name,
        is_primary: r.is_primary,
      });
      studioMap.set(r.studio_id, existing);
    }

    const workspaces: UserWorkspace[] = [];
    for (const [studioId, roles] of studioMap) {
      // Fetch studio name
      const studio = await this.prisma.studio.findUnique({
        where: { id: studioId },
        select: { id: true, name: true },
      });
      if (!studio) continue;

      // Collect branch IDs from roles (null branch_id = all branches)
      const hasGlobalAccess = roles.some((r) => r.branch_id === null);
      let branches: { id: string; name: string }[] = [];

      if (hasGlobalAccess) {
        // User has studio-wide access, fetch all branches
        // Note: branches are in studio_template schema, need tenant context
        // For now, return empty — the caller sets search_path first
        branches = [];
      } else {
        // Only specific branches
        const branchIds = [...new Set(roles.filter((r) => r.branch_id).map((r) => r.branch_id!))];
        branches = branchIds.map((id) => ({ id, name: '' }));
      }

      workspaces.push({
        studio_id: studio.id,
        studio_name: studio.name,
        roles,
        branches,
      });
    }

    return workspaces;
  }

  /**
   * Resolve the effective permission codes for a user in a studio/branch context.
   * Queries RolePermission (per-tenant) to get permission_codes linked to user's roles.
   * Falls back to ENTERPRISE_ROLES definitions if no RolePermission rows exist yet.
   *
   * NOTE: Tenant search_path must be set before calling this method.
   */
  async resolvePermissions(
    userId: string,
    studioId: string,
    branchId?: string,
  ): Promise<string[]> {
    // 1. Get user's roles for this studio
    const userRoles = await this.prisma.userRole.findMany({
      where: { user_id: userId, studio_id: studioId },
    });

    if (userRoles.length === 0) {
      return [];
    }

    // Filter roles by branch context if specified
    const relevantRoles = branchId
      ? userRoles.filter((r) => r.branch_id === null || r.branch_id === branchId)
      : userRoles;

    if (relevantRoles.length === 0) {
      return [];
    }

    const roleNames = [...new Set(relevantRoles.map((r) => r.role_name))];

    // 2. Find Role records by name in the tenant schema
    const roles = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
      select: { id: true, name: true },
    });

    // 3. Get permission codes from RolePermission junction
    let permissionCodes: string[] = [];

    if (roles.length > 0) {
      const roleIds = roles.map((r) => r.id);
      const rolePerms = await this.prisma.rolePermission.findMany({
        where: { role_id: { in: roleIds } },
        select: { permission_code: true },
      });
      permissionCodes = rolePerms.map((rp) => rp.permission_code);
    }

    // 4. Fallback: if no RolePermission entries, use ENTERPRISE_ROLES definitions
    if (permissionCodes.length === 0) {
      for (const roleName of roleNames) {
        const def = ENTERPRISE_ROLES[roleName];
        if (def) {
          permissionCodes.push(...def.permissions);
        }
      }
    }

    // Deduplicate
    return [...new Set(permissionCodes)];
  }

  /**
   * Convert permission codes (e.g., ["members.create", "payments.view"]) to
   * the legacy PermissionsMap format for backward compatibility with existing guards.
   */
  codesToPermissionsMap(codes: string[]): PermissionsMap {
    const map: PermissionsMap = {};
    for (const code of codes) {
      const [mod, action] = code.split('.');
      if (!mod || !action) continue;
      const module = mod as PermissionModule;
      if (!map[module]) map[module] = [];
      if (!map[module]!.includes(action as ModuleAction)) {
        map[module]!.push(action as ModuleAction);
      }
    }
    return map;
  }

  /**
   * Resolve permissions and return as PermissionsMap.
   * This is the main method used by JwtAuthGuard.
   */
  async resolvePermissionsMap(
    userId: string,
    studioId: string,
    branchId?: string,
  ): Promise<PermissionsMap> {
    const codes = await this.resolvePermissions(userId, studioId, branchId);
    return this.codesToPermissionsMap(codes);
  }

  /** Get the primary role name for a user in a studio. */
  async getPrimaryRole(userId: string, studioId: string): Promise<string | null> {
    const primary = await this.prisma.userRole.findFirst({
      where: { user_id: userId, studio_id: studioId, is_primary: true },
    });
    if (primary) return primary.role_name;

    // Fallback: return first role
    const first = await this.prisma.userRole.findFirst({
      where: { user_id: userId, studio_id: studioId },
      orderBy: { created_at: 'asc' },
    });
    return first?.role_name || null;
  }

  /** Get all branch IDs a user has access to in a studio. */
  async getUserBranchIds(userId: string, studioId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { user_id: userId, studio_id: studioId },
      select: { branch_id: true },
    });

    // If any role has null branch_id, the user has access to all branches
    if (userRoles.some((r) => r.branch_id === null)) {
      return []; // Empty = all branches (caller should interpret this)
    }

    return [...new Set(userRoles.filter((r) => r.branch_id).map((r) => r.branch_id!))];
  }

  // ── Mutation Methods ────────────────────────────────────────

  /** Assign a role to a user in a studio, optionally scoped to a branch. */
  async assignRole(params: {
    user_id: string;
    studio_id: string;
    role_name: string;
    branch_id?: string;
    is_primary?: boolean;
    assigned_by?: string;
  }) {
    // Validate role_name against known enterprise roles
    if (!ENTERPRISE_ROLES[params.role_name]) {
      this.logger.warn(`Assigning non-standard role: ${params.role_name}`);
    }

    // Check for existing assignment
    const existing = await this.prisma.userRole.findFirst({
      where: {
        user_id: params.user_id,
        studio_id: params.studio_id,
        branch_id: params.branch_id ?? null,
      },
    });

    if (existing) {
      // Update existing role assignment
      return this.prisma.userRole.update({
        where: { id: existing.id },
        data: {
          role_name: params.role_name,
          is_primary: params.is_primary ?? existing.is_primary,
          assigned_by: params.assigned_by,
        },
      });
    }

    // If this is primary, unset other primary roles in same studio
    if (params.is_primary) {
      await this.prisma.userRole.updateMany({
        where: {
          user_id: params.user_id,
          studio_id: params.studio_id,
          is_primary: true,
        },
        data: { is_primary: false },
      });
    }

    return this.prisma.userRole.create({
      data: {
        user_id: params.user_id,
        studio_id: params.studio_id,
        branch_id: params.branch_id ?? null,
        role_name: params.role_name,
        is_primary: params.is_primary ?? false,
        assigned_by: params.assigned_by,
      },
    });
  }

  /** Remove a user's role assignment. */
  async removeRole(userRoleId: string) {
    const existing = await this.prisma.userRole.findUnique({
      where: { id: userRoleId },
    });
    if (!existing) {
      throw new NotFoundException('User role assignment not found');
    }
    return this.prisma.userRole.delete({ where: { id: userRoleId } });
  }

  /** Remove all roles for a user in a studio. */
  async removeAllRoles(userId: string, studioId: string) {
    return this.prisma.userRole.deleteMany({
      where: { user_id: userId, studio_id: studioId },
    });
  }

  /** Check if a user has a specific permission in the current context. */
  async hasPermission(
    userId: string,
    studioId: string,
    permissionCode: string,
    branchId?: string,
  ): Promise<boolean> {
    const codes = await this.resolvePermissions(userId, studioId, branchId);
    return codes.includes(permissionCode);
  }
}
