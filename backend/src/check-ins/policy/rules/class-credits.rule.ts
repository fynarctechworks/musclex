import { Injectable } from '@nestjs/common';
import type { CheckInContext, CheckInRule, RuleResult } from '../rule.interface';

@Injectable()
export class ClassCreditsRule implements CheckInRule {
  readonly code = 'class_credits';
  readonly order = 60;

  async evaluate(ctx: CheckInContext): Promise<RuleResult> {
    if (!ctx.membership) return { pass: true };

    if (
      ctx.membership.plan.plan_type === 'class_pack' &&
      ctx.membership.classes_remaining !== null &&
      ctx.membership.classes_remaining <= 0
    ) {
      return {
        pass: false,
        reason: 'no_credits',
        message: 'No classes remaining on this pack',
        severity: 'overridable',
      };
    }

    return { pass: true };
  }
}
