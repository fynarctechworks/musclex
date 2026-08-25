import { CANDIDATE_TABS, MAX_PRIMARY_TABS, tabsForUser } from '../rbac/nav';
import type { StaffUser } from '../auth/types';

const user = (role: string, permissions?: StaffUser['permissions']) =>
  ({ role, permissions }) as Pick<StaffUser, 'role' | 'permissions'>;

const titles = (u: Parameters<typeof tabsForUser>[0]) => tabsForUser(u).map((t) => t.title);

describe('role-adaptive tabs', () => {
  it('gives front_desk its counter workflow', () => {
    expect(titles(user('front_desk'))).toEqual(['Check-in', 'Members', 'Schedule', 'Money']);
  });

  it('gives a trainer no money tab', () => {
    const t = titles(user('trainer'));
    expect(t).toContain('Schedule');
    expect(t).not.toContain('Money');
  });

  it('gives an accountant money and reports, not check-in', () => {
    const t = titles(user('accountant'));
    expect(t).toContain('Money');
    expect(t).not.toContain('Check-in');
  });

  it('gives marketing_manager marketing, not check-in or money', () => {
    const t = titles(user('marketing_manager'));
    expect(t).toContain('Marketing');
    expect(t).not.toContain('Money');
  });

  it('never exceeds the primary tab budget', () => {
    // Owners can see everything; without the cap the bar would overflow.
    expect(tabsForUser(user('owner'))).toHaveLength(MAX_PRIMARY_TABS);
    expect(CANDIDATE_TABS.length).toBeGreaterThan(MAX_PRIMARY_TABS);
  });

  it('derives tabs for a CUSTOM role from its server permission map', () => {
    // The reason tabs are derived rather than looked up by role name.
    const custom = user('weekend_reception', { check_ins: ['view'], members: ['view'] });
    expect(titles(custom)).toEqual(['Check-in', 'Members']);
  });

  it('returns nothing when signed out', () => {
    expect(tabsForUser(null)).toEqual([]);
  });
});

describe('POS requires the ability to SELL, not just view stock', () => {
  it('gives front_desk a POS tab — they run the till', () => {
    expect(titles(user('front_desk', { inventory: ['view', 'create'] }))).toContain('POS');
  });

  it('does NOT give an accountant a POS tab', () => {
    // Accountants hold inventory view/export for stock valuation. Gating POS on
    // 'view' handed them a till — found on device with a real seeded account.
    expect(titles(user('accountant'))).not.toContain('POS');
  });
});
