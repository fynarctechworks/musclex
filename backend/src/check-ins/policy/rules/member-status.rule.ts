import { Injectable } from '@nestjs/common';
import type { CheckInContext, CheckInRule, RuleResult } from '../rule.interface';

const BLOCKED_STATUSES = new Set(['inactive', 'cancelled', 'banned', 'lead']);
const FROZEN_STATUSES = new Set(['frozen']);

@Injectable()
export class MemberStatusRule implements CheckInRule {
  readonly code = 'member_status';
  readonly order = 20;

  async evaluate(ctx: CheckInContext): Promise<RuleResult> {
    const status = ctx.member.status;

    if (FROZEN_STATUSES.has(status)) {
      return {
        pass: false,
        reason: 'member_frozen',
        message: 'Member account is frozen',
        severity: 'overridable',
      };
    }

    if (BLOCKED_STATUSES.has(status)) {
      return {
        pass: false,
        reason: `member_${status}`,
        message: `Member account is ${status}`,
        severity: 'block',
      };
    }

    return { pass: true };
  }
}
