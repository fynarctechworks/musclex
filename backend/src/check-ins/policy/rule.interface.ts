import type { Prisma } from '@prisma/client';

/**
 * Inputs passed into the rule engine for a single check-in attempt.
 * Built by the orchestrator after member + membership + branch resolution.
 *
 * Rules read from this context; they MUST NOT mutate it. If a rule needs
 * to share derived state with later rules, attach it to `derived`.
 */
export interface CheckInContext {
  gym_id: string;
  now: Date;

  member: {
    id: string;
    status: string;
    branch_id: string;
    full_name: string;
    member_code: string;
  };

  membership: {
    id: string;
    status: string;
    branch_id: string;
    end_date: Date | null;
    grace_end_date: Date | null;
    classes_remaining: number | null;
    freeze_start_date: Date | null;
    freeze_end_date: Date | null;
    plan: {
      plan_type: string;
      name?: string | null;
      // ── Multi-gym access scope (Phase 2) ──
      access_type?: string; // single_branch | multi_branch | all_access | city_access | time_based | class_only
      tier?: string;
      allowed_branch_ids?: string[];
      allowed_city?: string | null;
      allowed_hours_json?: Record<string, unknown> | null;
      organization_id?: string | null;
    };
    /**
     * Explicit per-membership branch allowlist loaded from
     * `membership_branch_access`. Includes the home branch plus any extras
     * granted (e.g. travel passes). Empty array means "fall back to plan
     * scope" — the resolver, not the rules, decides what that means.
     */
    branch_access_ids?: string[];
  } | null;

  branch: {
    id: string;
    timezone: string;
    opening_time: string | null;
    closing_time: string | null;
    organization_id?: string | null;
    city?: string | null;
  };

  request: {
    branch_id: string | null;
    class_id: string | null;
    method: string;
    source: string;
    client_event_id: string | null;
    override_authorized: boolean;
    override_reason: string | null;
  };

  /** Read-only handle for rules that need DB access (e.g. freeze, duplicate). */
  prisma: Prisma.TransactionClient;

  /** Inter-rule scratchpad. Earlier rules may attach hints later rules consume. */
  derived: Record<string, unknown>;
}

export type RuleSeverity = 'block' | 'overridable' | 'warn';

export type RuleResult =
  | { pass: true; warn?: string }
  | { pass: false; reason: string; message: string; severity: RuleSeverity };

export interface CheckInRule {
  /** Stable kebab-case identifier; appears in rule_trace and audit logs. */
  readonly code: string;
  /** Lower runs earlier. Use 10-step gaps so new rules can wedge in. */
  readonly order: number;
  evaluate(ctx: CheckInContext): Promise<RuleResult>;
}

/** DI multi-provider token. All rules register against this. */
export const CHECK_IN_RULES = Symbol('CHECK_IN_RULES');
