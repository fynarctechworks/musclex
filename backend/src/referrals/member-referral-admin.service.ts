import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { getTenantGymId } from '../common/tenant-context';
import { MemberReferralsService } from './member-referrals.service';

/**
 * Gym-owner admin layer for the B2C (member→member) referral system.
 *
 * Capabilities (per-gym, scoped via tenant context):
 *   - CRUD on ReferralProgram (the gym-owner's policy templates)
 *   - Activate / pause programs
 *   - Manually issue a reward (bypass auto-trigger)
 *   - Revoke an issued reward
 *   - Force-transition a member referral lifecycle
 *   - Review B2C fraud signals
 *   - Pull leaderboard + aggregate analytics
 */
@Injectable()
export class MemberReferralAdminService {
  private readonly logger = new Logger(MemberReferralAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memberRefs: MemberReferralsService,
  ) {}

  private gymId(): string {
    const id = getTenantGymId();
    if (!id) throw new BadRequestException('Tenant context required');
    return id;
  }

  // ── Programs (templates) ────────────────────────────────────────

  async listPrograms() {
    return this.prisma.referralProgram.findMany({
      where:   { gym_id: this.gymId() },
      orderBy: { created_at: 'desc' },
    });
  }

  async createProgram(dto: {
    program_name: string;
    reward_type: string;      // 'discount' | 'free_days' | 'cash' | 'free_class'
    reward_value: number;
    min_referrals?: number;
    max_rewards?: number;
    start_date?: string;
    end_date?: string;
  }) {
    return this.prisma.referralProgram.create({
      data: {
        gym_id:        this.gymId(),
        program_name:  dto.program_name,
        reward_type:   dto.reward_type,
        reward_value:  new Prisma.Decimal(dto.reward_value),
        min_referrals: dto.min_referrals ?? 1,
        max_rewards:   dto.max_rewards ?? null,
        start_date:    dto.start_date ? new Date(dto.start_date) : null,
        end_date:      dto.end_date ? new Date(dto.end_date) : null,
        status:        'active',
      },
    });
  }

