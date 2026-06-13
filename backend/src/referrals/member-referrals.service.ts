import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { Prisma } from '../../node_modules/.prisma/client-tenant';
import { randomBytes } from 'crypto';
import { getTenantGymId } from '../common/tenant-context';
import {
  REFERRAL_EVENTS,
  MemberReferralCodeUsedPayload,
  MemberReferralPaymentCompletedPayload,
  MemberReferralMembershipActivePayload,
  MemberReferralCancelledPayload,
} from './events/domain-events';

/**
 * B2C Member Referral Service.
 *
 * Lifecycle:
 *   link_shared → code_used → member_registered
 *               → payment_completed → active_membership
 *               → reward_unlocked → reward_claimed
 *               → cancelled (terminal)
 *
 * Per-gym: gym owner chooses an active ReferralProgram (template). When
 * lifecycle reaches `active_membership` the referrer is rewarded per the
 * current active program — past rewards are immutable.
 */
@Injectable()
export class MemberReferralsService {
  private readonly logger = new Logger(MemberReferralsService.name);

  private readonly TRANSITIONS: Record<string, Set<string>> = {
    link_shared:        new Set(['code_used', 'cancelled']),
    code_used:          new Set(['member_registered', 'cancelled']),
    member_registered:  new Set(['payment_completed', 'cancelled']),
    payment_completed:  new Set(['active_membership', 'cancelled']),
    active_membership:  new Set(['reward_unlocked', 'cancelled']),
    reward_unlocked:    new Set(['reward_claimed', 'cancelled']),
    reward_claimed:     new Set(['cancelled']),
    cancelled:          new Set(),
  };

  constructor(
    private readonly tenant: TenantPrisma,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Code generation ─────────────────────────────────────────────

  /** Generate a unique per-member referral code, e.g. `RAHUL-44K2`. */
  async ensureMemberCode(memberId: string): Promise<string> {
    const member = await this.tenant.client.member.findUnique({
      where:  { id: memberId },
      select: { referral_code: true, full_name: true },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.referral_code) return member.referral_code;

    const prefix = (member.full_name ?? 'MX')
      .split(/\s+/)[0]
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 5) || 'MX';

    for (let i = 0; i < 5; i++) {
      const suffix = randomBytes(3)
        .toString('base64')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 4)
        .padEnd(4, '0');
      const code = `${prefix}-${suffix}`;
      const collision = await this.tenant.client.member.findUnique({
        where: { referral_code: code },
        select: { id: true },
      });
      if (!collision) {
        await this.tenant.client.member.update({
          where: { id: memberId },
          data:  { referral_code: code },
        });
        return code;
      }
    }
    throw new ConflictException('Could not generate unique referral code');
  }

  // ── Code validation (public, pre-registration) ──────────────────

  async validateCode(code: string) {
    const member = await this.tenant.client.member.findUnique({
      where:  { referral_code: code },
      select: { id: true, full_name: true, gym_id: true },
    });
    if (!member) return { valid: false, message: 'Invalid referral code' };
    return {
      valid:         true,
      referrer_name: member.full_name,
      gym_id:        member.gym_id,
    };
  }

  // ── Referral creation (called at referred member registration) ─

  async createMemberReferral(params: {
    referrerCode?: string;
    referrerMemberId?: string;
    referredMemberId: string;
  }): Promise<{ member_referral_id: string }> {
    const gymId = getTenantGymId();
    if (!gymId) throw new BadRequestException('Tenant context required');

    // Resolve referrer
    let referrerId = params.referrerMemberId;
    if (!referrerId && params.referrerCode) {
      const referrer = await this.tenant.client.member.findUnique({
        where:  { referral_code: params.referrerCode },
        select: { id: true, gym_id: true },
      });
      if (!referrer) throw new NotFoundException('Invalid referrer code');
      if (referrer.gym_id !== gymId) {
        throw new BadRequestException('Referrer belongs to a different gym');
      }
      referrerId = referrer.id;
    }
    if (!referrerId) throw new BadRequestException('Either referrerCode or referrerMemberId is required');

    if (referrerId === params.referredMemberId) {
      throw new BadRequestException('Cannot self-refer');
    }

    const existing = await this.tenant.client.memberReferral.findUnique({
      where: {
        referrer_member_id_referred_member_id: {
          referrer_member_id: referrerId,
          referred_member_id: params.referredMemberId,
        },
      },
    });
    if (existing) throw new ConflictException('Referral already exists');

    const referral = await this.tenant.client.memberReferral.create({
      data: {
        gym_id:             gymId,
        referrer_member_id: referrerId,
        referred_member_id: params.referredMemberId,
        reward_status:      'pending',
      },
    });

    await this.recordEvent({
      gymId,
      memberReferralId: referral.id,
      fromStatus:       null,
      toStatus:         'member_registered',
      actorType:        'system',
      payload:          { source: 'createMemberReferral' },
    });

    return { member_referral_id: referral.id };
  }

