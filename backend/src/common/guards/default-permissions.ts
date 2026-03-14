import { PermissionsMap } from '../decorators/current-user.decorator';

/**
 * Default permission fallbacks for enterprise roles.
 * Used when normalized RBAC tables haven't been seeded yet.
 * Once RolePermission rows exist, these are not consulted.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionsMap> = {
  super_admin: {
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
    reports: ['view', 'export'],
    roles: ['view', 'create', 'edit', 'delete'],
  },

  owner: {
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
    reports: ['view', 'export'],
    roles: ['view', 'create', 'edit', 'delete'],
  },

  brand_owner: {
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
    reports: ['view', 'export'],
    roles: ['view', 'create', 'edit', 'delete'],
  },

  regional_manager: {
    dashboard: ['view', 'export'],
    members: ['view', 'create', 'edit', 'export'],
    check_ins: ['view', 'create', 'edit', 'export'],
    payments: ['view', 'create', 'edit', 'export'],
    classes: ['view', 'create', 'edit', 'delete', 'export'],
    staff: ['view', 'create', 'edit'],
    marketing: ['view', 'create', 'edit'],
    ai: ['view', 'create'],
    settings: ['view'],
    branches: ['view', 'edit'],
    reports: ['view', 'export'],
    roles: ['view'],
  },

  branch_manager: {
    dashboard: ['view', 'export'],
    members: ['view', 'create', 'edit', 'export'],
    check_ins: ['view', 'create', 'edit', 'export'],
    payments: ['view', 'create', 'edit', 'export'],
    classes: ['view', 'create', 'edit', 'delete'],
    staff: ['view', 'create', 'edit'],
    marketing: ['view', 'create', 'edit'],
    ai: ['view', 'create'],
    settings: ['view'],
    branches: ['view'],
    reports: ['view', 'export'],
    roles: ['view'],
  },

  // Legacy alias
  manager: {
    dashboard: ['view', 'export'],
    members: ['view', 'create', 'edit', 'export'],
    check_ins: ['view', 'create', 'edit', 'export'],
    payments: ['view', 'create', 'edit', 'export'],
    classes: ['view', 'create', 'edit', 'delete'],
    staff: ['view', 'create', 'edit'],
    marketing: ['view', 'create', 'edit'],
    ai: ['view', 'create'],
    settings: ['view'],
    branches: ['view'],
    reports: ['view', 'export'],
    roles: ['view'],
  },

  trainer: {
    dashboard: ['view'],
    members: ['view'],
    check_ins: ['view', 'create'],
    classes: ['view', 'edit'],
    staff: ['view'],
    ai: ['view', 'create'],
    branches: ['view'],
    reports: ['view'],
  },

  front_desk: {
    dashboard: ['view'],
    members: ['view', 'create', 'edit'],
    check_ins: ['view', 'create'],
    payments: ['view', 'create'],
    classes: ['view'],
    staff: ['view'],
    branches: ['view'],
    reports: ['view'],
  },

  accountant: {
    dashboard: ['view', 'export'],
    members: ['view'],
    payments: ['view', 'create', 'edit', 'delete', 'export'],
    branches: ['view'],
    reports: ['view', 'export'],
  },

  marketing_manager: {
    dashboard: ['view'],
    members: ['view', 'export'],
    marketing: ['view', 'create', 'edit', 'delete', 'export'],
    ai: ['view', 'create'],
    branches: ['view'],
    reports: ['view'],
  },
};
