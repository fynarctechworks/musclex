import { Injectable } from '@nestjs/common';
import type { CheckInContext, CheckInRule, RuleResult } from '../rule.interface';

/**
 * Block check-ins for members whose membership has an active freeze that
 * covers today (per branch timezone). Closes critical gap #4 from the
 * Phase 1 discovery report — previously freezes were silently ignored if
 * membership.status was still 'active'.
 */
@Injectable()
export class FreezeRule implements CheckInRule {
  readonly code = 'membership_freeze';
  readonly order = 40;

  async evaluate(ctx: CheckInContext): Promise<RuleResult> {
    if (!ctx.membership) return { pass: true };

    const today = startOfDayInTz(ctx.now, ctx.branch.timezone);

    if (ctx.membership.freeze_start_date && ctx.membership.freeze_end_date) {
      const fs = new Date(ctx.membership.freeze_start_date);
      const fe = new Date(ctx.membership.freeze_end_date);
      if (fs <= today && today <= fe) {
        return {
          pass: false,
          reason: 'membership_frozen',
          message: `Membership frozen until ${fe.toISOString().slice(0, 10)}`,
          severity: 'overridable',
        };
      }
    }

    const activeFreeze = await ctx.prisma.membershipFreeze.findFirst({
      where: {
        membership_id: ctx.membership.id,
        status: 'active',
        start_date: { lte: today },
        OR: [{ end_date: null }, { end_date: { gte: today } }],
      },
      select: { id: true, end_date: true, reason: true },
    });

    if (activeFreeze) {
      const until = activeFreeze.end_date
        ? activeFreeze.end_date.toISOString().slice(0, 10)
        : 'indefinitely';
      return {
        pass: false,
        reason: 'membership_frozen',
        message: `Membership frozen until ${until}${activeFreeze.reason ? ` (${activeFreeze.reason})` : ''}`,
        severity: 'overridable',
      };
    }

    return { pass: true };
  }
}

function startOfDayInTz(now: Date, tz: string): Date {
  const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  local.setHours(0, 0, 0, 0);
  return local;
}