  // ── Lifecycle transitions ───────────────────────────────────────

  async transition(params: {
    memberReferralId: string;
    toStatus: string;
    actorType?: 'system' | 'admin' | 'webhook' | 'gym_owner' | 'member';
    actorId?: string;
    payload?: Record<string, unknown>;
  }): Promise<boolean> {
    const gymId = getTenantGymId();
    if (!gymId) throw new BadRequestException('Tenant context required');

    // Derive current effective status from the latest lifecycle event.
    const last = await this.tenant.client.memberReferralEvent.findFirst({
      where:   { member_referral_id: params.memberReferralId },
      orderBy: { occurred_at: 'desc' },
      select:  { to_status: true },
    });
    const fromStatus = last?.to_status ?? null;

    if (fromStatus === params.toStatus) return false;
    if (fromStatus !== null && !this.TRANSITIONS[fromStatus]?.has(params.toStatus)) {
      this.logger.warn(
        `Illegal B2C transition: ${params.memberReferralId} ${fromStatus} → ${params.toStatus}`,
      );
      return false;
    }

    await this.recordEvent({
      gymId,
      memberReferralId: params.memberReferralId,
      fromStatus,
      toStatus:         params.toStatus,
      actorType:        params.actorType ?? 'system',
      actorId:          params.actorId,
      payload:          params.payload,
    });
    return true;
  }

