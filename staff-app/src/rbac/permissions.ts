import type { PermissionsMap, StaffUser } from '@/auth/types';

/**
 * Client-side RBAC.
 *
 * ⚠️  THIS IS UX, NOT SECURITY. Hiding a tab must never be the only thing
 * stopping a trainer from reading payroll — the backend guard is the real
 * boundary, and on a mobile client a request is trivial to hand-craft. Every
 * screen added here must already be guarded server-side.
 *
 * Modules and actions mirror backend/src/roles/roles.service.ts. Defaults
 * mirror backend/src/common/guards/default-permissions.ts and are used ONLY
 * as a fallback: the server sends the user's real permission map, and gyms
 * author custom roles via /settings/roles, so a hardcoded per-role table would
 * simply miss them.
 */

export const MODULES = [
  'dashboard', 'members', 'check_ins', 'payments', 'classes', 'staff',
  'marketing', 'ai', 'settings', 'branches', 'reports', 'roles', 'inventory',
] as const;
export type Module = (typeof MODULES)[number];

/**
 * `measure` is narrower than `edit` — it records a member's body stats without
 * granting the right to rename them or change their contact details. Mirrors
 * MODULES_ACTIONS in the backend's rbac-seed.service.
 */
export const ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'measure'] as const;
export type Action = (typeof ACTIONS)[number];

/** Roles that bypass the map entirely. Mirrors the backend's owner tier. */
const FULL_ACCESS_ROLES = new Set(['super_admin', 'owner', 'brand_owner']);

/**
 * Fallback map, used only when the server sent no permissions (older token,
 * un-seeded RBAC tables). Kept in sync with DEFAULT_ROLE_PERMISSIONS.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionsMap> = {
  regional_manager: {
    dashboard: ['view', 'export'], members: ['view', 'create', 'edit', 'export'],
    check_ins: ['view', 'create', 'edit', 'export'], payments: ['view', 'create', 'edit', 'export'],
    classes: ['view', 'create', 'edit'], staff: ['view', 'create', 'edit'],
    marketing: ['view', 'create', 'edit'], ai: ['view', 'create'], settings: ['view'],
    branches: ['view'], reports: ['view', 'export'], roles: ['view'],
    inventory: ['view', 'create', 'edit', 'export'],
  },
  branch_manager: {
    dashboard: ['view', 'export'], members: ['view', 'create', 'edit', 'export'],
    check_ins: ['view', 'create', 'edit', 'export'], payments: ['view', 'create', 'edit', 'export'],
    classes: ['view', 'create', 'edit'], staff: ['view', 'create', 'edit'],
    marketing: ['view', 'create', 'edit'], ai: ['view', 'create'], settings: ['view'],
    branches: ['view'], reports: ['view', 'export'], roles: ['view'],
    inventory: ['view', 'create', 'edit', 'export'],
  },
  manager: {
    dashboard: ['view', 'export'], members: ['view', 'create', 'edit', 'export'],
    check_ins: ['view', 'create', 'edit', 'export'], payments: ['view', 'create', 'edit', 'export'],
    classes: ['view', 'create', 'edit'], staff: ['view', 'create', 'edit'],
    marketing: ['view', 'create', 'edit'], ai: ['view', 'create'], settings: ['view'],
    branches: ['view'], reports: ['view', 'export'], roles: ['view'],
    inventory: ['view', 'create', 'edit', 'export'],
  },
  trainer: {
    dashboard: ['view'], members: ['view'], check_ins: ['view', 'create'],
    classes: ['view', 'edit'], staff: ['view'], ai: ['view', 'create'],
    branches: ['view'], reports: ['view'], inventory: ['view'],
  },
  front_desk: {
    dashboard: ['view'], members: ['view', 'create', 'edit'],
    check_ins: ['view', 'create'], payments: ['view', 'create'], classes: ['view'],
    staff: ['view'], branches: ['view'], reports: ['view'],
    // Front desk runs POS — selling requires inventory.create.
    inventory: ['view', 'create'],
  },
  accountant: {
    dashboard: ['view', 'export'], members: ['view'],
    payments: ['view', 'create', 'edit', 'delete', 'export'], branches: ['view'],
    reports: ['view', 'export'], inventory: ['view', 'export'],
  },
  marketing_manager: {
    dashboard: ['view'], members: ['view', 'export'],
    marketing: ['view', 'create', 'edit', 'delete', 'export'], ai: ['view', 'create'],
    branches: ['view'], reports: ['view'],
  },
};

/**
 * Convert the API's flat codes into a map.
 *
 * VERIFIED AGAINST THE LIVE API: /auth/login returns `permission_codes` as
 * ["dashboard.view","members.create",...] and does NOT send a `permissions`
 * map. Reading only the map silently fell back to the role-name default, which
 * is wrong for any gym-authored custom role — the exact case the fallback was
 * never meant to cover.
 */
export function codesToMap(codes: string[] | undefined | null): PermissionsMap {
  const map: PermissionsMap = {};
  for (const code of codes ?? []) {
    const idx = code.indexOf('.');
    if (idx <= 0) continue;
    const [mod, action] = [code.slice(0, idx), code.slice(idx + 1)];
    (map[mod] ??= []).push(action);
  }
  return map;
}

/**
 * The effective map, in precedence order:
 *   1. server `permissions` map      (authoritative if ever sent)
 *   2. server `permission_codes`     (what the API actually sends today)
 *   3. role default                  (fallback only — misses custom roles)
 */
export function effectivePermissions(
  user: Pick<StaffUser, 'role' | 'permissions' | 'permission_codes'>,
): PermissionsMap {
  if (user.permissions && Object.keys(user.permissions).length > 0) return user.permissions;
  const fromCodes = codesToMap(user.permission_codes);
  if (Object.keys(fromCodes).length > 0) return fromCodes;
  return DEFAULT_ROLE_PERMISSIONS[user.role] ?? {};
}

export function hasFullAccess(role: string): boolean {
  return FULL_ACCESS_ROLES.has(role);
}

/** Can this user perform `action` on `module`? */
export function can(
  user: Pick<StaffUser, 'role' | 'permissions' | 'permission_codes'> | null | undefined,
  module: Module,
  action: Action = 'view',
): boolean {
  if (!user) return false;
  if (hasFullAccess(user.role)) return true;
  return (effectivePermissions(user)[module] ?? []).includes(action);
}

/** Modules the user can see at all — the input to role-adaptive navigation. */
export function visibleModules(
  user: Pick<StaffUser, 'role' | 'permissions' | 'permission_codes'> | null | undefined,
): Module[] {
  if (!user) return [];
  return MODULES.filter((m) => can(user, m, 'view'));
}
