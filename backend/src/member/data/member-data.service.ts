import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemberException } from '../common/member-exception';
import { MemberWorkoutService } from './member-workout.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import type {
  MemberProfileData,
  MembershipData,
  ProgressData,
  BodyMetricData,
  OccupancyData,
  HomeDashboardData,
} from '../contract';
import {
  toNumber,
  mapGoal,
  mapMembershipStatus,
  daysUntil,
  occupancyLevel,
  computeStreakDays,
  greeting,
} from './mappers';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER DATA SERVICE
 * ────────────────────────────────────────────────────────────────
 *
 * Read/compose endpoints for the core loop. Uses the tenant-scoped Prisma
 * client (gym_id auto-injected from the JWT-derived tenant context); EVERY
 * member-owned query additionally filters by member_id from @CurrentMember —
 * the cross-member gate (Checklist §2.2). No method accepts an id from the client.
 */
@Injectable()
export class MemberDataService {
  /** How far back to scan check-ins when computing a streak. */
  private readonly streakWindowDays = 90;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workouts: MemberWorkoutService,
  ) {}

  async getProfile(member: CurrentMemberContext): Promise<MemberProfileData> {
    const m = await this.prisma.member.findFirst({
      where: { id: member.memberId },
      include: { profile: true },
    });
    if (!m) throw MemberException.notFound('Member not found.');

    const studio = await this.prisma.studio.findUnique({
      where: { id: member.tenantId },
      select: { name: true },
    });

    return {
      id: m.id,
      name: m.full_name,
      phone: m.phone,
      gymName: studio?.name ?? undefined,
      goal: mapGoal(m.profile?.fitness_goal),
      // experienceLevel has no backing column yet (flagged) — omit.
      avatarUrl: m.profile_photo_url ?? null,
    };
  }

  async getMembership(member: CurrentMemberContext): Promise<MembershipData> {
    const ms =
      (await this.prisma.memberMembership.findFirst({
        where: { member_id: member.memberId, status: 'active' },
        include: { plan: true },
        orderBy: { created_at: 'desc' },
      })) ??
      (await this.prisma.memberMembership.findFirst({
        where: { member_id: member.memberId },
        include: { plan: true },
        orderBy: { created_at: 'desc' },
      }));
    if (!ms) throw MemberException.notFound('No membership found.');

    const invoices = await this.prisma.memberInvoice.findMany({
      where: { member_id: member.memberId },
      orderBy: { issued_at: 'desc' },
      take: 10,
    });

    return {
      status: mapMembershipStatus(ms.status, ms.end_date),
      plan: {
        id: ms.plan?.id,
        name: ms.plan?.name,
        price: toNumber(ms.plan?.price) ?? undefined,
        currency: ms.plan?.currency,
      },
      startedOn: ms.start_date?.toISOString().slice(0, 10),
      expiresOn: ms.end_date?.toISOString().slice(0, 10),
      autoRenew: ms.auto_renew,
      invoices: invoices.map((i) => ({
        id: i.id,
        amount: toNumber(i.total_amount) ?? undefined,
        currency: i.currency,
        paidOn: i.paid_at ? i.paid_at.toISOString() : null,
        status: this.mapInvoiceStatus(i.status),
      })),
    };
  }

  async getProgress(member: CurrentMemberContext): Promise<ProgressData> {
    const [stats, photos] = await Promise.all([
      this.prisma.memberBodyStats.findMany({
        where: { member_id: member.memberId },
        orderBy: { recorded_at: 'asc' },
        take: 365,
      }),
      this.prisma.memberProgressPhoto.findMany({
        where: { member_id: member.memberId },
        orderBy: { taken_at: 'desc' },
        take: 50,
      }),
    ]);

    const latest = stats[stats.length - 1];
    return {
      latest: {
        weightKg: toNumber(latest?.weight),
        bmi: toNumber(latest?.bmi),
        bodyFatPct: toNumber(latest?.body_fat),
      },
      series: stats.map((s) => this.toBodyMetric(s)),
      // NOTE: url is the stored value; signed time-limited URLs are deferred
      // until object-storage signing lands (only the member sees their own).
      photos: photos.map((p) => ({
        id: p.id,
        url: p.photo_url,
        takenAt: p.taken_at.toISOString(),
      })),
    };
  }

  async addMetric(
    member: CurrentMemberContext,
    input: { weightKg?: number; waistCm?: number; recordedAt?: string },
  ): Promise<BodyMetricData> {
    const recordedAt = input.recordedAt ? new Date(input.recordedAt) : new Date();

    let bmi: number | undefined;
    if (input.weightKg) {
      const profile = await this.prisma.memberProfile.findFirst({
        where: { member_id: member.memberId },
        select: { height: true },
      });
      const heightCm = toNumber(profile?.height);
      if (heightCm && heightCm > 0) {
        const m = heightCm / 100;
        bmi = Number((input.weightKg / (m * m)).toFixed(2));
      }
    }

    const row = await this.prisma.memberBodyStats.create({
      data: {
        gym_id: member.tenantId, // == ALS gym_id; satisfies the create type
        member_id: member.memberId,
        weight: input.weightKg,
        waist: input.waistCm,
        bmi,
        recorded_at: recordedAt,
      },
    });
    return this.toBodyMetric(row);
  }

  async getOccupancy(member: CurrentMemberContext): Promise<OccupancyData> {
    const m = await this.prisma.member.findFirst({
      where: { id: member.memberId },
      select: { branch_id: true },
    });
    if (!m) throw MemberException.notFound('Member not found.');
    return this.occupancyForBranch(m.branch_id);
  }

  async getHome(member: CurrentMemberContext): Promise<HomeDashboardData> {
    const m = await this.prisma.member.findFirst({
      where: { id: member.memberId },
      select: { full_name: true, branch_id: true },
    });
    if (!m) throw MemberException.notFound('Member not found.');

    const since = new Date(Date.now() - this.streakWindowDays * 86_400_000);
    const [membership, occupancy, checkIns, todayWorkout] = await Promise.all([
      this.membershipSummary(member),
      this.occupancyForBranch(m.branch_id),
      this.prisma.checkIn.findMany({
        where: { member_id: member.memberId, checked_in_at: { gte: since } },
        select: { checked_in_at: true },
      }),
      this.workouts.getTodaySummary(member),
    ]);

    return {
      greeting: greeting(m.full_name),
      membership,
      streak: { days: computeStreakDays(checkIns.map((c) => c.checked_in_at)) },
      todayWorkout,
      // Class domain is Phase 2 (flagged) — null-safe per contract.
      nextClass: null,
      occupancy,
    };
  }

  // ── helpers ────────────────────────────────────────────────────

  private async membershipSummary(
    member: CurrentMemberContext,
  ): Promise<HomeDashboardData['membership']> {
    const ms = await this.prisma.memberMembership.findFirst({
      where: { member_id: member.memberId },
      orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
      select: { status: true, end_date: true },
    });
    if (!ms) return undefined;
    return {
      status: mapMembershipStatus(ms.status, ms.end_date),
      expiresOn: ms.end_date?.toISOString().slice(0, 10),
      daysLeft: daysUntil(ms.end_date),
    };
  }

  private async occupancyForBranch(branchId: string): Promise<OccupancyData> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [current, settings] = await Promise.all([
      // Approximation: counts today's check-ins without a recorded check-out.
      // Where gyms don't record check-outs this trends toward "visited today".
      this.prisma.checkIn.count({
        where: {
          branch_id: branchId,
          checked_in_at: { gte: startOfToday },
          check_out_at: null,
        },
      }),
      this.prisma.branchSettings.findFirst({
        where: { branch_id: branchId },
        select: { checkin_policy: true },
      }),
    ]);

    const capacity =
      Number((settings?.checkin_policy as any)?.max_occupancy ?? 0) || 0;

    return {
      current,
      capacity,
      level: occupancyLevel(current, capacity),
      updatedAt: new Date().toISOString(),
    };
  }

  private toBodyMetric(s: {
    id: string;
    weight: unknown;
    bmi: unknown;
    waist: unknown;
    recorded_at: Date;
  }): BodyMetricData {
    return {
      id: s.id,
      weightKg: toNumber(s.weight),
      bmi: toNumber(s.bmi),
      waistCm: toNumber(s.waist),
      recordedAt: s.recorded_at.toISOString(),
    };
  }

  private mapInvoiceStatus(status: string): 'paid' | 'pending' | 'failed' {
    if (status === 'paid') return 'paid';
    if (status === 'pending' || status === 'partial') return 'pending';
    return 'failed';
  }
}
