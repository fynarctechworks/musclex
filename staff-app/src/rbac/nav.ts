import type { LucideIcon } from 'lucide-react-native';
import {
  BarChart3, CalendarDays, LayoutGrid, Megaphone, ScanLine, ShoppingCart,
  Users, Wallet,
} from 'lucide-react-native';

import type { StaffUser } from '@/auth/types';
import { can, type Action, type Module } from '@/rbac/permissions';

/**
 * Role-adaptive navigation.
 *
 * Tabs are DERIVED from the permission map at runtime, never looked up by role
 * name. Gyms author their own roles via /settings/roles, so any per-role table
 * would simply miss them — a custom "Weekend Reception" role must still get a
 * sensible tab bar.
 *
 * The last tab is always More, which carries everything that did not fit.
 */
export type TabDef = {
  name: string;
  title: string;
  icon: LucideIcon;
  /** Permission required to see this tab. */
  module: Module;
  /**
   * Action required, default 'view'. POS needs 'create': an accountant has
   * inventory view/export for stock valuation but must not get a till. Gating
   * POS on 'view' handed them one — caught on device, not in unit tests.
   */
  action?: Action;
};

/**
 * Candidate tabs in priority order. The first four the user can see become
 * their tabs; More is always appended.
 *
 * Order encodes what each role opens the app to do: check-in leads for front
 * desk, schedule for trainers, money for accountants. It is a single ordered
 * list rather than per-role sets so custom roles inherit sane behaviour.
 */
export const CANDIDATE_TABS: TabDef[] = [
  { name: 'index',    title: 'Check-in', icon: ScanLine,     module: 'check_ins' },
  { name: 'members',  title: 'Members',  icon: Users,        module: 'members' },
  { name: 'schedule', title: 'Schedule', icon: CalendarDays, module: 'classes' },
  { name: 'money',    title: 'Money',    icon: Wallet,       module: 'payments' },
  { name: 'pos',      title: 'POS',      icon: ShoppingCart, module: 'inventory', action: 'create' },
  { name: 'marketing',title: 'Marketing',icon: Megaphone,    module: 'marketing' },
  { name: 'reports',  title: 'Reports',  icon: BarChart3,    module: 'reports' },
];

export const MORE_TAB: Omit<TabDef, 'module'> = {
  name: 'more', title: 'More', icon: LayoutGrid,
};

/** Max primary tabs before More. Five total is the iOS/Android convention. */
export const MAX_PRIMARY_TABS = 4;

export function tabsForUser(
  user: Pick<StaffUser, 'role' | 'permissions' | 'permission_codes'> | null | undefined,
): TabDef[] {
  if (!user) return [];
  return CANDIDATE_TABS.filter((t) => can(user, t.module, t.action ?? 'view')).slice(0, MAX_PRIMARY_TABS);
}
