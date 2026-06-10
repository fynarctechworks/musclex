import { Injectable } from '@nestjs/common';
import type { CheckInContext, CheckInRule, RuleResult } from '../rule.interface';
import { AccessScopeResolver } from '../access-scope.resolver';

/**
 * Branch-access rule (Phase 2). Delegates to AccessScopeResolver so every
 * supported plan access_type — single_branch, multi_branch, all_access,
 * city_access, time_based, class_only — flows through the same code path.
 *
 * For legacy memberships (no access_type column populated) the resolver
 * falls back to single_branch behavior, preserving exact pre-Phase 2 logic.
 *
 * Failures here are `overridable` so a staff member can override at the
 * desk; AccessPolicyEngine accumulates the rule trace for forensics.
 */
@Injectable()
export class BranchAccessRule implements CheckInRule {
  readonly code = 'branch_access';
  readonly order = 10;

  constructor(private readonly resolver: AccessScopeResolver) {}

  async evaluate(ctx: CheckInContext): Promise<RuleResult> {
    const decision = await this.resolver.resolve(ctx);
    if (decision.allowed) return { pass: true };
    return {
      pass: false,
      reason: decision.reason,
      message: decision.message,
      severity: 'overridable',
    };
  }
}
