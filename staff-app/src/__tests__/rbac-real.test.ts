import { REAL_PERMISSIONS } from './fixtures/real-permissions';
import { codesToMap } from '@/rbac/permissions';
import { CANDIDATE_TABS, MAX_PRIMARY_TABS, tabsForUser } from '@/rbac/nav';
import type { StaffUser } from '@/auth/types';

/**
 * RBAC asserted against the permission sets the SERVER actually returns,
 * rather than ones I made up.
 *
 * The gating logic is already tested with synthetic users. This asks a
 * different question: do the real roles produce the app I think they do?
 */
const user = (role: string): StaffUser =>
  ({
    id: `${role}-1`,
    email: `${role}@mxtest.app`,
    full_name: role,
    role,
    branch_ids: [],
    permission_codes: REAL_PERMISSIONS[role],
  }) as StaffUser;

const can = (role: string, module: string, action = 'view') =>
  Boolean(codesToMap(REAL_PERMISSIONS[role])[module]?.includes(action));

describe('the fixture itself', () => {
  it('covers the four seeded roles', () => {
    expect(Object.keys(REAL_PERMISSIONS).sort())
      .toEqual(['accountant', 'front_desk', 'owner', 'trainer']);
  });

  it('is non-empty for every role', () => {
    for (const [role, codes] of Object.entries(REAL_PERMISSIONS)) {
      expect(codes.length).toBeGreaterThan(0);
      expect(role).toBeTruthy();
    }
  });
});

describe('what each real role can reach', () => {
  it('owner can do everything the app gates on', () => {
    for (const tab of CANDIDATE_TABS) {
      expect(can('owner', tab.module, tab.action ?? 'view')).toBe(true);
    }
  });

  it('front desk takes payments and checks people in', () => {
    expect(can('front_desk', 'check_ins', 'create')).toBe(true);
    expect(can('front_desk', 'payments', 'create')).toBe(true);
    expect(can('front_desk', 'members', 'create')).toBe(true);
  });

  it('a trainer has NO payments permission — gym revenue is not theirs to see', () => {
    expect(can('trainer', 'payments')).toBe(false);
  });

  it('a trainer can run a class register but not edit member records', () => {
    // The permissions thread running through Phase 6: three features landed
    // read-only for trainers for exactly this reason.
    expect(can('trainer', 'classes', 'edit')).toBe(true);
    expect(can('trainer', 'members', 'edit')).toBe(false);
  });

  it('an accountant has NO staff permission at all', () => {
    // Which is why Staff and PT sessions are invisible to them — something I
    // briefly mistook for a navigation bug before checking.
    expect(can('accountant', 'staff')).toBe(false);
  });

  it('an accountant has no check-in or class access', () => {
    expect(can('accountant', 'check_ins')).toBe(false);
    expect(can('accountant', 'classes')).toBe(false);
  });

  it('only the owner can change settings', () => {
    expect(can('owner', 'settings', 'edit')).toBe(true);
    for (const role of ['front_desk', 'trainer', 'accountant']) {
      expect(can(role, 'settings', 'edit')).toBe(false);
    }
  });
});

describe('the tab bar each real role gets', () => {
  it('gives every role a usable bar, never an empty one', () => {
    for (const role of Object.keys(REAL_PERMISSIONS)) {
      const tabs = tabsForUser(user(role));
      expect(tabs.length).toBeGreaterThan(0);
      expect(tabs.length).toBeLessThanOrEqual(MAX_PRIMARY_TABS);
    }
  });

  it('puts Home first for everyone — the app must open somewhere familiar', () => {
    for (const role of Object.keys(REAL_PERMISSIONS)) {
      expect(tabsForUser(user(role))[0]?.name).toBe('index');
    }
  });

  it('never shows a trainer the Money tab', () => {
    expect(tabsForUser(user('trainer')).map((t) => t.name)).not.toContain('money');
  });

  it('never shows an accountant Check-in or Schedule', () => {
    const names = tabsForUser(user('accountant')).map((t) => t.name);
    expect(names).not.toContain('checkin');
    expect(names).not.toContain('schedule');
  });

  it('gives the accountant Money and Reports', () => {
    const names = tabsForUser(user('accountant')).map((t) => t.name);
    expect(names).toContain('money');
    expect(names).toContain('reports');
  });
});
