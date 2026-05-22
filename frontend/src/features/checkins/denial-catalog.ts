/**
 * Single source of truth for translating the orchestrator's
 * `failure_reason` enum codes into human, operator-facing copy.
 *
 * Every code maps to:
 *   - `title`:     short label for chips / pills (≤ 24 chars)
 *   - `headline`:  one-line operator framing (the "what")
 *   - `next_step`: what the operator should DO next (the "now what")
 *   - `severity`:  visual tone — drives colour ramp on UI
 *   - `is_overridable`: whether `OverrideDialog` is offered
 *
 * Used by:
 *   - CheckinResult (Reception overlay)
 *   - KioskDenialScreen (entrance hardware)
 *   - deriveAlerts (right-rail alert list)
 *   - OverrideDialog (the modal headline)
 */

export type DenialSeverity = 'block' | 'warn' | 'info';

export interface DenialEntry {
  title: string;
  headline: string;
  next_step: string;
  severity: DenialSeverity;
  is_overridable: boolean;
}

const CATALOG: Record<string, DenialEntry> = {
  // ── Membership state ───────────────────────────────────────────
  no_active_membership: {
    title: 'No Active Plan',
    headline: 'This member has no active membership',
    next_step: 'Sell or reactivate a plan from the member profile.',
    severity: 'block',
    is_overridable: true,
  },
  membership_expired: {
    title: 'Plan Expired',
    headline: 'Membership has expired',
    next_step: 'Renew now or override with reason (manager only).',
    severity: 'block',
    is_overridable: true,
  },
  membership_paused: {
    title: 'Plan Paused',
    headline: 'Membership is paused',
    next_step: 'Resume the plan from the member profile.',
    severity: 'block',
    is_overridable: true,
  },
  membership_pending: {
    title: 'Plan Pending',
    headline: 'Membership is awaiting activation',
    next_step: 'Activate from the member profile.',
    severity: 'block',
    is_overridable: true,
  },
  membership_cancelled: {
    title: 'Plan Cancelled',
    headline: 'Membership has been cancelled',
    next_step: 'Sell a new plan or override with reason.',
    severity: 'block',
    is_overridable: true,
  },
  membership_frozen: {
    title: 'On Freeze',
    headline: 'Membership is currently frozen',
    next_step: 'Lift the freeze from the member profile if appropriate.',
    severity: 'warn',
    is_overridable: true,
  },

  // ── Member state ──────────────────────────────────────────────
  member_frozen: {
    title: 'Member Frozen',
    headline: 'This member account is frozen',
    next_step: 'Unfreeze from the member profile.',
    severity: 'warn',
    is_overridable: true,
  },
  member_inactive: {
    title: 'Inactive Member',
    headline: 'Account is marked inactive',
    next_step: 'Reactivate from the member profile.',
    severity: 'block',
    is_overridable: true,
  },
  member_cancelled: {
    title: 'Cancelled Member',
    headline: 'Account has been cancelled',
    next_step: 'Re-enroll via Members.',
    severity: 'block',
    is_overridable: false,
  },
  member_banned: {
    title: 'Member Banned',
    headline: 'This account is banned',
    next_step: 'Contact a manager; do not override at the front desk.',
    severity: 'block',
    is_overridable: false,
  },
  member_lead: {
    title: 'Lead — Not a Member',
    headline: 'This contact is a lead, not a member',
    next_step: 'Convert to a member via Sales.',
    severity: 'info',
    is_overridable: true,
  },

  // ── Branch & class ────────────────────────────────────────────
  wrong_branch: {
    title: 'Wrong Branch',
    headline: 'Member is registered at another branch',
    next_step: 'Switch the active branch in the top bar.',
    severity: 'warn',
    is_overridable: true,
  },
  branch_not_in_plan: {
    title: 'Branch Not Allowed',
    headline: 'This branch is not in the member’s multi-branch plan',
    next_step:
      'Direct them to an allowed branch, upgrade their plan, or grant temporary access from their profile.',
    severity: 'warn',
    is_overridable: true,
  },
  branch_outside_organization: {
    title: 'Outside Network',
    headline: 'This branch is outside the member’s all-access network',
    next_step:
      'All-access only covers branches in the same organization. Override only with manager approval.',
    severity: 'block',
    is_overridable: true,
  },
  branch_outside_city: {
    title: 'Outside City Scope',
    headline: 'This branch is outside the member’s city-scoped plan',
    next_step:
      'Direct them to a branch in the allowed city, or grant a temporary travel pass.',
    severity: 'warn',
    is_overridable: true,
  },
  outside_allowed_hours: {
    title: 'Outside Allowed Hours',
    headline: 'This plan is only valid during specific hours',
    next_step:
      'Ask the member to return during their allowed window, or override with reason.',
    severity: 'warn',
    is_overridable: true,
  },
  class_only_plan: {
    title: 'Class-Only Plan',
    headline: 'This plan only allows access to booked classes',
    next_step: 'Book them into a class first, or sell a drop-in.',
    severity: 'info',
    is_overridable: true,
  },
  city_scope_misconfigured: {
    title: 'Plan Misconfigured',
    headline: 'City-access plan has no city set',
    next_step:
      'Fix the plan in Settings → Plans (add an allowed city), then retry.',
    severity: 'block',
    is_overridable: false,
  },
  unknown_access_type: {
    title: 'Unknown Plan Scope',
    headline: 'Plan has an unrecognized access type',
    next_step:
      'Fix the plan in Settings → Plans or contact support — failing closed to be safe.',
    severity: 'block',
    is_overridable: false,
  },
  branch_not_found: {
    title: 'Branch Not Found',
    headline: 'Could not find a record for this branch',
    next_step:
      'Confirm the branch exists in Settings → Branches and reload.',
    severity: 'block',
    is_overridable: false,
  },
  parallel_session_open: {
    title: 'Open Session Elsewhere',
    headline: 'Member is currently checked in at another branch',
    next_step:
      'Check them out at the other branch first, then retry here. Likely a forgotten check-out.',
    severity: 'warn',
    is_overridable: true,
  },
  no_credits: {
    title: 'No Credits',
    headline: 'No class credits remaining on this plan',
    next_step: 'Top up the plan or sell a drop-in.',
    severity: 'block',
    is_overridable: true,
  },

  // ── Rate / repeat ─────────────────────────────────────────────
  cooldown: {
    title: 'Just Checked In',
    headline: 'This member checked in moments ago',
    next_step: 'Wait a few seconds before re-scanning.',
    severity: 'info',
    is_overridable: true,
  },
  already_checked_in: {
    title: 'Already Today',
    headline: 'This member has already checked in today',
    next_step: 'Override only if they actually left and returned.',
    severity: 'info',
    is_overridable: true,
  },
  already_checked_in_class: {
    title: 'Already In Class',
    headline: 'Already checked in to this class',
    next_step: 'No action needed.',
    severity: 'info',
    is_overridable: false,
  },

  // ── Identification ────────────────────────────────────────────
  no_match: {
    title: 'No Match',
    headline: 'We couldn’t find a matching member',
    next_step: 'Try QR or search manually.',
    severity: 'info',
    is_overridable: false,
  },

  // ── Fallback ──────────────────────────────────────────────────
  denied: {
    title: 'Denied',
    headline: 'Check-in could not be completed',
    next_step: 'Verify the member at the desk.',
    severity: 'block',
    is_overridable: true,
  },
};

const FALLBACK: DenialEntry = CATALOG.denied;

/**
 * Look up a denial entry. Falls back to the generic 'denied' entry rather
 * than returning null — callers always render something useful.
 */
export function lookupDenial(reasonCode: string | null | undefined): DenialEntry {
  if (!reasonCode) return FALLBACK;
  return CATALOG[reasonCode] ?? FALLBACK;
}

/** Convenience: convert any unknown code to a Title Case label. */
export function humanizeReason(code: string | null | undefined): string {
  if (!code) return 'Denied';
  const known = CATALOG[code];
  if (known) return known.title;
  return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** All known reason codes — useful for telemetry / dashboards. */
export const KNOWN_DENIAL_REASONS = Object.keys(CATALOG);
