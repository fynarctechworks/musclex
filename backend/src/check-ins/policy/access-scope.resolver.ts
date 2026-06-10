import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CheckInContext } from './rule.interface';

/**
 * Cross-branch access scope resolution (Phase 2 of multi-gym architecture).
 *
 * Decides whether a member's active membership grants access to the branch
 * they're trying to check into. Six modes, in order of evaluation:
 *
 *   single_branch   home branch OR any branch in `membership_branch_access`
 *                   (covers backfilled legacy memberships)
 *   multi_branch    plan.allowed_branch_ids ∪ membership_branch_access
 *   all_access      any branch under plan.organization_id (Cult Elite-style)
 *   city_access     any branch whose `city` matches plan.allowed_city
 *   time_based      single_branch + within plan.allowed_hours_json window
 *   class_only      requires ctx.request.class_id; otherwise denied
 *
 * Pure-ish: everything but `all_access` and `city_access` is decided from
 * already-loaded context. Those two require one extra branch lookup (kept
 * narrow and indexed) which is why this is a service, not a static helper.
 */
@Injectable()
export class AccessScopeResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(ctx: CheckInContext): Promise<ScopeDecision> {
    if (!ctx.membership) {
      // No membership — let MembershipRule produce the canonical denial.
      // We don't second-guess that here; pass-through.
      return { allowed: true };
    }

    const targetBranchId =
      ctx.request.branch_id ??
      ctx.membership.branch_id ??
      ctx.member.branch_id;

    const accessType = ctx.membership.plan.access_type ?? 'single_branch';
    const explicitGrants = new Set(ctx.membership.branch_access_ids ?? []);

    // class_only short-circuits regardless of branch — must have a class context.
    if (accessType === 'class_only' && !ctx.request.class_id) {
      return {
        allowed: false,
        reason: 'class_only_plan',
        message: 'This plan only allows access to booked classes',
      };
    }

    switch (accessType) {
      case 'single_branch':
        if (
          targetBranchId === ctx.membership.branch_id ||
          targetBranchId === ctx.member.branch_id ||
          explicitGrants.has(targetBranchId)
        ) {
          return { allowed: true };
        }
        return wrongBranch(targetBranchId);

      case 'multi_branch': {
        const planAllow = new Set(ctx.membership.plan.allowed_branch_ids ?? []);
        if (
          planAllow.has(targetBranchId) ||
          explicitGrants.has(targetBranchId) ||
          targetBranchId === ctx.membership.branch_id
        ) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: 'branch_not_in_plan',
          message:
            'This branch is not included in your multi-branch membership. Visit an allowed location or upgrade your plan.',
        };
      }

      case 'all_access':
        return this.resolveAllAccess(ctx, targetBranchId);

      case 'city_access':
        return this.resolveCityAccess(ctx, targetBranchId);

      case 'time_based': {
        const branchOk =
          targetBranchId === ctx.membership.branch_id ||
          explicitGrants.has(targetBranchId);
        if (!branchOk) return wrongBranch(targetBranchId);
        const within = withinAllowedHours(
          ctx.now,
          ctx.branch.timezone,
          ctx.membership.plan.allowed_hours_json ?? null,
        );
        if (!within) {
          return {
            allowed: false,
            reason: 'outside_allowed_hours',
            message: 'This membership is only valid during specific hours',
          };
        }
        return { allowed: true };
      }

      case 'class_only':
        // We've already validated class context above; branch-wise treat as
        // single_branch.
        if (
          targetBranchId === ctx.membership.branch_id ||
          explicitGrants.has(targetBranchId)
        ) {
          return { allowed: true };
        }
        return wrongBranch(targetBranchId);

