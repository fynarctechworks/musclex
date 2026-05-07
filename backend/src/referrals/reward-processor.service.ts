import {
  Injectable,
  Logger,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { RuleEngineService, MatchedRule, RewardAction } from './rule-engine.service';
import { SubscriptionActivatedPayload } from './events/domain-events';

export interface ProcessRewardsInput {
  referralId: string;
  referrerStudioId: string;
  matchedRules: MatchedRule[];
  payload: SubscriptionActivatedPayload;
  eventType: string;
}

export interface AppliedRewardSummary {
  ruleId: string;
  ruleName: string;
  rewardType: string;
  rewardValue: Record<string, unknown>;
  subscriptionExtendedTo?: Date;
}

@Injectable()
export class RewardProcessorService {
  private readonly logger = new Logger(RewardProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: RuleEngineService,
  ) {}

  /**
   * Apply all matched reward rules for a referral event.
   * Each rule → each reward action is applied atomically inside a single
   * serializable transaction to handle concurrent updates safely.
   *
   * Idempotency: `referral_{refId}_rule_{ruleId}_event_{idempotencyKey}`
   * ensures the same event cannot grant the same rule twice.
   */
  async processRewards(input: ProcessRewardsInput): Promise<AppliedRewardSummary[]> {
    const { referralId, referrerStudioId, matchedRules, payload, eventType } = input;
    const applied: AppliedRewardSummary[] = [];

    for (const rule of matchedRules) {
      // ── Per-referrer cap check ──────────────────────────────────
      const conditions = await this.prisma.referralRewardRule.findUnique({
        where: { id: rule.id },
        select: { conditions: true },
      });
      const conds = (conditions?.conditions as { max_referrals_per_referrer?: number }) ?? {};

      if (conds.max_referrals_per_referrer) {
        const withinCap = await this.ruleEngine.checkPerReferrerCap(
          rule.id,
          referrerStudioId,
          conds.max_referrals_per_referrer,
        );
        if (!withinCap) {
          this.logger.warn(
            `Referrer ${referrerStudioId} hit per-referrer cap on rule ${rule.id} — skipping`,
          );
          continue;
        }
      }

      for (const rewardAction of rule.rewards) {
        const idempotencyKey = `referral_${referralId}_rule_${rule.id}_action_${rewardAction.type}_event_${payload.idempotencyKey}`;

        try {
          const summary = await this.applyRewardAction({
            referralId,
            rule,
            rewardAction,
            referrerStudioId,
            payload,
            eventType,
            idempotencyKey,
          });

          if (summary) {
            applied.push(summary);
          }
        } catch (err) {
          if (err instanceof ConflictException) {
            this.logger.warn(`Duplicate reward skipped: ${idempotencyKey}`);
          } else {
            this.logger.error(`Failed to apply reward ${idempotencyKey}: ${err.message}`, err.stack);
            // Log failure but continue processing remaining rules
            await this.logFailure({
              referralId,
              rule,
              rewardAction,
              referrerStudioId,
              payload,
              eventType,
              idempotencyKey: `${idempotencyKey}_fail_${Date.now()}`,
              reason: err.message,
            }).catch(() => null);
          }
        }
      }
    }

    return applied;
  }

  // ── Core reward dispatcher ────────────────────────────────────────

  private async applyRewardAction(params: {
    referralId: string;
    rule: MatchedRule;
    rewardAction: RewardAction;
    referrerStudioId: string;
    payload: SubscriptionActivatedPayload;
    eventType: string;
    idempotencyKey: string;
  }): Promise<AppliedRewardSummary | null> {
    const { rewardAction } = params;

    switch (rewardAction.type) {
      case 'extend_subscription':
        return this.applySubscriptionExtension(params);
      case 'account_credit':
        return this.applyAccountCredit(params);
      case 'trial_extension':
        return this.applyTrialExtension(params);
      default:
        this.logger.warn(`Unknown reward type: ${(rewardAction as RewardAction).type}`);
        return null;
    }
  }

  // ── extend_subscription ───────────────────────────────────────────

  private async applySubscriptionExtension(params: {
    referralId: string;
    rule: MatchedRule;
    rewardAction: RewardAction;
    referrerStudioId: string;
    payload: SubscriptionActivatedPayload;
    eventType: string;
    idempotencyKey: string;
  }): Promise<AppliedRewardSummary> {
    const { referralId, rule, rewardAction, referrerStudioId, payload, eventType, idempotencyKey } =
      params;
    const days = rewardAction.days ?? 30;
    const msToAdd = days * 24 * 60 * 60 * 1000;

    return this.prisma.$transaction(
      async (tx) => {
        // ── Idempotency guard (unique constraint on reward_logs) ──
        const existing = await tx.rewardLog.findUnique({
          where: { idempotency_key: idempotencyKey },
        });
        if (existing) throw new ConflictException('Reward already applied');

        // ── Fetch referrer studio with a row-level lock ───────────
        const [referrer] = await tx.$queryRaw<
          Array<{
            id: string;
            subscription_expires_at: Date | null;
            next_billing_date: Date | null;
          }>
        >`
          SELECT id, subscription_expires_at, next_billing_date
          FROM public.studios
          WHERE id = ${referrerStudioId}::uuid
          FOR UPDATE
        `;

        if (!referrer) throw new InternalServerErrorException('Referrer studio not found');

        // ── Safe extension: max(current_expiry, now) + days ───────
        const now = new Date();
        const currentExpiry =
          referrer.subscription_expires_at ?? referrer.next_billing_date ?? now;
        const baseDate = currentExpiry > now ? currentExpiry : now;
        const newExpiry = new Date(baseDate.getTime() + msToAdd);

        // ── Update subscription expiry ────────────────────────────
        await tx.$executeRaw`
          UPDATE public.studios
          SET subscription_expires_at = ${newExpiry},
              updated_at              = NOW()
          WHERE id = ${referrerStudioId}::uuid
        `;

        // ── Write audit log ───────────────────────────────────────
        const rewardValue = { days } as Record<string, unknown>;
        await tx.rewardLog.create({
          data: {
            referral_id:               referralId,
            rule_id:                   rule.id,
            beneficiary_studio_id:     referrerStudioId,
            event_type:                eventType,
            event_payload:             payload as unknown as Prisma.InputJsonValue,
            reward_type:               rewardAction.type,
            reward_value:              rewardValue as Prisma.InputJsonValue,
            idempotency_key:           idempotencyKey,
            status:                    'applied',
            subscription_extended_from: currentExpiry,
            subscription_extended_to:  newExpiry,
          },
        });

        // ── Increment rule usage counter ──────────────────────────
        await tx.referralRewardRule.update({
          where: { id: rule.id },
          data: { uses_count: { increment: 1 } },
        });

        this.logger.log(
          `✅ Subscription extended for studio ${referrerStudioId}: ` +
          `${currentExpiry.toISOString()} → ${newExpiry.toISOString()} (+${days}d) [rule=${rule.id}]`,
        );

        return {
          ruleId: rule.id,
          ruleName: rule.name,
          rewardType: rewardAction.type,
          rewardValue: { days },
          subscriptionExtendedTo: newExpiry,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ── account_credit ────────────────────────────────────────────────

  private async applyAccountCredit(params: {
    referralId: string;
    rule: MatchedRule;
    rewardAction: RewardAction;
    referrerStudioId: string;
    payload: SubscriptionActivatedPayload;
    eventType: string;
    idempotencyKey: string;
  }): Promise<AppliedRewardSummary> {
    const { referralId, rule, rewardAction, referrerStudioId, payload, eventType, idempotencyKey } =
      params;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.rewardLog.findUnique({
        where: { idempotency_key: idempotencyKey },
      });
      if (existing) throw new ConflictException('Reward already applied');

      const rewardValue = {
        amount:   rewardAction.amount,
        currency: rewardAction.currency,
      };

      // ── Future: insert into account_credits table here ────────────
      // For now we log the intent and the billing team can reconcile.

      await tx.rewardLog.create({
        data: {
          referral_id:           referralId,
          rule_id:               rule.id,
          beneficiary_studio_id: referrerStudioId,
          event_type:            eventType,
          event_payload:         payload as unknown as Prisma.InputJsonValue,
          reward_type:           rewardAction.type,
          reward_value:          rewardValue as Prisma.InputJsonValue,
          idempotency_key:       idempotencyKey,
          status:                'applied',
        },
      });

      await tx.referralRewardRule.update({
        where: { id: rule.id },
        data: { uses_count: { increment: 1 } },
      });

      this.logger.log(
        `✅ Account credit queued for studio ${referrerStudioId}: ` +
        `${rewardAction.amount} ${rewardAction.currency} [rule=${rule.id}]`,
      );

      return {
        ruleId:      rule.id,
        ruleName:    rule.name,
        rewardType:  rewardAction.type,
        rewardValue: rewardValue as Record<string, unknown>,
      };
    });
  }

  // ── trial_extension ───────────────────────────────────────────────

  private async applyTrialExtension(params: {
    referralId: string;
    rule: MatchedRule;
    rewardAction: RewardAction;
    referrerStudioId: string;
    payload: SubscriptionActivatedPayload;
    eventType: string;
    idempotencyKey: string;
  }): Promise<AppliedRewardSummary> {
    const { referralId, rule, rewardAction, referrerStudioId, payload, eventType, idempotencyKey } =
      params;
    const days = rewardAction.days ?? 7;
    const msToAdd = days * 24 * 60 * 60 * 1000;

    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.rewardLog.findUnique({
          where: { idempotency_key: idempotencyKey },
        });
        if (existing) throw new ConflictException('Reward already applied');

        const [referrer] = await tx.$queryRaw<Array<{ trial_ends_at: Date | null }>>`
          SELECT trial_ends_at FROM public.studios
          WHERE id = ${referrerStudioId}::uuid
          FOR UPDATE
        `;

        const now = new Date();
        const currentTrial = referrer?.trial_ends_at ?? now;
        const base = currentTrial > now ? currentTrial : now;
        const newTrialEnd = new Date(base.getTime() + msToAdd);

        await tx.$executeRaw`
          UPDATE public.studios
          SET trial_ends_at = ${newTrialEnd}, updated_at = NOW()
          WHERE id = ${referrerStudioId}::uuid
        `;

        const rewardValue = { days };

        await tx.rewardLog.create({
          data: {
            referral_id:               referralId,
            rule_id:                   rule.id,
            beneficiary_studio_id:     referrerStudioId,
            event_type:                eventType,
            event_payload:             payload as unknown as Prisma.InputJsonValue,
            reward_type:               rewardAction.type,
            reward_value:              rewardValue as Prisma.InputJsonValue,
            idempotency_key:           idempotencyKey,
            status:                    'applied',
            subscription_extended_from: currentTrial,
            subscription_extended_to:  newTrialEnd,
          },
        });

        await tx.referralRewardRule.update({
          where: { id: rule.id },
          data: { uses_count: { increment: 1 } },
        });

        return {
          ruleId:      rule.id,
          ruleName:    rule.name,
          rewardType:  rewardAction.type,
          rewardValue: rewardValue as Record<string, unknown>,
          subscriptionExtendedTo: newTrialEnd,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ── Failure logger ────────────────────────────────────────────────

  private async logFailure(params: {
    referralId: string;
    rule: MatchedRule;
    rewardAction: RewardAction;
    referrerStudioId: string;
    payload: SubscriptionActivatedPayload;
    eventType: string;
    idempotencyKey: string;
    reason: string;
  }) {
    await this.prisma.rewardLog.create({
      data: {
        referral_id:           params.referralId,
        rule_id:               params.rule.id,
        beneficiary_studio_id: params.referrerStudioId,
        event_type:            params.eventType,
        event_payload:         params.payload as unknown as Prisma.InputJsonValue,
        reward_type:           params.rewardAction.type,
        reward_value:          {} as Prisma.InputJsonValue,
        idempotency_key:       params.idempotencyKey,
        status:                'failed',
        failure_reason:        params.reason,
      },
    });
  }
}
