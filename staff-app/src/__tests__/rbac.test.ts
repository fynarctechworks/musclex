import {
  ACTIONS, MODULES, can, effectivePermissions, hasFullAccess, visibleModules,
} from '../rbac/permissions';
import type { StaffUser } from '../auth/types';

const user = (role: string, permissions?: StaffUser['permissions']) =>
  ({ role, permissions }) as Pick<StaffUser, 'role' | 'permissions'>;

/**
 * Table-driven because the matrix is 10 roles x 13 modules x 5 actions.
 * These assertions are cheap to write and the only realistic way to notice
 * that a role quietly gained or lost access.
 */
describe('owner tier', () => {
  it.each(['owner', 'brand_owner', 'super_admin'])('%s can do everything', (role) => {
    expect(hasFullAccess(role)).toBe(true);
    for (const m of MODULES) {
      for (const a of ACTIONS) expect(can(user(role), m, a)).toBe(true);
    }
  });
});

describe('role boundaries that matter', () => {
  it('trainer cannot read payments or payroll', () => {
    // Payroll lives under staff; salary fields are owner-only server-side.
    expect(can(user('trainer'), 'payments')).toBe(false);
    expect(can(user('trainer'), 'staff', 'edit')).toBe(false);
  });

  it('front_desk can take payments but not delete them', () => {
    expect(can(user('front_desk'), 'payments', 'create')).toBe(true);
    expect(can(user('front_desk'), 'payments', 'delete')).toBe(false);
  });

  it('front_desk can sell from inventory — POS needs inventory.create', () => {
    expect(can(user('front_desk'), 'inventory', 'create')).toBe(true);
  });

  it('accountant sees money but cannot edit members', () => {
    expect(can(user('accountant'), 'payments', 'export')).toBe(true);
    expect(can(user('accountant'), 'members', 'edit')).toBe(false);
  });

  it('marketing_manager cannot see check-ins or payments', () => {
    expect(can(user('marketing_manager'), 'check_ins')).toBe(false);
    expect(can(user('marketing_manager'), 'payments')).toBe(false);
  });

  it('only the owner tier can administer roles', () => {
    expect(can(user('manager'), 'roles', 'edit')).toBe(false);
    expect(can(user('owner'), 'roles', 'edit')).toBe(true);
  });
});

describe('server permissions beat the fallback', () => {
  it('uses the server map when present', () => {
    // Gyms author custom roles via /settings/roles, so a hardcoded per-role
    // table would miss them entirely.
    const custom = user('custom_weekend_staff', { members: ['view'], check_ins: ['view', 'create'] });
    expect(can(custom, 'check_ins', 'create')).toBe(true);
    expect(can(custom, 'payments')).toBe(false);
  });

  it('falls back to the role default only when the map is absent or empty', () => {
    expect(effectivePermissions(user('front_desk'))).toHaveProperty('payments');
    expect(effectivePermissions(user('front_desk', {}))).toHaveProperty('payments');
  });

  it('an unknown role with no server map gets nothing', () => {
    // Fail closed: an unrecognised role must not inherit someone else's access.
    expect(visibleModules(user('who_is_this'))).toEqual([]);
  });
});

describe('visibleModules drives navigation', () => {
  it('front_desk sees its operational set and not marketing', () => {
    const mods = visibleModules(user('front_desk'));
    expect(mods).toEqual(expect.arrayContaining(['dashboard', 'members', 'check_ins', 'payments']));
    expect(mods).not.toContain('marketing');
  });

  it('returns nothing when signed out', () => {
    expect(visibleModules(null)).toEqual([]);
    expect(can(null, 'members')).toBe(false);
  });
});

describe('permission_codes — the shape the live API actually returns', () => {
  it('parses "module.action" codes into a usable map', () => {
    // Captured verbatim from POST /auth/login for the seeded front_desk account.
    const codes = [
      'dashboard.view', 'members.view', 'members.create', 'members.edit',
      'check_ins.view', 'check_ins.create', 'payments.view', 'payments.create',
    ];
    const u = { role: 'front_desk', permission_codes: codes } as Pick<
      StaffUser, 'role' | 'permissions' | 'permission_codes'>;
    expect(can(u, 'members', 'create')).toBe(true);
    expect(can(u, 'payments', 'create')).toBe(true);
    expect(can(u, 'payments', 'delete')).toBe(false);
    expect(can(u, 'marketing')).toBe(false);
  });

  it('handles module names containing underscores', () => {
    const u = { role: 'x', permission_codes: ['check_ins.view'] } as Pick<
      StaffUser, 'role' | 'permissions' | 'permission_codes'>;
    // Splitting on the FIRST dot matters: "check_ins.view" must not become
    // module "check" / action "ins.view".
    expect(can(u, 'check_ins', 'view')).toBe(true);
  });

  it('prefers server codes over the role-name default', () => {
    // A custom role with a narrow grant must not inherit a broader default.
    const u = { role: 'front_desk', permission_codes: ['members.view'] } as Pick<
      StaffUser, 'role' | 'permissions' | 'permission_codes'>;
    expect(can(u, 'payments', 'create')).toBe(false);
  });

  it('ignores malformed codes rather than throwing', () => {
    const u = { role: 'x', permission_codes: ['', 'nodot', '.leading'] } as Pick<
      StaffUser, 'role' | 'permissions' | 'permission_codes'>;
    expect(visibleModules(u)).toEqual([]);
  });
});
