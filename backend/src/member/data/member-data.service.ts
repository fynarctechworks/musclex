import { Injectable } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { MemberException } from '../common/member-exception';
import { MemberWorkoutService } from './member-workout.service';
import { MemberNutritionService } from './member-nutrition.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import type {
  MemberProfileData,
  MembershipData,
  ProgressData,
  BodyMetricData,
  OccupancyData,
  HomeDashboardData,
  GymLocationsData,
  GymLocationData,
  ClassSummaryData,
} from '../contract';
import { MemberStreakService } from './member-streak.service';
import {
  PersonalizationService,
  ageFromDob,
} from './personalization.service';
import { UpdateProfileDto } from './dto';
import {
  toNumber,
  mapGoal,
  primaryGoalToLegacy,
  legacyToPrimaryGoal,
  mapMembershipStatus,
  daysUntil,
  occupancyLevel,
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
  constructor(
    private readonly pub: PublicPrismaService,
    private readonly tenant: TenantPrisma,
    private readonly workouts: MemberWorkoutService,
    private readonly nutrition: MemberNutritionService,
    private readonly streak: MemberStreakService,
    private readonly personalization: PersonalizationService,
  ) {}

  async getProfile(member: CurrentMemberContext): Promise<MemberProfileData> {
    const m = await this.tenant.client.member.findFirst({
      where: { id: member.memberId },
      include: { profile: true },
    });
    if (!m) throw MemberException.notFound('Member not found.');

    const studio = await this.pub.studio.findUnique({
      where: { id: member.tenantId },
      select: { name: true },
    });

    return this.buildProfile(m, studio?.name ?? undefined);
  }

  /**
   * Partial profile update — powers per-step onboarding auto-save and later
   * edits. Writes gender/DOB to `members` and the rest to `member_profiles`
   * (upsert; gym_id injected on create). When a personalization-relevant field
   * changes (or onboarding completes), recomputes the nutrition targets and
   * upserts the member's NutritionGoal so Home/Nutrition reflect them. Member is
   * always from the token — no client id is trusted.
   */
  async updateProfile(
    member: CurrentMemberContext,
    dto: UpdateProfileDto,
  ): Promise<MemberProfileData> {
    // members table — only gender / date_of_birth live here.
    const memberData: { gender?: string; date_of_birth?: Date } = {};
    if (dto.gender !== undefined) memberData.gender = dto.gender;
    if (dto.dateOfBirth !== undefined) memberData.date_of_birth = new Date(dto.dateOfBirth);
    if (Object.keys(memberData).length) {
      await this.tenant.client.member.update({ where: { id: member.memberId }, data: memberData });
    }

    // member_profiles — the rest of the fitness profile.
    const profileSet: Record<string, unknown> = {};
    if (dto.heightCm !== undefined) profileSet.height = dto.heightCm;
    if (dto.weightKg !== undefined) profileSet.weight = dto.weightKg;
    if (dto.heightUnit !== undefined) profileSet.height_unit = dto.heightUnit;
    if (dto.weightUnit !== undefined) profileSet.weight_unit = dto.weightUnit;
    if (dto.goals !== undefined) profileSet.goals = dto.goals;
    if (dto.primaryGoal !== undefined) {
      // keep legacy fitness_goal in sync so admin tooling + the `goal` field work.
      const legacy = primaryGoalToLegacy(dto.primaryGoal);
      if (legacy) profileSet.fitness_goal = legacy;
      // if no explicit goals[] given, seed it with the primary.
      if (dto.goals === undefined) profileSet.goals = [dto.primaryGoal];
    }
    if (dto.activityLevel !== undefined) profileSet.activity_level = dto.activityLevel;
    if (dto.trainingExperience !== undefined) profileSet.training_experience = dto.trainingExperience;
    if (dto.workoutPreferences !== undefined) profileSet.workout_preferences = dto.workoutPreferences;
    if (dto.limitations !== undefined) profileSet.medical_conditions = dto.limitations;
    if (dto.onboardingStep !== undefined) profileSet.onboarding_step = dto.onboardingStep;
    if (dto.onboardingComplete) {
      profileSet.onboarding_completed_at = new Date();
      profileSet.onboarding_step = null; // clear the resume marker on completion
    }

    await this.tenant.client.memberProfile.upsert({
      where: { member_id: member.memberId },
      create: { gym_id: member.tenantId, member_id: member.memberId, ...profileSet },
      update: profileSet,
    });

    // Recompute personalization when a relevant input changed (or on completion)
    // and persist the nutrition targets so the rest of the app reflects them.
    const touchedPersonalization =
      dto.gender !== undefined ||
      dto.dateOfBirth !== undefined ||
      dto.heightCm !== undefined ||
      dto.weightKg !== undefined ||
      dto.primaryGoal !== undefined ||
      dto.goals !== undefined ||
      dto.activityLevel !== undefined ||
      dto.trainingExperience !== undefined ||
      !!dto.onboardingComplete;

    const fresh = await this.tenant.client.member.findFirst({
      where: { id: member.memberId },
      include: { profile: true },
    });
    if (!fresh) throw MemberException.notFound('Member not found.');

    if (touchedPersonalization) {
      const rec = this.recommendationFor(fresh);
      if (rec?.dailyCalories) {
        await this.nutrition.setGoal(member, {
          kcal: rec.dailyCalories,
          proteinG: rec.proteinG,
          carbsG: rec.carbsG,
          fatG: rec.fatG,
          waterMl: rec.waterMl,
        });
      }
    }

    const studio = await this.pub.studio.findUnique({
      where: { id: member.tenantId },
      select: { name: true },
    });
    return this.buildProfile(fresh, studio?.name ?? undefined);
  }

  /** Compose the full contract profile from a member (+ included profile) row. */
  private buildProfile(
    m: { id: string; full_name: string; phone: string; gender: string | null; date_of_birth: Date | null; profile_photo_url: string | null; profile: any },
    gymName?: string,
  ): MemberProfileData {
    const p = m.profile;
    const goals = (p?.goals ?? []) as MemberProfileData['goals'];
    const primaryGoal =
      (goals && goals.length ? goals[0] : undefined) ?? legacyToPrimaryGoal(p?.fitness_goal);

    return {
      id: m.id,
      name: m.full_name,
      phone: m.phone,
      gymName,
      // legacy compact fields (back-compat)
      goal: mapGoal(p?.fitness_goal),
      experienceLevel: (p?.training_experience as MemberProfileData['experienceLevel']) ?? undefined,
      avatarUrl: m.profile_photo_url ?? null,
      // fitness profile
      gender: (m.gender as MemberProfileData['gender']) ?? null,
      dateOfBirth: m.date_of_birth ? m.date_of_birth.toISOString().slice(0, 10) : null,
      age: ageFromDob(m.date_of_birth),
      heightCm: toNumber(p?.height),
      weightKg: toNumber(p?.weight),
      heightUnit: (p?.height_unit as MemberProfileData['heightUnit']) ?? 'cm',
      weightUnit: (p?.weight_unit as MemberProfileData['weightUnit']) ?? 'kg',
      primaryGoal,
      goals: goals ?? [],
      activityLevel: (p?.activity_level as MemberProfileData['activityLevel']) ?? null,
      trainingExperience: (p?.training_experience as MemberProfileData['trainingExperience']) ?? null,
      workoutPreferences: (p?.workout_preferences ?? []) as MemberProfileData['workoutPreferences'],
      limitations: (p?.medical_conditions ?? []) as string[],
      onboardingCompleted: !!p?.onboarding_completed_at,
      onboardingStep: p?.onboarding_step ?? null,
      recommendation: this.recommendationFor(m),
    };
  }

  /** Build the personalization block from a member (+ included profile) row. */
  private recommendationFor(m: {
    gender: string | null;
    date_of_birth: Date | null;
    profile: any;
  }): MemberProfileData['recommendation'] {
    const p = m.profile;
    const primaryGoal =
      (p?.goals?.length ? p.goals[0] : undefined) ?? legacyToPrimaryGoal(p?.fitness_goal);
    return this.personalization.compute({
      gender: m.gender as any,
      age: ageFromDob(m.date_of_birth),
      heightCm: toNumber(p?.height),
      weightKg: toNumber(p?.weight),
      activityLevel: p?.activity_level as any,
      primaryGoal: primaryGoal ?? null,
      trainingExperience: p?.training_experience as any,
    });
  }

  async getMembership(member: CurrentMemberContext): Promise<MembershipData> {
    const ms =
      (await this.tenant.client.memberMembership.findFirst({
        where: { member_id: member.memberId, status: 'active' },
        include: { plan: true },
        orderBy: { created_at: 'desc' },
      })) ??
      (await this.tenant.client.memberMembership.findFirst({
        where: { member_id: member.memberId },
        include: { plan: true },
        orderBy: { created_at: 'desc' },
      }));
    if (!ms) throw MemberException.notFound('No membership found.');

    const invoices = await this.tenant.client.memberInvoice.findMany({
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
      this.tenant.client.memberBodyStats.findMany({
        where: { member_id: member.memberId },
        orderBy: { recorded_at: 'asc' },
        take: 365,
      }),
      this.tenant.client.memberProgressPhoto.findMany({
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
      const profile = await this.tenant.client.memberProfile.findFirst({
        where: { member_id: member.memberId },
        select: { height: true },
      });
      const heightCm = toNumber(profile?.height);
      if (heightCm && heightCm > 0) {
        const m = heightCm / 100;
        bmi = Number((input.weightKg / (m * m)).toFixed(2));
      }
    }

    const row = await this.tenant.client.memberBodyStats.create({
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
    const m = await this.tenant.client.member.findFirst({
      where: { id: member.memberId },
      select: { branch_id: true },
    });
    if (!m) throw MemberException.notFound('Member not found.');
    return this.occupancyForBranch(m.branch_id);
  }

  /**
   * Branches of the member's gym, for the in-app location finder. gym_id is
   * auto-injected by the tenant-scoped Prisma client, so this can never return
   * another gym's branches. Decimal lat/lng are coerced to plain numbers.
   * The app sorts by distance from the device; the BFF returns an unranked list.
   */
  async getLocations(_member: CurrentMemberContext): Promise<GymLocationsData> {
    const branches = await this.tenant.client.branch.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        phone: true,
        status: true,
      },
    });

    return {
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address ?? undefined,
        city: b.city ?? undefined,
        latitude: toNumber(b.latitude),
        longitude: toNumber(b.longitude),
        phone: b.phone ?? undefined,
        status: b.status as GymLocationData['status'],
      })),
    };
  }

  async getHome(member: CurrentMemberContext): Promise<HomeDashboardData> {
    const m = await this.tenant.client.member.findFirst({
      where: { id: member.memberId },
      select: { full_name: true, branch_id: true },
    });
    if (!m) throw MemberException.notFound('Member not found.');

    const [membership, occupancy, streakDays, todayActivity, todayWorkout, nextClass, nutrition] =
      await Promise.all([
        this.membershipSummary(member),
        this.occupancyForBranch(m.branch_id),
        this.streak.getStreakDays(member.memberId),
        this.streak.getTodayActivity(member.memberId),
        this.workouts.getTodaySummary(member),
        this.nextClassForBranch(m.branch_id),
        this.nutrition.getTodaySummary(member),
      ]);

    const didSomethingToday =
      todayActivity.checkedIn || todayActivity.workoutLogged || todayActivity.mealLogged;

    return {
      greeting: greeting(m.full_name),
      membership,
      streak: { days: streakDays },
      today: {
        ...todayActivity,
        // A streak only counts as "at risk" if it exists and nothing has kept it alive yet today.
        streakAtRisk: streakDays > 0 && !didSomethingToday,
      },
      todayWorkout,
      nextClass,
      occupancy,
      nutrition,
    };
  }

  /**
   * The next upcoming class at the member's branch (or null). Surfaces the same
   * legacy Class/ClassEnrollment rows the admin Schedule writes, so what the gym
   * staff create appears on the member's Home. gym_id is auto-injected by the
   * tenant-scoped Prisma client and we additionally pin branch_id — this can
   * never read another gym's (or another branch's) classes. `seatsLeft` counts
   * only ENROLLED rows (waitlisted/cancelled don't occupy a seat).
   */
  private async nextClassForBranch(
    branchId: string,
  ): Promise<ClassSummaryData | null> {
    const cls = await this.tenant.client.class.findFirst({
      where: {
        branch_id: branchId,
        status: { not: 'cancelled' },
        starts_at: { gte: new Date() },
      },
      orderBy: { starts_at: 'asc' },
      select: { id: true, name: true, starts_at: true, capacity: true },
    });
    if (!cls) return null;

    const enrolled = await this.tenant.client.classEnrollment.count({
      where: { class_id: cls.id, status: 'enrolled' },
    });

    return {
      id: cls.id,
      title: cls.name,
      startsAt: cls.starts_at.toISOString(),
      seatsLeft: Math.max(0, cls.capacity - enrolled),
    };
  }

  // ── helpers ────────────────────────────────────────────────────

  private async membershipSummary(
    member: CurrentMemberContext,
  ): Promise<HomeDashboardData['membership']> {
    const ms = await this.tenant.client.memberMembership.findFirst({
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
      this.tenant.client.checkIn.count({
        where: {
          branch_id: branchId,
          checked_in_at: { gte: startOfToday },
          check_out_at: null,
        },
      }),
      this.tenant.client.branchSettings.findFirst({
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
