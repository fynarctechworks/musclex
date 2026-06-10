import { Injectable } from '@nestjs/common';
import type { CheckInContext, CheckInRule, RuleResult } from '../rule.interface';

@Injectable()
export class MembershipRule implements CheckInRule {
  readonly code = 'membership';
  readonly order = 30;

  async evaluate(ctx: CheckInContext): Promise<RuleResult> {
    if (!ctx.membership) {
      return {
        pass: false,
        reason: 'no_active_membership',
        message: 'No active membership found',
        severity: 'overridable',
      };
    }

    if (ctx.membership.status !== 'active') {
      return {
        pass: false,
        reason: `membership_${ctx.membership.status}`,
        message: `Membership is ${ctx.membership.status}`,
        severity: 'overridable',
      };
    }

    if (ctx.membership.end_date) {
      const endTime = new Date(ctx.membership.end_date).getTime();
      const graceTime = ctx.membership.grace_end_date
        ? new Date(ctx.membership.grace_end_date).getTime()
        : endTime;
      const cutoff = Math.max(endTime, graceTime);

      if (cutoff < ctx.now.getTime()) {
        ctx.derived.membership_expired = true;
        return {
          pass: false,
          reason: 'membership_expired',
          message: 'Membership expired',
          severity: 'overridable',
        };
      }
    }

    return { pass: true };
  }
}