  async updateProgram(id: string, dto: Partial<{
    program_name: string;
    reward_type: string;
    reward_value: number;
    min_referrals: number;
    max_rewards: number | null;
    start_date: string | null;
    end_date: string | null;
    status: string;
  }>) {
    const existing = await this.prisma.referralProgram.findFirst({
      where: { id, gym_id: this.gymId() },
    });
    if (!existing) throw new NotFoundException('Program not found');

    return this.prisma.referralProgram.update({
      where: { id },
      data: {
        ...(dto.program_name !== undefined && { program_name: dto.program_name }),
        ...(dto.reward_type !== undefined && { reward_type: dto.reward_type }),
        ...(dto.reward_value !== undefined && { reward_value: new Prisma.Decimal(dto.reward_value) }),
        ...(dto.min_referrals !== undefined && { min_referrals: dto.min_referrals }),
        ...(dto.max_rewards !== undefined && { max_rewards: dto.max_rewards }),
        ...(dto.start_date !== undefined && {
          start_date: dto.start_date ? new Date(dto.start_date) : null,
        }),
        ...(dto.end_date !== undefined && {
          end_date: dto.end_date ? new Date(dto.end_date) : null,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async setProgramStatus(id: string, status: 'active' | 'paused' | 'ended') {
    const program = await this.prisma.referralProgram.findFirst({
      where: { id, gym_id: this.gymId() },
    });
    if (!program) throw new NotFoundException('Program not found');
    return this.prisma.referralProgram.update({ where: { id }, data: { status } });
  }

  // ── Manual reward ───────────────────────────────────────────────

  /**
   * Issue a reward outside the normal lifecycle trigger.
   * Useful for grandfathering past referrals or compensating disputes.
   */
  async issueManualReward(params: {
    memberReferralId: string;
    rewardType: string;
    rewardValue: Record<string, unknown>;
    adminId: string;
    notes?: string;
  }) {
    const gymId = this.gymId();
    const referral = await this.prisma.memberReferral.findFirst({
      where: { id: params.memberReferralId, gym_id: gymId },
    });
    if (!referral) throw new NotFoundException('Member referral not found');

    const idempotencyKey = `manual_${referral.id}_${params.adminId}_${Date.now()}`;

    const reward = await this.prisma.memberReferralReward.create({
      data: {
        gym_id:                gymId,
        member_referral_id:    referral.id,
        program_id:            null,
        beneficiary_member_id: referral.referrer_member_id,
        reward_type:           params.rewardType,
        reward_value:          params.rewardValue as Prisma.InputJsonValue,
        status:                'applied',
        idempotency_key:       idempotencyKey,
        notes:                 params.notes ?? null,
      },
    });

    await this.prisma.memberReferralEvent.create({
      data: {
        gym_id:             gymId,
        member_referral_id: referral.id,
        from_status:        null,
        to_status:          'reward_unlocked',
        actor_type:         'admin',
        actor_id:           params.adminId,
        payload:            { manual: true, reward_id: reward.id } as Prisma.InputJsonValue,
      },
    });

    this.logger.warn(`Manual reward issued: ${reward.id} by admin ${params.adminId}`);
    return reward;
  }

  async revokeMemberReward(params: {
    rewardId: string;
    adminId: string;
    reason: string;
  }) {
    if (!params.reason || params.reason.length < 5) {
      throw new BadRequestException('reason required');
    }
    const gymId = this.gymId();
    const reward = await this.prisma.memberReferralReward.findFirst({
      where: { id: params.rewardId, gym_id: gymId },
    });
    if (!reward) throw new NotFoundException('Reward not found');
    if (reward.status === 'reversed') {
      throw new ConflictException('Reward already reversed');
    }

    return this.prisma.memberReferralReward.update({
      where: { id: reward.id },
      data:  {
        status:          'reversed',
        reversed_at:     new Date(),
        reversed_reason: params.reason,
      },
    });
  }

  // ── Force lifecycle transition ──────────────────────────────────

  async forceTransition(params: {
    memberReferralId: string;
    toStatus: string;
    adminId: string;
    reason: string;
  }) {
    if (!params.reason || params.reason.length < 5) {
      throw new BadRequestException('reason required');
    }
    const gymId = this.gymId();
    const referral = await this.prisma.memberReferral.findFirst({
      where: { id: params.memberReferralId, gym_id: gymId },
    });
    if (!referral) throw new NotFoundException('Referral not found');

    const last = await this.prisma.memberReferralEvent.findFirst({
      where:   { member_referral_id: referral.id },
      orderBy: { occurred_at: 'desc' },
      select:  { to_status: true },
    });
    const fromStatus = last?.to_status ?? null;

    await this.prisma.memberReferralEvent.create({
      data: {
        gym_id:             gymId,
        member_referral_id: referral.id,
        from_status:        fromStatus,
        to_status:          params.toStatus,
        actor_type:         'admin',
        actor_id:           params.adminId,
        payload:            { forced: true, reason: params.reason } as Prisma.InputJsonValue,
      },
    });

    this.logger.warn(
      `B2C force-transition: ${referral.id} ${fromStatus} → ${params.toStatus} by ${params.adminId}`,
    );
    return { ok: true, from_status: fromStatus, to_status: params.toStatus };
  }

  // ── Fraud queue ──────────────────────────────────────────────────

  async listFraudQueue(opts: { severity?: string; limit?: number; offset?: number } = {}) {
    const gymId = this.gymId();
    return this.prisma.memberReferralFraudSignal.findMany({
      where: {
        gym_id:        gymId,
        review_status: 'pending',
        ...(opts.severity && { severity: opts.severity }),
      },
      orderBy: [{ severity: 'desc' }, { created_at: 'desc' }],
      take:    opts.limit ?? 50,
      skip:    opts.offset ?? 0,
    });
  }

  async reviewFraudSignal(params: {
    signalId: string;
    adminId: string;
    decision: 'reviewed_ok' | 'confirmed_fraud';
    notes?: string;
  }) {
    const gymId = this.gymId();
    const signal = await this.prisma.memberReferralFraudSignal.findFirst({
      where: { id: params.signalId, gym_id: gymId },
    });
    if (!signal) throw new NotFoundException('Signal not found');

    return this.prisma.memberReferralFraudSignal.update({
      where: { id: signal.id },
      data:  {
        review_status:  params.decision,
        reviewed_by:    params.adminId,
        reviewed_at:    new Date(),
        reviewer_notes: params.notes ?? null,
      },
    });
  }

  // ── Aggregate analytics ─────────────────────────────────────────

  async getOverview() {
    const gymId = this.gymId();
    const [byStatus, programs, rewards, leaderboard] = await Promise.all([
      this.prisma.memberReferral.groupBy({
        by:    ['reward_status'],
        where: { gym_id: gymId },
        _count: true,
      }),
      this.prisma.referralProgram.findMany({
        where:  { gym_id: gymId },
        select: { id: true, program_name: true, status: true, reward_type: true, reward_value: true },
      }),
      this.prisma.memberReferralReward.groupBy({
        by:    ['status', 'reward_type'],
        where: { gym_id: gymId },
        _count: true,
      }),
      this.memberRefs.getLeaderboard({ limit: 5 }),
    ]);

    return {
      by_reward_status: byStatus.map((s) => ({ status: s.reward_status, count: s._count })),
      programs,
      rewards: rewards.map((r) => ({ status: r.status, type: r.reward_type, count: r._count })),
      leaderboard,
    };
  }
}
