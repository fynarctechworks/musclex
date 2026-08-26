import { CANDIDATE_TABS, MAX_PRIMARY_TABS, tabsForUser } from '../rbac/nav';
import type { StaffUser } from '../auth/types';

const user = (role: string, permissions?: StaffUser['permissions']) =>
  ({ role, permissions }) as Pick<StaffUser, 'role' | 'permissions'>;

const titles = (u: Parameters<typeof tabsForUser>[0]) => tabsForUser(u).map((t) => t.title);

describe('role-adaptive tabs', () => {
  it('gives front_desk its counter workflow', () => {
    // Home first (every role opens to it), then the desk's actual work.
    expect(titles(user('front_desk'))).toEqual(['Home', 'Check-in', 'Members', 'Money']);
  });

  it('gives a trainer their teaching day', () => {
    expect(titles(user('trainer'))).toEqual(['Home', 'Check-in', 'Members', 'Schedule']);
  });

  it('gives an accountant the money view', () => {
    expect(titles(user('accountant'))).toEqual(['Home', 'Members', 'Money', 'Reports']);
  });

  it('gives a trainer no money tab', () => {
    const t = titles(user('trainer'));
    expect(t).toContain('Schedule');
    expect(t).not.toContain('Money');
  });

  it('gives an accountant money but not check-in', () => {
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
    expect(titles(custom)).toEqual(['Check-in', 'Members']);  // no dashboard grant → no Home
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

/**
 * Reachability: every tab a role can see must be OPENABLE.
 *
 * Only `MAX_PRIMARY_TABS` candidates fit in the tab bar, so anything further
 * down `CANDIDATE_TABS` is silently cut for a role that has the permission for
 * it. That is fine — provided there is another way in. It was not fine for
 * Schedule, which sits 5th: a front desk user had `classes.view` and no route
 * to the schedule at all. POS had the same problem and had been fixed by hand;
 * nothing stopped the next tab repeating it.
 *
 * This asserts the property rather than the two known cases, so adding a tab
 * without an escape hatch fails here instead of in somebody's gym.
 */
describe('every candidate tab is reachable', () => {
  // Imported lazily: the More screen pulls in native modules that the pure
  // nav tests above do not need.
  const { ENTRIES } = require('../../app/(tabs)/more');

  /*
   * Matched by MODULE, not by href. Marketing and Reports are reachable
   * through their own `/more/*` routes rather than the tab route, so
   * comparing paths would report them missing when they are not.
   */
  const moreModules = new Set<string>(
    ENTRIES.map((e: { module: string; action?: string }) => `${e.module}.${e.action ?? 'view'}`),
  );

  it.each(CANDIDATE_TABS.map((t) => [t.title, t.name] as const))(
    '%s is either a primary tab or reachable from More',
    (_title, name) => {
      const index = CANDIDATE_TABS.findIndex((t) => t.name === name);
      const tab = CANDIDATE_TABS[index];
      const alwaysPrimary = index < MAX_PRIMARY_TABS;
      const key = `${tab.module}.${tab.action ?? 'view'}`;
      expect(alwaysPrimary || moreModules.has(key)).toBe(true);
    },
  );

  it('covers the case that actually broke — Schedule past the tab limit', () => {
    const scheduleIndex = CANDIDATE_TABS.findIndex((t) => t.name === 'schedule');
    expect(scheduleIndex).toBeGreaterThanOrEqual(MAX_PRIMARY_TABS);
    expect(moreModules.has('classes.view')).toBe(true);
  });
});

/**
 * Every BUILT More entry must point at a route that exists.
 *
 * The Reports entry pointed at `/more/reports`, a route that was never
 * created, while the real screen lives at `/(tabs)/reports`. For an owner —
 * whose four tab slots are taken by earlier candidates — that entry was the
 * only way in, so Reports was unreachable. The reachability test above did not
 * catch it because it matches by MODULE: the module was listed, the href was
 * just wrong.
 */
describe('every built More entry points at a real route', () => {
  const fs = require('fs');
  const path = require('path');
  const { ENTRIES } = require('../../app/(tabs)/more');

  const appDir = path.join(__dirname, '..', '..', 'app');

  const routeExists = (href: string) => {
    // '/(tabs)/reports' → app/(tabs)/reports.tsx ; '/more/staff' → app/more/staff.tsx
    const rel = href.replace(/^\//, '');
    return (
      fs.existsSync(path.join(appDir, `${rel}.tsx`)) ||
      fs.existsSync(path.join(appDir, rel, 'index.tsx'))
    );
  };

  const built = ENTRIES.filter((e: { phase: string }) => !e.phase);

  it('has at least one built entry to check', () => {
    expect(built.length).toBeGreaterThan(0);
  });

  // A plain loop rather than it.each: the tuple typing fights jest's overloads
  // and the extra ceremony buys nothing here.
  for (const entry of built as Array<{ label: string; href: string }>) {
    it(`${entry.label} → ${entry.href} exists`, () => {
      expect(routeExists(entry.href)).toBe(true);
    });
  }
});
