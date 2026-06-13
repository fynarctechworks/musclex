import {
  Injectable,
  Logger,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { Prisma } from '../../node_modules/.prisma/client-public';
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

import { ReferralWalletService } from './referral-wallet.service';
import { SubscriptionPolicyService } from '../common/services/subscription-policy.service';

@Injectable()
export class RewardProcessorService {
  private readonly logger = new Logger(RewardProcessorService.name);

  constructor(
    private readonly pub: PublicPrismaService,
    private readonly ruleEngine: RuleEngineService,
    private readonly wallet: ReferralWalletService,
    private readonly subscriptionPolicy: SubscriptionPolicyService,
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
      const conditions = await this.pub.referralRewardRule.findUnique({
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
      case 'wallet_credit':
        return this.applyWalletCredit(params);
      default:
        this.logger.warn(`Unknown reward type: ${(rewardAction as RewardAction).type}`);
        return null;
    }
  }

  // ── wallet_credit ─────────────────────────────────────────────────

  private async applyWalletCredit(params: {
    referralId: string;
    rule: MatchedRule;
    rewardAction: RewardAction;
    referrerStudioId: string;
    payload: SubscriptionActivatedPayload;
    eventType: string;
    idempotencyKey: string;
  }): Promise<AppliedRewardSummary> {
    const { referralId, rule, rewardAction, referrerStudioId, payload, eventType, idempotencyKey } = params;
    const amount = rewardAction.amount ?? 0;
    const currency = rewardAction.currency ?? 'INR';

    if (amount <= 0) {
      throw new Error('wallet_credit requires positive amount');
    }

    const expiresAt = rewardAction.expires_in_days
      ? new Date(Date.now() + rewardAction.expires_in_days * 24 * 60 * 60 * 1000)
      : undefined;

    return this.pub.$transaction(
      async (tx) => {
        const existing = await tx.rewardLog.findUnique({
          where: { idempotency_key: idempotencyKey },
        });
        if (existing) throw new ConflictException('Reward already applied');

        const rewardValue = {
          amount,
          currency,
          expires_in_days: rewardAction.expires_in_days ?? null,
        };

        const log = await tx.rewardLog.create({
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
          data:  { uses_count: { increment: 1 } },
        });

        // Wallet credit happens AFTER the log row commits — we use a
        // distinct idempotency key for the ledger entry so a retry can
        // re-credit only if the ledger entry truly did not write.
        // The wallet service uses its own transaction.
        await this.wallet.credit({
          studioId:       referrerStudioId,
          amount,
          currency,
          sourceType:     'referral_reward',
          sourceId:       referralId,
          rewardLogId:    log.id,
          idempotencyKey: `wallet_${log.id}`,
          expiresAt,
          description:    `Referral reward: rule ${rule.name}`,
          metadata:       { rule_id: rule.id, referral_id: referralId },
        }).catch((err) => {
          this.logger.error(
            `wallet credit failed for log ${log.id}: ${(err as Error).message}`,
          );
          throw err;
        });

        this.logger.log(
          `✅ Wallet credit ${amount} ${currency} applied to studio ${referrerStudioId} [rule=${rule.id}]`,
        );

        return {
          ruleId:      rule.id,
          ruleName:    rule.name,
          rewardType:  rewardAction.type,
          rewardValue,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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

    const result = await this.pub.$transaction(
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
        // We extend BOTH subscription_expires_at (the referral-system field)
        // AND next_billing_date (the billing-engine field that SubscriptionPolicy
        // reads to compute lifecycle_status). Without the latter, the lock guard
        // and grace-period cron never see the reward — Shiva would still get
        // locked out tomorrow despite a +30d reward.
        //
        // Continuity is preserved: when the gym eventually renews, computeNextPeriod
        // uses the EXTENDED next_billing_date as the start of the next period, so
        // the bonus days aren't eaten by a future payment.
        const now = new Date();
        const currentExpiry =
          referrer.subscription_expires_at ?? referrer.next_billing_date ?? now;
        const baseDate = currentExpiry > now ? currentExpiry : now;
        const newExpiry = new Date(baseDate.getTime() + msToAdd);

        // next_billing_date moves forward by the SAME delta from its own base,
        // not snapped to newExpiry — so a gym whose billing date is independently
        // ahead of subscription_expires_at doesn't lose alignment.
        const currentBilling = referrer.next_billing_date ?? now;
        const billingBase = currentBilling > now ? currentBilling : now;
        const newBilling = new Date(billingBase.getTime() + msToAdd);

        // ── Update subscription expiry AND billing date ───────────
        await tx.$executeRaw`
          UPDATE public.studios
          SET subscription_expires_at = ${newExpiry},
              next_billing_date       = ${newBilling},
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
          `expiry ${currentExpiry.toISOString()} → ${newExpiry.toISOString()}, ` +
          `billing ${currentBilling.toISOString()} → ${newBilling.toISOString()} ` +
          `(+${days}d) [rule=${rule.id}]`,
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

    // ── Trigger lifecycle recompute OUTSIDE the serializable transaction.
    // This transitions grace_period → active when the reward pushes the
    // expiry back into the future, appends a SubscriptionEvent, invalidates
    // the policy cache, and lets connected clients unlock immediately.
    // Best-effort: a failure here doesn't invalidate the reward — the daily
    // cron will catch it on the next pass.
    this.subscriptionPolicy
      .recomputeForStudio(referrerStudioId)
      .catch((err) =>
        this.logger.warn(
          `recomputeForStudio failed after reward for ${referrerStudioId}: ${(err as Error).message}`,
        ),
      );

    return result;
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

    return this.pub.$transaction(async (tx) => {
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

    return this.pub.$transaction(
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

  // ── Reward reversal (clawback) ────────────────────────────────────

  /**
   * Reverse a single applied reward — the inverse of applyRewardAction.
   *
   *   extend_subscription / trial_extension → subtract the granted days from
   *     the beneficiary's expiry/trial (never below `now`, so we don't yank
   *     access the studio legitimately still has from its OWN payments).
   *   wallet_credit → write a reversal ledger entry (handles already-spent
   *     credit via the wallet service's own balance rules).
   *   account_credit → mark the log reversed; billing reconciles manually.
   *
   * Idempotent: a log already `reversed` is skipped. Runs in a serializable
   * transaction with a row lock on the studio, mirroring the apply path.
   */
  async reverseReward(params: {
    rewardLog: {
      id: string;
      referral_id: string;
      beneficiary_studio_id: string;
      reward_type: string;
      reward_value: Prisma.JsonValue;
      status: string;
      subscription_extended_from: Date | null;
      subscription_extended_to: Date | null;
    };
    reason: string;
  }): Promise<void> {
    const { rewardLog, reason } = params;

    if (rewardLog.status === 'reversed') {
      this.logger.debug(`Reward log ${rewardLog.id} already reversed — skip`);
      return;
    }

    const rewardValue = (rewardLog.reward_value ?? {}) as { days?: number; amount?: number; currency?: string };

    if (rewardLog.reward_type === 'extend_subscription' || rewardLog.reward_type === 'trial_extension') {
      const days = rewardValue.days ?? 0;
      const msToRemove = days * 24 * 60 * 60 * 1000;
      // extend_subscription affects BOTH expiry + billing (the apply path
      // moves both together, so clawback must too — otherwise an "extended"
      // gym keeps an undeserved-future next_billing_date after refund).
      // trial_extension only touches trial_ends_at.
      const isExtendSub = rewardLog.reward_type === 'extend_subscription';

      await this.pub.$transaction(
        async (tx) => {
          const [studio] = await tx.$queryRaw<
            Array<{
              subscription_expires_at: Date | null;
              next_billing_date: Date | null;
              trial_ends_at: Date | null;
            }>
          >`
            SELECT subscription_expires_at, next_billing_date, trial_ends_at
            FROM public.studios
            WHERE id = ${rewardLog.beneficiary_studio_id}::uuid
            FOR UPDATE
          `;

          const now = new Date();

          // Helper: subtract days, clamped to never below `now` — the
          // studio may have legitimately extended its own subscription since.
          const pull = (current: Date | null): Date => {
            const c = current ?? now;
            const reverted = new Date(c.getTime() - msToRemove);
            return reverted.getTime() < now.getTime() ? now : reverted;
          };

          if (isExtendSub) {
            const newExpiry = pull(studio?.subscription_expires_at ?? null);
            const newBilling = pull(studio?.next_billing_date ?? null);
            await tx.$executeRaw`
              UPDATE public.studios
              SET subscription_expires_at = ${newExpiry},
                  next_billing_date       = ${newBilling},
                  updated_at              = NOW()
              WHERE id = ${rewardLog.beneficiary_studio_id}::uuid
            `;
            this.logger.warn(
              `↩️  extend_subscription reversed for studio ${rewardLog.beneficiary_studio_id}: ` +
              `expiry ${(studio?.subscription_expires_at ?? now).toISOString()} → ${newExpiry.toISOString()}, ` +
              `billing ${(studio?.next_billing_date ?? now).toISOString()} → ${newBilling.toISOString()} ` +
              `(−${days}d) [log=${rewardLog.id}]`,
            );
          } else {
            const newTrial = pull(studio?.trial_ends_at ?? null);
            await tx.$executeRaw`
              UPDATE public.studios
              SET trial_ends_at = ${newTrial}, updated_at = NOW()
              WHERE id = ${rewardLog.beneficiary_studio_id}::uuid
            `;
            this.logger.warn(
              `↩️  trial_extension reversed for studio ${rewardLog.beneficiary_studio_id}: ` +
              `${(studio?.trial_ends_at ?? now).toISOString()} → ${newTrial.toISOString()} ` +
              `(−${days}d) [log=${rewardLog.id}]`,
            );
          }

          await tx.rewardLog.update({
            where: { id: rewardLog.id },
            data:  { status: 'reversed', reversed_at: now, reversed_reason: reason },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      // Recompute lifecycle outside the serializable transaction. A clawback
      // can flip an undeserved-active gym back to grace_period/locked when its
      // pulled-back next_billing_date drops into the past.
      if (isExtendSub) {
        this.subscriptionPolicy
          .recomputeForStudio(rewardLog.beneficiary_studio_id)
          .catch((err) =>
            this.logger.warn(
              `recomputeForStudio failed after clawback for ${rewardLog.beneficiary_studio_id}: ${(err as Error).message}`,
            ),
          );
      }
      return;
    }

    if (rewardLog.reward_type === 'wallet_credit') {
      const ledgerEntry = await this.pub.referralWalletEntry.findFirst({
        where: { reward_log_id: rewardLog.id, entry_type: 'credit' },
      });
      if (ledgerEntry) {
        await this.wallet.reverse({
          originalEntryId: ledgerEntry.id,
          reason,
          idempotencyKey:  `clawback_${rewardLog.id}`,
        });
      }
      await this.pub.rewardLog.update({
        where: { id: rewardLog.id },
        data:  { status: 'reversed', reversed_at: new Date(), reversed_reason: reason },
      });
      this.logger.warn(`↩️  wallet_credit reversed [log=${rewardLog.id}]`);
      return;
    }

    // account_credit and anything else: mark reversed; billing reconciles.
    await this.pub.rewardLog.update({
      where: { id: rewardLog.id },
      data:  { status: 'reversed', reversed_at: new Date(), reversed_reason: reason },
    });
    this.logger.warn(`↩️  ${rewardLog.reward_type} marked reversed [log=${rewardLog.id}]`);
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
    await this.pub.rewardLog.create({
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
