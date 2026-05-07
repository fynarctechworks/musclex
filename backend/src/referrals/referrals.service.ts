import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  REFERRAL_EVENTS,
  SubscriptionActivatedPayload,
} from './events/domain-events';
import { RuleEngineService, EvaluationContext } from './rule-engine.service';
import { RewardProcessorService } from './reward-processor.service';
import { CreateReferralDto } from './dto/create-referral.dto';
import { ProcessSubscriptionEventDto } from './dto/process-event.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: RuleEngineService,
    private readonly rewardProcessor: RewardProcessorService,
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

      const exists = await this.prisma.studio.findUnique({
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
    const studio = await this.prisma.studio.findUnique({
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
    const referrerStudio = await this.prisma.studio.findUnique({
      where: { referral_code: code },
      select: { id: true, name: true },
    });
    if (!referrerStudio) throw new NotFoundException('Invalid referral code');

    // ── Self-referral guard ────────────────────────────────────────
    if (referrerStudio.id === referredStudioId) {
      throw new BadRequestException('You cannot refer yourself');
    }

    // ── Duplicate referral guard ───────────────────────────────────
    const existingReferral = await this.prisma.referral.findUnique({
      where: { referred_studio_id: referredStudioId },
    });
    if (existingReferral) {
      throw new ConflictException('This studio has already been referred');
    }

    // ── Duplicate email guard (same email used with same code) ─────
    if (dto.referred_email) {
      const emailConflict = await this.prisma.referral.findFirst({
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

    const referral = await this.prisma.referral.create({
      data: {
        referrer_studio_id: referrerStudio.id,
        referred_studio_id: referredStudioId,
        referral_code:      code,
        referred_email:     dto.referred_email?.toLowerCase() ?? null,
        status:             'pending',
      },
    });

    // Also stamp the referred_by_code on the studio for immutable audit
    await this.prisma.studio.update({
      where: { id: referredStudioId },
      data: { referred_by_code: code },
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
   * Core reward handler — called by the event listener.
   * Finds the referral, runs the rule engine, applies rewards.
   */
  async handleSubscriptionActivated(
    payload: SubscriptionActivatedPayload,
  ): Promise<void> {
    const { studioId, idempotencyKey } = payload;

    // ── Find a pending referral for this studio ────────────────────
    const referral = await this.prisma.referral.findUnique({
      where: { referred_studio_id: studioId },
      include: {
        referrer_studio: { select: { id: true, country: true } },
        referred_studio: { select: { id: true, country: true } },
      },
    });

    if (!referral) {
      this.logger.debug(`No referral found for studio ${studioId} — nothing to reward`);
      return;
    }

    if (referral.status === 'rewarded') {
      this.logger.debug(`Referral ${referral.id} already rewarded — idempotency skip`);
      return;
    }

    if (referral.status === 'fraud' || referral.status === 'reversed') {
      this.logger.warn(`Referral ${referral.id} is ${referral.status} — skipping`);
      return;
    }

    // ── Mark referral as "processing" (prevents concurrent double-reward) ─
    const referralIdempotencyKey = `reward_${referral.id}_${idempotencyKey}`;
    const updated = await this.prisma.referral.updateMany({
      where: {
        id:               referral.id,
        status:           'pending',
        idempotency_key:  null,
      },
      data: {
        status:           'completed',
        idempotency_key:  referralIdempotencyKey,
      },
    });

    if (updated.count === 0) {
      this.logger.warn(
        `Referral ${referral.id} race condition prevented — already being processed`,
      );
      return;
    }

    // ── Evaluate rules ─────────────────────────────────────────────
    const ctx: EvaluationContext = {
      referrerStudioId:     referral.referrer_studio_id,
      referredStudioCountry: referral.referred_studio?.country ?? null,
      payload,
    };

    const matchedRules = await this.ruleEngine.evaluate(ctx);

    if (matchedRules.length === 0) {
      this.logger.log(
        `Referral ${referral.id}: no rules matched for plan ${payload.planId} — no reward`,
      );
      // Referral is completed (studio did activate) but no reward was earned
      return;
    }

    // ── Apply rewards ──────────────────────────────────────────────
    const results = await this.rewardProcessor.processRewards({
      referralId:        referral.id,
      referrerStudioId:  referral.referrer_studio_id,
      matchedRules,
      payload,
      eventType:         REFERRAL_EVENTS.SUBSCRIPTION_ACTIVATED,
    });

    // ── Mark referral as fully rewarded ───────────────────────────
    if (results.length > 0) {
      await this.prisma.referral.update({
        where: { id: referral.id },
        data:  { status: 'rewarded', rewarded_at: new Date() },
      });

      this.logger.log(
        `🎉 Referral ${referral.id} rewarded: ${results.length} reward(s) applied to studio ${referral.referrer_studio_id}`,
      );
    }
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
      this.prisma.referral.count({ where: { referrer_studio_id: studioId } }),
      this.prisma.referral.count({ where: { referrer_studio_id: studioId, status: 'pending' } }),
      this.prisma.referral.count({ where: { referrer_studio_id: studioId, status: 'rewarded' } }),
      this.prisma.rewardLog.findMany({
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
      this.prisma.studio.findUnique({
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
      await this.prisma.studio.update({
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
      this.prisma.referral.findMany({
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
      this.prisma.referral.count({ where: where as any }),
    ]);

    return {
      data,
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }
}
