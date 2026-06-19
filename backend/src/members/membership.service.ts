import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../common/tenant-context';
import { AssignMembershipDto } from './dto/assign-membership.dto';
import { FreezeMembershipDto } from './dto/freeze-membership.dto';
import { randomBytes } from 'crypto';
import { assertMemberTransition, assertMembershipTransition } from '../common/status-transitions';
import { MemberReferralsService } from '../referrals/member-referrals.service';
import { resolvePlanPrice } from './plan-pricing.util';

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    private tenant: TenantPrisma,
    private readonly memberReferrals: MemberReferralsService,
  ) {}

  // ── Assign Membership ───────────────────────────────────────

  async assign(memberId: string, dto: AssignMembershipDto) {
    const [member, plan] = await Promise.all([
      this.tenant.client.member.findUnique({ where: { id: memberId } }),
      this.tenant.client.membershipPlan.findUnique({ where: { id: dto.plan_id } }),
    ]);
    if (!member) throw new NotFoundException('Member not found');
    if (!plan) throw new BadRequestException('Invalid plan');
    if (!plan.is_active) throw new BadRequestException('Plan is no longer active');

    const startDate = dto.start_date ? new Date(dto.start_date) : new Date();
    const endDate = plan.duration_days
      ? new Date(startDate.getTime() + plan.duration_days * 86400000)
      : null;

    const graceEndDate = endDate && plan.grace_period_days > 0
      ? new Date(endDate.getTime() + plan.grace_period_days * 86400000)
      : null;

    const gymId = getTenantGymId()!;

    // All writes run in ONE transaction so a mid-sequence failure can never leave
    // the member with no active membership (old expired but new not created), or a
    // membership with no payment/ledger row (revenue under-recorded). Either the
    // whole assignment commits or none of it does.
    const membership = await this.tenant.client.$transaction(async (tx) => {
      // Expire any currently active or frozen membership for this member
      await tx.memberMembership.updateMany({
        where: { member_id: memberId, status: { in: ['active', 'frozen'] } },
        data: { status: 'expired' },
      });
      // Also complete any active freezes on those memberships
      await tx.membershipFreeze.updateMany({
        where: { membership: { member_id: memberId }, status: 'active' },
        data: { status: 'completed', end_date: new Date() },
      });

      const created = await tx.memberMembership.create({
        data: {
          gym_id: gymId,
          member_id: memberId,
          plan_id: dto.plan_id,
          branch_id: dto.branch_id,
          start_date: startDate,
          end_date: endDate,
          classes_remaining: plan.total_classes,
          remaining_visits: plan.max_visits,
          grace_end_date: graceEndDate,
          status: 'active',
          auto_renew: dto.auto_renew || plan.auto_renew_enabled,
        },
        include: { plan: true, branch: { select: { id: true, name: true } } },
      });

      // Create payment record if payment_method specified
      if (dto.payment_method) {
        const receiptNumber = `RCP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;
        // Branch-tier pricing: plan may override its base price per branch.
        const chargeAmount = resolvePlanPrice(plan, dto.branch_id);
        const payment = await tx.payment.create({
          data: {
            gym_id: gymId,
            member_id: memberId,
            membership_id: created.id,
            branch_id: dto.branch_id,
            amount: chargeAmount,
            payment_method: dto.payment_method,
            status: 'paid',
            receipt_number: receiptNumber,
            paid_at: new Date(),
          },
        });

        // Create corresponding ledger entry
        await tx.financialTransaction.create({
          data: {
            gym_id: gymId,
            branch_id: dto.branch_id,
            reference_type: 'payment',
            reference_id: payment.id,
            transaction_type: 'credit',
            amount: chargeAmount,
            description: `Membership payment: ${plan.name}`,
          },
        });
      }

      await tx.member.update({
        where: { id: memberId },
        data: { status: 'active' },
      });

      return created;
    });

    // ── B2C referral reward hook ───────────────────────────────────
    // If this member was referred and just activated a PAID membership,
    // ensure the MemberReferral exists and unlock the referrer's reward.
    // Fire-and-forget: a referral failure must never block membership assignment.
    if (member.referred_by_member_id && dto.payment_method) {
      this.handleReferralReward(memberId, member.referred_by_member_id, membership.id).catch(
        (err) =>
          this.logger.warn(
            `B2C referral reward hook failed for member ${memberId}: ${err.message}`,
          ),
      );
    }

    return membership;
  }

  /**
   * Idempotently create the member referral (if missing) and run the reward
   * unlock pipeline. Safe to call on every membership assignment — the
   * underlying services dedupe via unique constraints + idempotency keys.
   */
  private async handleReferralReward(
    referredMemberId: string,
    referrerMemberId: string,
    membershipId: string,
  ): Promise<void> {
    // Create the referral link if it doesn't already exist.
    let memberReferralId: string | null = null;
    const existing = await this.tenant.client.memberReferral.findUnique({
      where: {
        referrer_member_id_referred_member_id: {
          referrer_member_id: referrerMemberId,
          referred_member_id: referredMemberId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      memberReferralId = existing.id;
    } else {
      try {
        const created = await this.memberReferrals.createMemberReferral({
          referrerMemberId,
          referredMemberId,
        });
        memberReferralId = created.member_referral_id;
      } catch {
        // Self-referral / cross-gym / duplicate — silently skip.
        return;
      }
    }

    if (!memberReferralId) return;

    // Advance lifecycle and unlock the reward per the active program.
    await this.memberReferrals.transition({
      memberReferralId,
      toStatus: 'payment_completed',
      actorType: 'system',
    });
    await this.memberReferrals.transition({
      memberReferralId,
      toStatus: 'active_membership',
      actorType: 'system',
      payload: { membership_id: membershipId },
    });
    await this.memberReferrals.unlockReward({
      memberReferralId,
      paymentId: membershipId,
    });
  }

  // ── Get Member's Memberships ────────────────────────────────

  async findByMember(memberId: string, status?: string) {
    const where: any = { member_id: memberId };
    if (status) where.status = status;

    return this.tenant.client.memberMembership.findMany({
      where,
      include: {
        plan: true,
        branch: { select: { id: true, name: true } },
        freezes: { orderBy: { created_at: 'desc' } },
        _count: { select: { check_ins: true, payments: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const membership = await this.tenant.client.memberMembership.findUnique({
      where: { id },
      include: {
        member: { select: { id: true, full_name: true, member_code: true, phone: true } },
        plan: true,
        branch: { select: { id: true, name: true } },
        freezes: { orderBy: { created_at: 'desc' } },
        _count: { select: { check_ins: true, payments: true } },
      },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    return membership;
  }

  // ── Freeze Membership ───────────────────────────────────────

  async freeze(membershipId: string, dto: FreezeMembershipDto) {
    const membership = await this.tenant.client.memberMembership.findUnique({
      where: { id: membershipId },
      include: { member: true },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    assertMembershipTransition(membership.status, 'frozen');

    const startDate = new Date(dto.start_date);
    const endDate = dto.end_date ? new Date(dto.end_date) : null;

    // Create freeze history record
    const freeze = await this.tenant.client.membershipFreeze.create({
      data: {
        gym_id: getTenantGymId()!,
        membership_id: membershipId,
        start_date: startDate,
        end_date: endDate,
        reason: dto.reason,
        approved_by_id: dto.approved_by_id,
        status: 'active',
      },
    });

    // Update membership status
    await this.tenant.client.memberMembership.update({
      where: { id: membershipId },
      data: {
        status: 'frozen',
        freeze_start_date: startDate,
        freeze_end_date: endDate,
        freeze_reason: dto.reason,
      },
    });

    // Update member status
    await this.tenant.client.member.update({
      where: { id: membership.member_id },
      data: { status: 'frozen' },
    });

    return freeze;
  }

  // ── Unfreeze Membership ─────────────────────────────────────

  async unfreeze(membershipId: string) {
    const membership = await this.tenant.client.memberMembership.findUnique({
      where: { id: membershipId },
      include: { member: true },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    assertMembershipTransition(membership.status, 'active');

    const now = new Date();
    const freezeStart = membership.freeze_start_date;
    const frozenDays = freezeStart
      ? Math.ceil((now.getTime() - freezeStart.getTime()) / 86400000)
      : 0;

    // Extend end_date by frozen days
    const newEndDate = membership.end_date && frozenDays > 0
      ? new Date(membership.end_date.getTime() + frozenDays * 86400000)
      : membership.end_date;

    // Also extend grace_end_date if it exists
    const newGraceEndDate = membership.grace_end_date && frozenDays > 0
      ? new Date(membership.grace_end_date.getTime() + frozenDays * 86400000)
      : membership.grace_end_date;

    // Complete the active freeze record
    await this.tenant.client.membershipFreeze.updateMany({
      where: { membership_id: membershipId, status: 'active' },
      data: {
        end_date: now,
        days_frozen: frozenDays,
        status: 'completed',
      },
    });

    const updated = await this.tenant.client.memberMembership.update({
      where: { id: membershipId },
      data: {
        status: 'active',
        end_date: newEndDate,
        grace_end_date: newGraceEndDate,
        freeze_start_date: null,
        freeze_end_date: null,
        freeze_reason: null,
      },
      include: { plan: true },
    });

    await this.tenant.client.member.update({
      where: { id: membership.member_id },
      data: { status: 'active' },
    });

    return { ...updated, frozen_days_added: frozenDays };
  }

  // ── Cancel Membership ───────────────────────────────────────

  async cancel(membershipId: string) {
    const membership = await this.tenant.client.memberMembership.findUnique({
      where: { id: membershipId },
      include: { member: true },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    assertMembershipTransition(membership.status, 'cancelled');

    // Cancel any active freezes
    await this.tenant.client.membershipFreeze.updateMany({
      where: { membership_id: membershipId, status: 'active' },
      data: { status: 'cancelled' },
    });

    const updated = await this.tenant.client.memberMembership.update({
      where: { id: membershipId },
      data: { status: 'cancelled', auto_renew: false },
      include: { plan: true },
    });

    // Check if member has any other active memberships
    const otherActive = await this.tenant.client.memberMembership.count({
      where: { member_id: membership.member_id, status: 'active' },
    });

    if (otherActive === 0) {
      await this.tenant.client.member.update({
        where: { id: membership.member_id },
        data: { status: 'cancelled' },
      });
    }

    return updated;
  }

  // ── Renew Membership ────────────────────────────────────────

  async renew(membershipId: string, paymentMethod?: string) {
    const membership = await this.tenant.client.memberMembership.findUnique({
      where: { id: membershipId },
      include: { plan: true, member: true },
    });
    if (!membership) throw new NotFoundException('Membership not found');

    const plan = membership.plan;

    // Create new membership
    const startDate = new Date();
    const endDate = plan.duration_days
      ? new Date(startDate.getTime() + plan.duration_days * 86400000)
      : null;
    const graceEndDate = endDate && plan.grace_period_days > 0
      ? new Date(endDate.getTime() + plan.grace_period_days * 86400000)
      : null;
    const gymId = getTenantGymId()!;

    // Mark-old-renewed + create-new + payment + ledger + member update run in ONE
    // transaction so a partial failure can't drop the old membership without
    // creating the new one, or create a renewal with no payment/ledger row.
    const newMembership = await this.tenant.client.$transaction(async (tx) => {
      await tx.memberMembership.update({
        where: { id: membershipId },
        data: { status: 'renewed' },
      });

      const created = await tx.memberMembership.create({
        data: {
          gym_id: gymId,
          member_id: membership.member_id,
          plan_id: plan.id,
          branch_id: membership.branch_id,
          start_date: startDate,
          end_date: endDate,
          classes_remaining: plan.total_classes,
          remaining_visits: plan.max_visits,
          grace_end_date: graceEndDate,
          status: 'active',
          auto_renew: membership.auto_renew,
        },
        include: { plan: true, branch: { select: { id: true, name: true } } },
      });

      // Create payment if method provided
      if (paymentMethod) {
        const receiptNumber = `RCP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;
        const chargeAmount = resolvePlanPrice(plan, membership.branch_id);
        const renewPayment = await tx.payment.create({
          data: {
            gym_id: gymId,
            member_id: membership.member_id,
            membership_id: created.id,
            branch_id: membership.branch_id,
            amount: chargeAmount,
            payment_method: paymentMethod,
            status: 'paid',
            receipt_number: receiptNumber,
            paid_at: new Date(),
          },
        });

        await tx.financialTransaction.create({
          data: {
            gym_id: gymId,
            branch_id: membership.branch_id,
            reference_type: 'payment',
            reference_id: renewPayment.id,
            transaction_type: 'credit',
            amount: chargeAmount,
            description: `Membership renewal: ${plan.name}`,
          },
        });
      }

      await tx.member.update({
        where: { id: membership.member_id },
        data: { status: 'active' },
      });

      return created;
    });

    return newMembership;
  }

  // ── Track Visit (decrement remaining_visits) ────────────────

  async trackVisit(membershipId: string) {
    const membership = await this.tenant.client.memberMembership.findUnique({
      where: { id: membershipId },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    if (membership.status !== 'active') {
      throw new BadRequestException('Membership is not active');
    }

    // Unlimited-visit plan: nothing to decrement.
    if (membership.remaining_visits === null) {
      return { remaining_visits: null };
    }

    // Atomic guarded decrement — `updateMany` with `remaining_visits > 0` means
    // two concurrent visits can never drive the counter below zero. A plain
    // read-then-write (read N, write N-1) would let both readers see the last
    // visit and double-spend it.
    const result = await this.tenant.client.memberMembership.updateMany({
      where: { id: membershipId, status: 'active', remaining_visits: { gt: 0 } },
      data: { remaining_visits: { decrement: 1 } },
    });
    if (result.count === 0) {
      throw new BadRequestException('No remaining visits on this membership');
    }

    // updateMany doesn't return rows — re-read the post-decrement value.
    const updated = await this.tenant.client.memberMembership.findUnique({
      where: { id: membershipId },
      select: { remaining_visits: true },
    });
    return { remaining_visits: updated?.remaining_visits ?? null };
  }

  // ── Toggle Auto-Renew ───────────────────────────────────────

  async toggleAutoRenew(membershipId: string, enabled: boolean) {
    const membership = await this.findOne(membershipId);
    return this.tenant.client.memberMembership.update({
      where: { id: membership.id },
      data: { auto_renew: enabled },
    });
  }

  // ── Get Stats ───────────────────────────────────────────────

  async getStats(filters?: { branch_id?: string }) {
    const where: any = {};
    if (filters?.branch_id) where.branch_id = filters.branch_id;

    const statuses = ['active', 'frozen', 'expired', 'cancelled', 'renewed', 'paused'];
    const counts = await Promise.all(
      statuses.map((s) =>
        this.tenant.client.memberMembership.count({ where: { ...where, status: s } }),
      ),
    );

    const total = await this.tenant.client.memberMembership.count({ where });
    const summary: Record<string, number> = { total };
    statuses.forEach((s, i) => { summary[s] = counts[i]; });

    // Expiring soon (within 7 days)
    const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000);
    summary.expiring_soon = await this.tenant.client.memberMembership.count({
      where: {
        ...where,
        status: 'active',
        end_date: { lte: sevenDaysFromNow, gte: new Date() },
      },
    });

    // Auto-renew enabled count
    summary.auto_renew_enabled = await this.tenant.client.memberMembership.count({
      where: { ...where, status: 'active', auto_renew: true },
    });

    return summary;
  }
}
