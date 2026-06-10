import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CHECK_IN_RULES,
  type CheckInContext,
  type CheckInRule,
  type RuleResult,
  type RuleSeverity,
} from './rule.interface';

export interface PolicyDecision {
  decision: 'pass' | 'deny' | 'overridable';
  reason?: string;
  message?: string;
  severity?: RuleSeverity;
  trace: Array<{ rule: string; result: string }>;
  warnings: Array<{ rule: string; message: string }>;
}

/**
 * Runs each registered rule in `order` ascending. On the first `block`
 * failure, short-circuits to `deny`. On the first `overridable` failure
 * without override authorization, marks the decision `overridable` and
 * short-circuits. `warn` failures accumulate without blocking.
 *
 * Rule order, blast radius, and reasons are all captured in the trace —
 * stored on the resulting CheckInEvent.rule_trace for forensics.
 */
@Injectable()
export class AccessPolicyEngine {
  private readonly logger = new Logger(AccessPolicyEngine.name);
  private readonly orderedRules: CheckInRule[];

  constructor(@Inject(CHECK_IN_RULES) rules: CheckInRule[]) {
    this.orderedRules = [...rules].sort((a, b) => a.order - b.order);
  }

  async evaluate(ctx: CheckInContext): Promise<PolicyDecision> {
    const trace: PolicyDecision['trace'] = [];
    const warnings: PolicyDecision['warnings'] = [];

    for (const rule of this.orderedRules) {
      let result: RuleResult;
      try {
        result = await rule.evaluate(ctx);
      } catch (err) {
        this.logger.error(`Rule "${rule.code}" threw: ${(err as Error).message}`);
        trace.push({ rule: rule.code, result: 'ERROR' });
        continue;
      }

      if (result.pass) {
        trace.push({ rule: rule.code, result: result.warn ? `PASS:warn:${result.warn}` : 'PASS' });
        if (result.warn) warnings.push({ rule: rule.code, message: result.warn });
        continue;
      }

      trace.push({ rule: rule.code, result: `FAIL:${result.severity}:${result.reason}` });

      if (result.severity === 'warn') {
        warnings.push({ rule: rule.code, message: result.message });
        continue;
      }

      if (result.severity === 'block') {
        return {
          decision: 'deny',
          reason: result.reason,
          message: result.message,
          severity: 'block',
          trace,
          warnings,
        };
      }

      // overridable
      if (ctx.request.override_authorized) {
        trace.push({ rule: rule.code, result: `OVERRIDDEN` });
        warnings.push({ rule: rule.code, message: result.message });
        continue;
      }

      return {
        decision: 'overridable',
        reason: result.reason,
        message: result.message,
        severity: 'overridable',
        trace,
        warnings,
      };
    }

    return { decision: 'pass', trace, warnings };
  }
}