      default:
        // Unknown access_type — fail closed with a clear reason rather than
        // silently allowing anywhere.
        return {
          allowed: false,
          reason: 'unknown_access_type',
          message: `Unrecognized plan access_type: ${accessType}`,
        };
    }
  }

  // ── all_access: target branch must share organization with the plan ──
  // Plan org wins when set; otherwise we fall back to the membership's
  // home-branch org (covers older plans created before organization_id was
  // populated).
  private async resolveAllAccess(
    ctx: CheckInContext,
    targetBranchId: string,
  ): Promise<ScopeDecision> {
    const planOrg = ctx.membership!.plan.organization_id ?? null;
    const targetOrg = ctx.branch.organization_id ?? null;

    if (planOrg && targetOrg && planOrg === targetOrg) {
      return { allowed: true };
    }

    // ctx.branch.organization_id may be missing for legacy branches not yet
    // associated with an organization. Do a narrow lookup to confirm.
    const target = await ctx.prisma.branch.findUnique({
      where: { id: targetBranchId },
      select: { organization_id: true },
    });

    if (!target) {
      return { allowed: false, reason: 'branch_not_found', message: 'Target branch not found' };
    }

    if (planOrg && target.organization_id === planOrg) {
      return { allowed: true };
    }

    // Fall back: compare against the membership branch's organization.
    if (!planOrg) {
      const home = await ctx.prisma.branch.findUnique({
        where: { id: ctx.membership!.branch_id },
        select: { organization_id: true },
      });
      if (
        home?.organization_id &&
        target.organization_id &&
        home.organization_id === target.organization_id
      ) {
        return { allowed: true };
      }
    }

    return {
      allowed: false,
      reason: 'branch_outside_organization',
      message: 'This branch is outside your all-access network',
    };
  }

  // ── city_access: target branch.city must match plan.allowed_city ──
  // Case-insensitive comparison so "Hyderabad" / "hyderabad" / "HYDERABAD"
  // all match — gym staff data entry varies.
  private async resolveCityAccess(
    ctx: CheckInContext,
    targetBranchId: string,
  ): Promise<ScopeDecision> {
    const allowedCity = (ctx.membership!.plan.allowed_city ?? '').trim().toLowerCase();
    if (!allowedCity) {
      return {
        allowed: false,
        reason: 'city_scope_misconfigured',
        message: 'City-access plan has no city configured',
      };
    }

    const targetCity = (ctx.branch.city ?? '').trim().toLowerCase();
    if (targetCity && targetCity === allowedCity) {
      return { allowed: true };
    }

    // Lookup if city not preloaded.
    const target = await ctx.prisma.branch.findUnique({
      where: { id: targetBranchId },
      select: { city: true },
    });

    if ((target?.city ?? '').trim().toLowerCase() === allowedCity) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'branch_outside_city',
      message: `This plan is only valid in ${ctx.membership!.plan.allowed_city}`,
    };
  }
}

export type ScopeDecision =
  | { allowed: true }
  | { allowed: false; reason: string; message: string };

function wrongBranch(_targetBranchId: string): ScopeDecision {
  return {
    allowed: false,
    reason: 'wrong_branch',
    message:
      'Membership is bound to a different branch. Switch branches to check in here.',
  };
}

// HH:mm comparison in the branch timezone. allowed_hours_json shape:
//   { "start": "06:00", "end": "10:00", "days": [1,2,3,4,5] }
// Missing `days` means all days. Missing start/end means always-allowed.
function withinAllowedHours(
  now: Date,
  tz: string,
  spec: Record<string, unknown> | null,
): boolean {
  if (!spec) return true;
  const start = typeof spec.start === 'string' ? (spec.start as string) : null;
  const end = typeof spec.end === 'string' ? (spec.end as string) : null;
  if (!start || !end) return true;

  const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const minutesNow = local.getHours() * 60 + local.getMinutes();
  const [sh, sm] = start.split(':').map((n) => parseInt(n, 10));
  const [eh, em] = end.split(':').map((n) => parseInt(n, 10));
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  if (Array.isArray(spec.days) && spec.days.length > 0) {
    if (!spec.days.includes(local.getDay())) return false;
  }

  // Handles overnight windows too (e.g. 22:00 → 04:00).
  if (startMin <= endMin) {
    return minutesNow >= startMin && minutesNow <= endMin;
  }
  return minutesNow >= startMin || minutesNow <= endMin;
}
