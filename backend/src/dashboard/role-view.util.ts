import type { JwtPayload } from '../common/decorators/current-user.decorator';

export type DashboardRoleView =
  | 'owner'
  | 'manager'
  | 'trainer'
  | 'front_desk';

/**
 * Maps a JWT role to the dashboard variant that should render. Wave 3 of
 * the World #1 Dashboard plan: five role-rendered shells, not one with
 * permission gates.
 *
 * Mapping:
 *   - owner / brand_owner / super_admin / multi_branch_owner → 'owner'
 *   - manager → 'manager'
 *   - trainer → 'trainer'
 *   - receptionist / front_desk / staff (anything else) → 'front_desk'
 */
export function resolveRoleView(user?: JwtPayload | null): DashboardRoleView {
  const role = user?.role ?? 'front_desk';
  if (
    role === 'owner' ||
    role === 'super_admin' ||
    role === 'brand_owner' ||
    role === 'multi_branch_owner'
  ) {
    return 'owner';
  }
  if (role === 'manager') return 'manager';
  if (role === 'trainer') return 'trainer';
  return 'front_desk';
}

/**
 * Capability flags for the resolved view. The dashboard service layer reads
 * these to decide what to compute and what to strip server-side. Front-end
 * variants ALSO read these to avoid asking for data they wouldn't display.
 */
export interface RoleCapabilities {
  view: DashboardRoleView;
  /** Sees gym-wide revenue / MRR / today's revenue / outstanding dues totals. */
  see_financials: boolean;
  /** Sees churn / renewal-risk / inactive-member rules across the gym. */
  see_churn_signals: boolean;
  /** Limited to data scoped to their own classes / clients. */
  scope_to_self: boolean;
  /** Branch-level only (no chain roll-up); when true, the active branch is mandatory. */
  branch_only: boolean;
  /** Front-desk Compact Mode — large operations zone, no analytics. */
  compact_mode: boolean;
}

export function capabilitiesFor(view: DashboardRoleView): RoleCapabilities {
  switch (view) {
    case 'owner':
      return {
        view,
        see_financials: true,
        see_churn_signals: true,
        scope_to_self: false,
        branch_only: false,
        compact_mode: false,
      };
    case 'manager':
      return {
        view,
        see_financials: true,
        see_churn_signals: true,
        scope_to_self: false,
        branch_only: true,
        compact_mode: false,
      };
    case 'trainer':
      return {
        view,
        see_financials: false,
        see_churn_signals: true, // for OWN clients only
        scope_to_self: true,
        branch_only: true,
        compact_mode: false,
      };
    case 'front_desk':
    default:
      return {
        view,
        see_financials: false,
        see_churn_signals: false,
        scope_to_self: false,
        branch_only: true,
        compact_mode: true,
      };
  }
}