  private async recordEvent(params: {
    gymId: string;
    memberReferralId: string;
    fromStatus: string | null;
    toStatus: string;
    actorType: string;
    actorId?: string;
    payload?: Record<string, unknown>;
  }) {
    await this.tenant.client.memberReferralEvent.create({
      data: {
        gym_id:             params.gymId,
        member_referral_id: params.memberReferralId,
        from_status:        params.fromStatus,
        to_status:          params.toStatus,
        actor_type:         params.actorType,
        actor_id:           params.actorId ?? null,
        payload:            (params.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  // ── Reward unlock (called on active_membership event) ───────────

  async unlockReward(params: {
    memberReferralId: string;
    paymentId: string;
  }): Promise<{ reward_id: string } | null> {
    const gymId = getTenantGymId();
    if (!gymId) throw new BadRequestException('Tenant context required');

    const referral = await this.tenant.client.memberReferral.findUnique({
      where: { id: params.memberReferralId },
    });
    if (!referral) throw new NotFoundException('Referral not found');
    if (referral.reward_status === 'awarded') {
      this.logger.debug(`Referral ${referral.id} already awarded — skipping`);
      return null;
    }

    // Find the active referral program for this gym.
    const program = await this.tenant.client.referralProgram.findFirst({
      where: {
        gym_id: gymId,
        status: 'active',
        OR:     [{ start_date: null }, { start_date: { lte: new Date() } }],
        AND:    [{ OR: [{ end_date: null }, { end_date: { gte: new Date() } }] }],
      },
      orderBy: { created_at: 'desc' },
    });
    if (!program) {
      this.logger.log(`No active referral program for gym ${gymId} — no reward`);
      return null;
    }

    // max_rewards: cap total rewards issued under this program for the referrer.
    if (program.max_rewards) {
      const issued = await this.tenant.client.memberReferralReward.count({
        where: {
          gym_id:                gymId,
          program_id:            program.id,
          beneficiary_member_id: referral.referrer_member_id,
          status:                { in: ['applied', 'claimed'] },
        },
      });
      if (issued >= program.max_rewards) {
        this.logger.warn(
          `Referrer ${referral.referrer_member_id} hit max_rewards cap for program ${program.id}`,
        );
        return null;
      }
    }

    const idempotencyKey = `member_reward_${referral.id}_${program.id}_${params.paymentId}`;

    try {
      const reward = await this.tenant.client.memberReferralReward.create({
        data: {
          gym_id:                gymId,
          member_referral_id:    referral.id,
          program_id:            program.id,
          beneficiary_member_id: referral.referrer_member_id,
          reward_type:           program.reward_type,
          reward_value:          { amount: program.reward_value.toNumber() } as Prisma.InputJsonValue,
          status:                'applied',
          idempotency_key:       idempotencyKey,
        },
      });

      await this.tenant.client.memberReferral.update({
        where: { id: referral.id },
        data:  {
          reward_status: 'awarded',
          reward_type:   program.reward_type,
          reward_value:  program.reward_value,
          awarded_at:    new Date(),
        },
      });

      await this.transition({
        memberReferralId: referral.id,
        toStatus:         'reward_unlocked',
        actorType:        'system',
        payload:          { reward_id: reward.id },
      });

      this.logger.log(
        `🎉 Member referral ${referral.id} awarded: ${program.reward_type} = ${program.reward_value}`,
      );
      return { reward_id: reward.id };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Unique constraint on idempotency_key — replay; treat as success.
        this.logger.debug(`Reward idempotency replay for ${idempotencyKey}`);
        return null;
      }
      throw err;
    }
  }

  // ── Event handlers (called by listener) ─────────────────────────

  async onCodeUsed(payload: MemberReferralCodeUsedPayload) {
    this.logger.log(
      `member referral code used: gym=${payload.gymId} referrer=${payload.referrerMemberId}`,
    );
    // No DB write yet — referred member doesn't exist until registration.
  }

  async onPaymentCompleted(payload: MemberReferralPaymentCompletedPayload) {
    await this.transition({
      memberReferralId: payload.memberReferralId,
      toStatus:         'payment_completed',
      actorType:        'webhook',
      payload:          { payment_id: payload.paymentId, amount: payload.amountPaid },
    });
  }

  async onMembershipActive(payload: MemberReferralMembershipActivePayload) {
    await this.transition({
      memberReferralId: payload.memberReferralId,
      toStatus:         'active_membership',
      actorType:        'system',
      payload:          { membership_id: payload.membershipId },
    });
    await this.unlockReward({
      memberReferralId: payload.memberReferralId,
      paymentId:        payload.idempotencyKey,
    });
  }

  async onCancelled(payload: MemberReferralCancelledPayload) {
    await this.transition({
      memberReferralId: payload.memberReferralId,
      toStatus:         'cancelled',
      actorType:        'system',
      payload:          { reason: payload.reason },
    });
  }

  // ── Member-facing queries ───────────────────────────────────────

  async getMemberStats(memberId: string) {
    const gymId = getTenantGymId();
    if (!gymId) throw new BadRequestException('Tenant context required');

    const [code, given, received, rewards] = await Promise.all([
      this.ensureMemberCode(memberId),
      this.tenant.client.memberReferral.findMany({
        where:   { referrer_member_id: memberId },
        orderBy: { created_at: 'desc' },
        include: { referred: { select: { full_name: true } } },
      }),
      this.tenant.client.memberReferral.count({ where: { referred_member_id: memberId } }),
      this.tenant.client.memberReferralReward.findMany({
        where:   { gym_id: gymId, beneficiary_member_id: memberId },
        orderBy: { applied_at: 'desc' },
        take:    20,
      }),
    ]);

    return {
      referral_code: code,
      stats: {
        given:   given.length,
        awarded: given.filter((r) => r.reward_status === 'awarded').length,
        pending: given.filter((r) => r.reward_status === 'pending').length,
        received,
      },
      referrals_given: given.map((r) => ({
        id:           r.id,
        referred:     r.referred?.full_name,
        status:       r.reward_status,
        awarded_at:   r.awarded_at,
      })),
      rewards,
    };
  }

  // ── Gym owner leaderboard ───────────────────────────────────────

  async getLeaderboard(opts: { limit?: number } = {}) {
    const gymId = getTenantGymId();
    if (!gymId) throw new BadRequestException('Tenant context required');
    const limit = opts.limit ?? 10;

    const rows = await this.tenant.client.memberReferral.groupBy({
      by:    ['referrer_member_id'],
      where: { gym_id: gymId, reward_status: 'awarded' },
      _count: { referrer_member_id: true },
      orderBy: { _count: { referrer_member_id: 'desc' } },
      take:  limit,
    });

    const members = await this.tenant.client.member.findMany({
      where:  { id: { in: rows.map((r) => r.referrer_member_id) } },
      select: { id: true, full_name: true, referral_code: true },
    });
    const byId: Record<string, any> = Object.fromEntries(members.map((m) => [m.id, m]));

    return rows.map((r) => ({
      member:           byId[r.referrer_member_id],
      successful_count: r._count.referrer_member_id,
    }));
  }
}
