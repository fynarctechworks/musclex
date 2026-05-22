import { Injectable } from '@nestjs/common';
import type { CheckInContext, CheckInRule, RuleResult } from '../rule.interface';

/**
 * Block same-day duplicate check-ins per branch timezone.
 *
 * Branch-aware (closes critical gap #9): a duplicate is "another
 * successful check-in for this member in the same local day as defined by
 * branch.timezone". Class check-ins are scoped to the same class_id so a
 * member can attend gym + class in the same day.
 *
 * The atomic re-check happens inside the persistence transaction; this
 * rule's evaluation is the early-warning pass to populate rule_trace.
 */
@Injectable()
export class DuplicateRule implements CheckInRule {
  readonly code = 'duplicate';
  readonly order = 70;

  async evaluate(ctx: CheckInContext): Promise<RuleResult> {
    const { todayStart, todayEnd } = dayBoundsInTz(ctx.now, ctx.branch.timezone);

    const existing = await ctx.prisma.checkIn.findFirst({
      where: {
        member_id: ctx.member.id,
        checked_in_at: { gte: todayStart, lte: todayEnd },
        status: 'success',
        ...(ctx.request.class_id ? { class_id: ctx.request.class_id } : {}),
      },
      select: { id: true },
    });

    if (existing && !ctx.request.class_id) {
      return {
        pass: false,
        reason: 'already_checked_in',
        message: 'Member has already checked in today',
        severity: 'overridable',
      };
    }

    if (existing && ctx.request.class_id) {
      return {
        pass: false,
        reason: 'already_checked_in_class',
        message: 'Member already checked in to this class',
        severity: 'overridable',
      };
    }

    return { pass: true };
  }
}

function dayBoundsInTz(now: Date, tz: string): { todayStart: Date; todayEnd: Date } {
  const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const todayStart = new Date(local);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(local);
  todayEnd.setHours(23, 59, 59, 999);
  return { todayStart, todayEnd };
}
