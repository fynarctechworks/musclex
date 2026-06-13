import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { Prisma } from '../../node_modules/.prisma/client-public';
import {
  REFERRAL_EVENTS,
  SubscriptionActivatedPayload,
  SubscriptionRefundedPayload,
  TrialCompletedPayload,
} from './events/domain-events';
import { RuleEngineService, EvaluationContext } from './rule-engine.service';
import { RewardProcessorService } from './reward-processor.service';
import { ReferralLifecycleService } from './referral-lifecycle.service';
import { ReferralFraudService } from './referral-fraud.service';
import { CreateReferralDto } from './dto/create-referral.dto';
import { ProcessSubscriptionEventDto } from './dto/process-event.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly pub: PublicPrismaService,
    private readonly ruleEngine: RuleEngineService,
    private readonly rewardProcessor: RewardProcessorService,
    private readonly lifecycle: ReferralLifecycleService,
    private readonly fraud: ReferralFraudService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Code Generation ────────────────────────────────────────────────

  /**
   * Generate a unique 6-char uppercase alphanumeric referral code.
   * Retries up to 5 times in the extremely unlikely event of a collision.
   */
  async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomBytes(4)
        .toString('base64')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6)
        .padEnd(6, '0');

      const exists = await this.pub.studio.findUnique({
        where: { referral_code: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    throw new InternalServerErrorException('Could not generate unique referral code');
  }

  // ── Code Validation ────────────────────────────────────────────────

  /**
   * Public endpoint: validate a referral code before or during onboarding.
   * Returns minimal info — never leaks the referrer's business data.
   */
  async validateCode(code: string): Promise<{
    valid: boolean;
    referrer_name?: string;
    message?: string;
  }> {
    const studio = await this.pub.studio.findUnique({
      where: { referral_code: code },
      select: { id: true, name: true },
    });

    if (!studio) {
      return { valid: false, message: 'Invalid referral code' };
    }

    return { valid: true, referrer_name: studio.name };
  }

  // ── Referral Creation ──────────────────────────────────────────────

  /**
   * Called during onboarding step when the referred gym enters the code.
   * The referred_studio_id will be set later once signup completes.
   *
   * @param referredStudioId   The studio that is signing up (the referred gym)
   * @param dto                Contains referral_code + optional email
   */
  async createReferral(
    referredStudioId: string,
    dto: CreateReferralDto,
  ): Promise<{ referral_id: string }> {
    const code = dto.referral_code.toUpperCase();

    // ── Find the referrer ──────────────────────────────────────────
    const referrerStudio = await this.pub.studio.findUnique({
      where: { referral_code: code },
      select: { id: true, name: true },
    });
    if (!referrerStudio) throw new NotFoundException('Invalid referral code');

    // ── Self-referral guard ────────────────────────────────────────
    if (referrerStudio.id === referredStudioId) {
      throw new BadRequestException('You cannot refer yourself');
    }

    // ── Duplicate referral guard ───────────────────────────────────
    const existingReferral = await this.pub.referral.findUnique({
      where: { referred_studio_id: referredStudioId },
    });
    if (existingReferral) {
      throw new ConflictException('This studio has already been referred');
    }

    // ── Duplicate email guard (same email used with same code) ─────
    if (dto.referred_email) {
      const emailConflict = await this.pub.referral.findFirst({
        where: {
          referral_code: code,
          referred_email: dto.referred_email.toLowerCase(),
          status: { not: 'fraud' },
        },
      });
      if (emailConflict) {
        this.logger.warn(
          `Potential fraud: email ${dto.referred_email} reused with code ${code}`,
        );
        throw new ConflictException('This email has already been used with this referral code');
      }
    }

    const referral = await this.pub.referral.create({
      data: {
        referrer_studio_id: referrerStudio.id,
        referred_studio_id: referredStudioId,
        referral_code:      code,
        referred_email:     dto.referred_email?.toLowerCase() ?? null,
        status:             'pending',
      },
    });

    // Also stamp the referred_by_code on the studio for immutable audit
    await this.pub.studio.update({
      where: { id: referredStudioId },
      data: { referred_by_code: code },
    });

    // Initial lifecycle audit (pending is the starting state — write the
    // creation event so the history is complete from t=0).
    await this.pub.referralLifecycleEvent.create({
      data: {
        referral_id: referral.id,
        from_status: null,
        to_status:   'pending',
        actor_type:  'system',
        payload:     { source: 'createReferral' },
      },
    });

    // Fire-and-forget fraud signal collection.
    // If signals push risk above FRAUD_THRESHOLD we eagerly flip to 'fraud'.
    this.fraud.collectSignals({
      referralId:       referral.id,
      referrerStudioId: referrerStudio.id,
      referredStudioId: referredStudioId,
      referredEmail:    dto.referred_email,
    })
      .then((score) => {
        if (this.fraud.shouldMarkFraud(score)) {
          return this.lifecycle.transition({
            referralId: referral.id,
            toStatus:   'fraud',
            actorType:  'system',
            payload:    { reason: 'auto_fraud_threshold', risk_score: score },
          });
        }
      })
      .catch((err) => {
        this.logger.error(`Fraud collection failed for ${referral.id}: ${err.message}`);
      });

    this.logger.log(
      `Referral created: ${referral.id} (referrer=${referrerStudio.id}, referred=${referredStudioId})`,
    );

    return { referral_id: referral.id };
  }

  // ── Subscription Event Processing ─────────────────────────────────

  /**
   * Entry point for external callers (payment webhooks, platform billing).
   * Emits the domain event — actual reward processing happens in the listener.
   */
  async processSubscriptionActivated(dto: ProcessSubscriptionEventDto): Promise<void> {
    const payload: SubscriptionActivatedPayload = {
      studioId:       dto.studio_id,
      planId:         dto.plan_id,
      planName:       dto.plan_id, // resolved in listener if needed
      billingCycle:   dto.billing_cycle,
      amountPaid:     dto.amount_paid,
      currency:       dto.currency,
      idempotencyKey: dto.idempotency_key,
      activatedAt:    dto.activated_at ? new Date(dto.activated_at) : new Date(),
    };

    this.eventEmitter.emit(REFERRAL_EVENTS.SUBSCRIPTION_ACTIVATED, payload);
  }

  /**
   * Stage 1 of 2 in the reward pipeline: the referred gym just made their
   * first verified payment (during trial). We RECORD the milestone but do
   * NOT credit the reward yet — that waits for TRIAL_COMPLETED.
   *
   * Why split? In a $0-trial model, a payment-method-on-file is captured at
   * onboarding but the gym can still trial-cancel for 14 days. If we credited
   * the reward here, a fraud loop could: refer fake gym → fake gym signs up
   * + adds card → reward credits → fake gym cancels in trial → real money
   * was never collected → referrer banked free days for nothing.
   *
   * By stopping at `payment_verified`, we get a clean audit trail of the
   * referred gym's commitment without exposing the reward to trial-cancel.
   */
  async handleSubscriptionActivated(
    payload: SubscriptionActivatedPayload,
  ): Promise<void> {
    const { studioId, idempotencyKey } = payload;

    // ── Find a pending referral for this studio ────────────────────
    const referral = await this.pub.referral.findUnique({
      where: { referred_studio_id: studioId },
      select: { id: true, status: true },
    });

    if (!referral) {
      this.logger.debug(`No referral found for studio ${studioId} — nothing to record`);
      return;
    }

    if (referral.status === 'rewarded' || referral.status === 'payment_verified') {
      this.logger.debug(
        `Referral ${referral.id} already at ${referral.status} — activation no-op`,
      );
      return;
    }

    if (referral.status === 'fraud' || referral.status === 'reversed' || referral.status === 'expired') {
      this.logger.warn(`Referral ${referral.id} is ${referral.status} — skipping`);
      return;
    }

    // Advance lifecycle to `payment_verified` and stop.
    // The cron will later detect trial completion and fire TRIAL_COMPLETED to
    // run the actual reward credit (see handleTrialCompleted).
    await this.lifecycle.transition({
      referralId: referral.id,
      toStatus:   'subscribed',
      actorType:  'webhook',
      payload:    { idempotency_key: idempotencyKey },
    });
    await this.lifecycle.transition({
      referralId: referral.id,
      toStatus:   'payment_verified',
      actorType:  'webhook',
      payload:    { idempotency_key: idempotencyKey, awaiting: 'trial_completion' },
    });

    this.logger.log(
      `Referral ${referral.id} marked payment_verified — reward deferred until trial completes`,
    );
  }

  /**
   * Stage 2 of 2: the referred gym's trial period ended while they're still
   * on a paid plan (they didn't cancel during trial). NOW we credit the
   * referrer's reward — runs the same fraud re-check + rule engine + reward
   * application that previously ran on activation.
   *
   * Emitted by SubscriptionCron once per studio per trial_ends_at.
   */
  async handleTrialCompleted(payload: TrialCompletedPayload): Promise<void> {
    const { studioId, idempotencyKey } = payload;

    const referral = await this.pub.referral.findUnique({
      where: { referred_studio_id: studioId },
      include: {
        referrer_studio: { select: { id: true, country: true } },
        referred_studio: { select: { id: true, country: true } },
      },
    });

    if (!referral) {
      this.logger.debug(`No referral found for studio ${studioId} on trial completion`);
      return;
    }

    if (referral.status === 'rewarded') {
      this.logger.debug(`Referral ${referral.id} already rewarded — idempotency skip`);
      return;
    }

    if (referral.status === 'fraud' || referral.status === 'reversed' || referral.status === 'expired') {
      this.logger.warn(`Referral ${referral.id} is ${referral.status} — skipping`);
      return;
    }

    // Trial completion is the canonical "the referred gym is for real" signal.
    // If we never saw activation (e.g. payment event was missed), advance the
    // FSM through it now so the audit trail is complete.
    if (referral.status !== 'payment_verified' && referral.status !== 'reward_pending') {
      await this.lifecycle.transition({
        referralId: referral.id,
        toStatus:   'subscribed',
        actorType:  'system',
        payload:    { source: 'trial_completed', recovery: true },
      });
      await this.lifecycle.transition({
        referralId: referral.id,
        toStatus:   'payment_verified',
        actorType:  'system',
        payload:    { source: 'trial_completed', recovery: true },
      });
    }

    // ── Re-collect fraud signals at reward time ────────────────────
    const riskScore = await this.fraud.collectSignals({
      referralId:       referral.id,
      referrerStudioId: referral.referrer_studio_id,
      referredStudioId: referral.referred_studio_id,
      referredEmail:    null,
    });

    if (this.fraud.shouldMarkFraud(riskScore)) {
      await this.lifecycle.transition({
        referralId: referral.id,
        toStatus:   'fraud',
        actorType:  'system',
        payload:    { reason: 'auto_fraud_threshold_at_reward', risk_score: riskScore },
      });
      this.logger.warn(`Referral ${referral.id} auto-flagged fraud at trial completion (score=${riskScore})`);
      return;
    }

    if (this.fraud.shouldHoldForReview(riskScore)) {
      this.logger.warn(
        `Referral ${referral.id} held for manual review (score=${riskScore}) — reward NOT applied`,
      );
      return;
    }

    await this.lifecycle.transition({
      referralId: referral.id,
      toStatus:   'reward_pending',
      actorType:  'system',
    });

    // ── Idempotency stamp ─────────────────────────────────────────
    const referralIdempotencyKey = `reward_${referral.id}_${idempotencyKey}`;
    const updated = await this.pub.referral.updateMany({
      where: {
        id:              referral.id,
        idempotency_key: null,
      },
      data: { idempotency_key: referralIdempotencyKey },
    });

    if (updated.count === 0) {
      this.logger.warn(
        `Referral ${referral.id} idempotency stamp already set — replay skip`,
      );
      return;
    }

    // ── Evaluate rules ─────────────────────────────────────────────
    // The reward processor expects a SubscriptionActivatedPayload shape. The
    // TrialCompletedPayload is structurally compatible (same fields except
    // activatedAt is named trialEndedAt) — we adapt for the call.
    const rewardPayload: SubscriptionActivatedPayload = {
      studioId:       payload.studioId,
      planId:         payload.planId,
      planName:       payload.planName,
      billingCycle:   payload.billingCycle,
      amountPaid:     payload.amountPaid,
      currency:       payload.currency,
      idempotencyKey: payload.idempotencyKey,
      activatedAt:    payload.trialEndedAt,
    };

    const ctx: EvaluationContext = {
      referrerStudioId:     referral.referrer_studio_id,
      referredStudioCountry: referral.referred_studio?.country ?? null,
      payload: rewardPayload,
    };

    const matchedRules = await this.ruleEngine.evaluate(ctx);

    if (matchedRules.length === 0) {
      this.logger.log(
        `Referral ${referral.id}: no rules matched on trial completion — no reward`,
      );
      return;
    }

    const results = await this.rewardProcessor.processRewards({
      referralId:        referral.id,
      referrerStudioId:  referral.referrer_studio_id,
      matchedRules,
      payload: rewardPayload,
      eventType:         REFERRAL_EVENTS.TRIAL_COMPLETED,
    });

    if (results.length > 0) {
      await this.lifecycle.transition({
        referralId: referral.id,
        toStatus:   'rewarded',
        actorType:  'system',
        payload:    { reward_count: results.length, trigger: 'trial_completed' },
      });
      await this.pub.referral.update({
        where: { id: referral.id },
        data:  { rewarded_at: new Date() },
      });

      this.logger.log(
        `🎉 Referral ${referral.id} rewarded on trial completion: ${results.length} reward(s) applied to studio ${referral.referrer_studio_id}`,
      );
    }
  }

  // ── Subscription Refund / Cancellation (clawback) ─────────────────

  /**
   * Core clawback handler — called by the event listener when a referred
   * studio cancels or is refunded AFTER its referrer was already rewarded.
   *
   * Fraud scenario this closes: gym A refers gym B; B pays (reward fires,
   * A gets +30 days); B then cancels/refunds. Without clawback, A keeps the
   * stolen days forever. This reverses the extension and the reward logs.
   *
   * Idempotent: a referral already in `reversed` is a no-op. Reward logs are
   * matched by `status: 'applied'` so a replayed refund can't double-reverse.
   */
  async handleSubscriptionRefunded(payload: SubscriptionRefundedPayload): Promise<void> {
    const { studioId, refundReason } = payload;

    // The refunded studio is the REFERRED gym. Find its referral.
    const referral = await this.pub.referral.findUnique({
      where: { referred_studio_id: studioId },
      select: { id: true, status: true, referrer_studio_id: true },
    });

    if (!referral) {
      this.logger.debug(`Refund for studio ${studioId}: no referral — nothing to claw back`);
      return;
    }

    if (referral.status === 'reversed') {
      this.logger.debug(`Referral ${referral.id} already reversed — idempotency skip`);
      return;
    }

    // Only a rewarded referral has anything to claw back. If the referred gym
    // cancels BEFORE the reward fired (e.g. never paid), just mark it reversed
    // so the pending reward can never land later.
    if (referral.status !== 'rewarded') {
      const moved = await this.lifecycle.transition({
        referralId: referral.id,
        toStatus:   'reversed',
        actorType:  'system',
        payload:    { reason: 'referred_studio_cancelled_before_reward', detail: refundReason },
      });
      this.logger.warn(
        `Referral ${referral.id} (${referral.status}) reversed pre-reward on refund` +
        (moved ? '' : ' — transition refused (terminal state)'),
      );
      return;
    }

    // ── Reverse every applied reward on this referral ────────────────
    const appliedLogs = await this.pub.rewardLog.findMany({
      where: { referral_id: referral.id, status: 'applied' },
    });

    for (const log of appliedLogs) {
      try {
        await this.rewardProcessor.reverseReward({
          rewardLog: log,
          reason:    `Referred studio refunded/cancelled: ${refundReason}`,
        });
      } catch (err) {
        this.logger.error(
          `Failed to reverse reward log ${log.id} for referral ${referral.id}: ${(err as Error).message}`,
        );
      }
    }

    // ── Transition the referral itself to reversed ───────────────────
    await this.lifecycle.transition({
      referralId: referral.id,
      toStatus:   'reversed',
      actorType:  'system',
      payload:    { reason: 'referred_studio_refunded', detail: refundReason, logs_reversed: appliedLogs.length },
    });

    this.logger.warn(
      `↩️  Referral ${referral.id} clawed back: ${appliedLogs.length} reward(s) reversed ` +
      `for referrer ${referral.referrer_studio_id} (referred studio ${studioId} refunded)`,
    );
  }

  // ── Stats (for the API response) ──────────────────────────────────

  async getReferralStats(studioId: string) {
    const [
      totalReferrals,
      pendingReferrals,
      rewardedReferrals,
      rewardLogs,
      myCode,
    ] = await Promise.all([
      this.pub.referral.count({ where: { referrer_studio_id: studioId } }),
      this.pub.referral.count({ where: { referrer_studio_id: studioId, status: 'pending' } }),
      this.pub.referral.count({ where: { referrer_studio_id: studioId, status: 'rewarded' } }),
      this.pub.rewardLog.findMany({
        where:   { beneficiary_studio_id: studioId, status: 'applied' },
        orderBy: { applied_at: 'desc' },
        take:    10,
        select:  {
          reward_type:               true,
          reward_value:              true,
          applied_at:                true,
          subscription_extended_from: true,
          subscription_extended_to:  true,
          referral: { select: { referred_studio: { select: { name: true } } } },
        },
      }),
      this.pub.studio.findUnique({
        where:  { id: studioId },
        select: {
          referral_code:           true,
          subscription_expires_at: true,
          next_billing_date:       true,
        },
      }),
    ]);

    // Auto-generate referral code if the studio doesn't have one yet
    let referralCode = myCode?.referral_code;
    if (!referralCode) {
      referralCode = await this.generateUniqueCode();
      await this.pub.studio.update({
        where: { id: studioId },
        data:  { referral_code: referralCode },
      });
    }

    return {
      referral_code:       referralCode,
      subscription_expires_at: myCode?.subscription_expires_at ?? myCode?.next_billing_date,
      stats: {
        total:    totalReferrals,
        pending:  pendingReferrals,
        rewarded: rewardedReferrals,
      },
      recent_rewards: rewardLogs.map((log: any) => ({
        reward_type:  log.reward_type,
        reward_value: log.reward_value,
        applied_at:   log.applied_at,
        extended_to:  log.subscription_extended_to,
        referred_gym: log.referral?.referred_studio?.name ?? 'Unknown',
      })),
    };
  }

  // ── Admin helpers ──────────────────────────────────────────────────

  async listReferrals(filters: {
    status?: string;
    referrerStudioId?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, referrerStudioId, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...(status && { status }),
      ...(referrerStudioId && { referrer_studio_id: referrerStudioId }),
    };

    const [data, total] = await Promise.all([
      this.pub.referral.findMany({
        where: where as any,
        skip,
        take:    limit,
        orderBy: { created_at: 'desc' },
        include: {
          referrer_studio: { select: { id: true, name: true, referral_code: true } },
          referred_studio: { select: { id: true, name: true } },
          reward_logs:     { select: { reward_type: true, reward_value: true, applied_at: true } },
        },
      }),
      this.pub.referral.count({ where: where as any }),
    ]);

    return {
      data,
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }
}
