import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionActivatedPayload } from './events/domain-events';

// ── Strongly-typed shapes for JSONB fields ────────────────────────

export interface RuleConditions {
  /** Match only listed plan IDs. Absent / empty array → any plan. */
  plan_ids?: string[];
  /** Match only listed billing cycles. Absent / empty → any. */
  billing_cycles?: ('monthly' | 'annual')[];
  /** Minimum amount paid (in the studio's currency). */
  min_subscription_amount?: number;
  /** ISO-3166-1 alpha-2. Absent / empty → any country. */
  studio_countries?: string[];
  /** Max rewarded referrals per referrer under this rule. */
  max_referrals_per_referrer?: number;
}

export interface RewardAction {
  type: 'extend_subscription' | 'account_credit' | 'trial_extension' | 'wallet_credit';
  days?: number;      // extend_subscription / trial_extension
  amount?: number;    // account_credit / wallet_credit
  currency?: string;  // account_credit / wallet_credit
  expires_in_days?: number; // wallet_credit only — credit expiry
}

export interface MatchedRule {
  id: string;
  name: string;
  rewards: RewardAction[];
}

// ── Context passed to the engine for each evaluation ─────────────

export interface EvaluationContext {
  referrerStudioId: string;
  referredStudioCountry: string | null;
  payload: SubscriptionActivatedPayload;
}

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluate all active rules against the event context.
   * Rules are sorted by priority DESC so the highest-priority rule wins
   * in case of conflict (though normally ALL matching rules are returned).
   *
   * Returns a list of rules whose conditions all pass, ordered by priority.
   */
  async evaluate(ctx: EvaluationContext): Promise<MatchedRule[]> {
    const now = new Date();

    const rules = await this.prisma.referralRewardRule.findMany({
      where: {
        is_active: true,
        OR: [{ valid_from: null }, { valid_from: { lte: now } }],
        AND: [{ OR: [{ valid_until: null }, { valid_until: { gte: now } }] }],
      },
      orderBy: { priority: 'desc' },
    });

    // Post-filter: exclude rules that have hit their global usage cap.
    // (Prisma cannot compare two columns in where, so we do it in-process.)
    const eligibleRules = rules.filter((r) => {
      if (r.max_uses !== null && r.uses_count >= r.max_uses) return false;
      return true;
    });

    const matched: MatchedRule[] = [];

    for (const rule of eligibleRules) {
      const conditions = rule.conditions as unknown as RuleConditions;
      const rewards = rule.rewards as unknown as RewardAction[];

      if (!Array.isArray(rewards) || rewards.length === 0) {
        this.logger.warn(`Rule ${rule.id} has no reward actions — skipped`);
        continue;
      }

      if (this.conditionsMatch(conditions, ctx, rule.id)) {
        matched.push({ id: rule.id, name: rule.name, rewards });
      }
    }

    this.logger.log(
      `RuleEngine: ${matched.length}/${eligibleRules.length} rules matched for studio ${ctx.payload.studioId}`,
    );

    return matched;
  }

  // ── Private condition evaluators ─────────────────────────────────

  private conditionsMatch(
    conditions: RuleConditions,
    ctx: EvaluationContext,
    ruleId: string,
  ): boolean {
    const { payload, referredStudioCountry } = ctx;

    // plan_ids: empty/absent = any plan passes
    if (conditions.plan_ids?.length) {
      if (!conditions.plan_ids.includes(payload.planId)) {
        this.logger.debug(`Rule ${ruleId}: plan_ids mismatch (plan=${payload.planId})`);
        return false;
      }
    }

    // billing_cycles: empty/absent = any
    if (conditions.billing_cycles?.length) {
      if (!conditions.billing_cycles.includes(payload.billingCycle)) {
        this.logger.debug(`Rule ${ruleId}: billing_cycle mismatch (got=${payload.billingCycle})`);
        return false;
      }
    }

    // min_subscription_amount
    if (
      conditions.min_subscription_amount !== undefined &&
      conditions.min_subscription_amount > 0
    ) {
      if (payload.amountPaid < conditions.min_subscription_amount) {
        this.logger.debug(
          `Rule ${ruleId}: amount below minimum (paid=${payload.amountPaid}, min=${conditions.min_subscription_amount})`,
        );
        return false;
      }
    }

    // studio_countries: empty/absent = any country
    if (conditions.studio_countries?.length && referredStudioCountry) {
      if (!conditions.studio_countries.includes(referredStudioCountry.toUpperCase())) {
        this.logger.debug(`Rule ${ruleId}: country mismatch (country=${referredStudioCountry})`);
        return false;
      }
    }

    return true;
  }

  /**
   * Check if the referrer has already hit the per-referrer cap for a rule.
   * Called separately so the per-referrer count is accurate at reward time.
   */
  async checkPerReferrerCap(
    ruleId: string,
    referrerStudioId: string,
    maxAllowed: number,
  ): Promise<boolean> {
    const count = await this.prisma.rewardLog.count({
      where: {
        rule_id: ruleId,
        beneficiary_studio_id: referrerStudioId,
        status: 'applied',
      },
    });
    return count < maxAllowed;
  }
}
