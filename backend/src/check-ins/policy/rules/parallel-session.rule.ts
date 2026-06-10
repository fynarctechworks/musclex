import { Injectable } from '@nestjs/common';
import type { CheckInContext, CheckInRule, RuleResult } from '../rule.interface';

/**
 * Anti-sharing guard for cross-branch memberships.
 *
 * If a member with a multi-branch / all-access / city-access plan is already
 * checked in at Branch A (no check_out_at recorded), reject any attempt to
 * check in at Branch B until they're checked out — even if both branches are
 * within the plan's allowed set. Without this rule, a member can hand their
 * QR / face to a friend across town and both walk in simultaneously.
 *
 * Skipped for single_branch plans: DuplicateRule already covers same-day
 * re-entry in the same branch; an open visit at the home branch is a
 * forgotten check-out, not sharing.
 *
 * Skipped for class_only: enforced separately by class booking logic.
 *
 * Severity: overridable so front-desk can manually resolve forgotten
 * check-outs (the most common cause). Real fraud will get rejected and
 * surface in the rule_trace for review.
 *
 * Order: 15 — runs right after branch-access but before membership /
 * freeze / class-credits so we fail fast on the cheap query.
 */
@Injectable()
export class ParallelSessionRule implements CheckInRule {
  readonly code = 'parallel_session';
  readonly order = 15;

  async evaluate(ctx: CheckInContext): Promise<RuleResult> {
    if (!ctx.membership) return { pass: true };

    const accessType = ctx.membership.plan.access_type ?? 'single_branch';
    if (accessType === 'single_branch' || accessType === 'class_only') {
      return { pass: true };
    }

    const targetBranchId =
      ctx.request.branch_id ??
      ctx.membership.branch_id ??
      ctx.member.branch_id;

    // Find any open visit (no check_out_at) at a *different* branch. We
    // intentionally don't constrain by date — a 12h-old open visit is
    // almost certainly a forgotten check-out, but it's still an open
    // session that someone could be exploiting. Front desk overrides
    // when needed.
    const openElsewhere = await ctx.prisma.checkIn.findFirst({
      where: {
        member_id: ctx.member.id,
        status: 'success',
        check_out_at: null,
        branch_id: { not: targetBranchId },
      },
      select: { id: true, branch_id: true, checked_in_at: true },
      orderBy: { checked_in_at: 'desc' },
    });

    if (!openElsewhere) return { pass: true };

    return {
      pass: false,
      reason: 'parallel_session_open',
      message:
        'Member is currently checked in at another branch. Check them out there before checking in here.',
      severity: 'overridable',
    };
  }
}
