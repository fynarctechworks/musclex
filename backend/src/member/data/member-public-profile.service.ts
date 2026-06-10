import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MemberException } from '../common/member-exception';
import {
  PersonalizationService,
  ageFromDob,
} from './personalization.service';
import type {
  MemberProfileData,
  UpdateProfileBody,
  WeeklyProgressData,
  ToolsComputeBody,
  RecommendationData,
} from '../contract';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER PUBLIC PROFILE SERVICE (Phase 7.1)
 * ────────────────────────────────────────────────────────────────
 *
 * The gym-less counterpart of MemberDataService.getProfile/updateProfile: the
 * fitness profile for an app_user, stored on public.app_users (current weight is
 * the latest app_user_weight_logs row). Returns the SAME MemberProfile contract
 * shape so the member app's existing onboarding flow + home cards work unchanged.
 * Reuses the shared (gym-agnostic) PersonalizationService for the recommendation.
 */
@Injectable()
export class MemberPublicProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personalization: PersonalizationService,
  ) {}

  private num(v: Prisma.Decimal | number | null | undefined): number | null {
    if (v === null || v === undefined) return null;
    return typeof v === 'number' ? v : Number(v);
  }

  private todayUtc(): Date {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  }

  private ymd(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /** Pure calculator (BMI/BMR/calorie/water/protein) — single source via PersonalizationService. */
  computeTools(input: ToolsComputeBody): RecommendationData {
    return (
      this.personalization.compute({
        gender: input.gender as never,
        age: input.age ?? null,
        heightCm: input.heightCm ?? null,
        weightKg: input.weightKg ?? null,
        activityLevel: input.activityLevel as never,
        primaryGoal: input.primaryGoal ?? null,
        trainingExperience: input.trainingExperience as never,
      }) ?? {}
    );
  }

  /**
   * Weekly progress for retention (Phase 7.7): active days + consistency over the
   * last 7 days (a day is "active" if it has any event / water / weight / steps),
   * plus 30-day weight change. Works for every app user.
   */
  async weekly(appUserId: string): Promise<WeeklyProgressData> {
    const today = this.todayUtc();
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 6); // 7-day window incl. today
    const month = new Date(today);
    month.setUTCDate(month.getUTCDate() - 30);

    const [water, weight, health, events] = await Promise.all([
      this.prisma.appUserWaterLog.findMany({
        where: { app_user_id: appUserId, logged_on: { gte: start } },
        select: { logged_on: true },
      }),
      this.prisma.appUserWeightLog.findMany({
        where: { app_user_id: appUserId, logged_on: { gte: start } },
        select: { logged_on: true },
      }),
      this.prisma.appUserHealthDaily.findMany({
        where: { app_user_id: appUserId, logged_on: { gte: start } },
        select: { logged_on: true, steps: true },
      }),
      this.prisma.appUserEvent.findMany({
        where: { app_user_id: appUserId, occurred_at: { gte: start } },
        select: { occurred_at: true },
      }),
    ]);

    const active = new Set<string>();
    water.forEach((r) => active.add(this.ymd(r.logged_on)));
    weight.forEach((r) => active.add(this.ymd(r.logged_on)));
    health.filter((r) => r.steps > 0).forEach((r) => active.add(this.ymd(r.logged_on)));
    events.forEach((r) => active.add(this.ymd(r.occurred_at)));

    const points: WeeklyProgressData['points'] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const key = this.ymd(d);
      points.push({ day: key, active: active.has(key) });
    }
    const daysActive = points.filter((p) => p.active).length;

    const wlogs = await this.prisma.appUserWeightLog.findMany({
      where: { app_user_id: appUserId, logged_on: { gte: month } },
      orderBy: { logged_on: 'asc' },
      select: { weight_kg: true },
    });
    const weightChangeKg =
      wlogs.length >= 2
        ? Math.round(
            (Number(wlogs[wlogs.length - 1].weight_kg) - Number(wlogs[0].weight_kg)) * 10,
          ) / 10
        : null;

    return {
      daysActive,
      weightChangeKg,
      consistencyScore: Math.round((daysActive / 7) * 100),
      points,
    };
  }

  async getProfile(appUserId: string): Promise<MemberProfileData> {
    const a = await this.prisma.appUser.findUnique({ where: { id: appUserId } });
    if (!a) throw MemberException.notFound('Account not found.');

    const latestWeight = await this.prisma.appUserWeightLog.findFirst({
      where: { app_user_id: appUserId },
      orderBy: { logged_on: 'desc' },
      select: { weight_kg: true },
    });

    return this.build(a, this.num(latestWeight?.weight_kg));
  }

  private build(
    a: {
      id: string;
      full_name: string | null;
      phone: string;
      gender: string | null;
      date_of_birth: Date | null;
      height_cm: Prisma.Decimal | null;
      height_unit: string | null;
      weight_unit: string | null;
      primary_goal: string | null;
      fitness_goals: Prisma.JsonValue;
      activity_level: string | null;
      training_experience: string | null;
      workout_preferences: Prisma.JsonValue;
      limitations: Prisma.JsonValue;
      onboarding_state: string;
      onboarding_step: string | null;
    },
    weightKg: number | null,
  ): MemberProfileData {
    const goals = (Array.isArray(a.fitness_goals) ? a.fitness_goals : []) as MemberProfileData['goals'];
    const primaryGoal =
      (a.primary_goal as MemberProfileData['primaryGoal']) ??
      (goals && goals.length ? goals[0] : undefined);
    const heightCm = this.num(a.height_cm);

    const recommendation = this.personalization.compute({
      gender: a.gender as never,
      age: ageFromDob(a.date_of_birth),
      heightCm,
      weightKg,
      activityLevel: a.activity_level as never,
      primaryGoal: primaryGoal ?? null,
      trainingExperience: a.training_experience as never,
    });

    return {
      id: a.id,
      name: a.full_name ?? '',
      phone: a.phone,
      gymName: undefined,
      goal: undefined,
      experienceLevel: (a.training_experience as MemberProfileData['experienceLevel']) ?? undefined,
      avatarUrl: null,
      gender: (a.gender as MemberProfileData['gender']) ?? null,
      dateOfBirth: a.date_of_birth ? a.date_of_birth.toISOString().slice(0, 10) : null,
      age: ageFromDob(a.date_of_birth),
      heightCm,
      weightKg,
      heightUnit: (a.height_unit as MemberProfileData['heightUnit']) ?? 'cm',
      weightUnit: (a.weight_unit as MemberProfileData['weightUnit']) ?? 'kg',
      primaryGoal,
      goals: goals ?? [],
      activityLevel: (a.activity_level as MemberProfileData['activityLevel']) ?? null,
      trainingExperience: (a.training_experience as MemberProfileData['trainingExperience']) ?? null,
      workoutPreferences: (Array.isArray(a.workout_preferences)
        ? a.workout_preferences
        : []) as MemberProfileData['workoutPreferences'],
      limitations: (Array.isArray(a.limitations) ? a.limitations : []) as string[],
      onboardingCompleted: a.onboarding_state === 'completed',
      onboardingStep: a.onboarding_step ?? null,
      recommendation,
    };
  }

  async updateProfile(
    appUserId: string,
    dto: UpdateProfileBody,
  ): Promise<MemberProfileData> {
    const data: Prisma.AppUserUpdateInput = {};
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.dateOfBirth !== undefined) {
      data.date_of_birth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    }
    if (dto.heightCm !== undefined) data.height_cm = dto.heightCm;
    if (dto.heightUnit !== undefined) data.height_unit = dto.heightUnit;
    if (dto.weightUnit !== undefined) data.weight_unit = dto.weightUnit;
    if (dto.primaryGoal !== undefined) data.primary_goal = dto.primaryGoal;
    if (dto.goals !== undefined) data.fitness_goals = dto.goals as Prisma.InputJsonValue;
    if (dto.activityLevel !== undefined) data.activity_level = dto.activityLevel;
    if (dto.trainingExperience !== undefined) data.training_experience = dto.trainingExperience;
    if (dto.workoutPreferences !== undefined) {
      data.workout_preferences = dto.workoutPreferences as Prisma.InputJsonValue;
    }
    if (dto.limitations !== undefined) data.limitations = dto.limitations as Prisma.InputJsonValue;
    if (dto.onboardingStep !== undefined) data.onboarding_step = dto.onboardingStep;
    if (dto.onboardingComplete) {
      data.onboarding_state = 'completed';
      data.onboarding_step = null;
    }

    await this.prisma.appUser.update({ where: { id: appUserId }, data });

    // Advance to in_progress on first data write (never downgrade a completed one).
    if (!dto.onboardingComplete) {
      await this.prisma.appUser.updateMany({
        where: { id: appUserId, onboarding_state: 'not_started' },
        data: { onboarding_state: 'in_progress' },
      });
    }

    // Weight is tracked, not a profile column — record today's weigh-in.
    if (dto.weightKg !== undefined && dto.weightKg !== null) {
      const logged_on = this.todayUtc();
      await this.prisma.appUserWeightLog.upsert({
        where: { app_user_id_logged_on: { app_user_id: appUserId, logged_on } },
        create: { app_user_id: appUserId, logged_on, weight_kg: dto.weightKg },
        update: { weight_kg: dto.weightKg },
      });
    }

    return this.getProfile(appUserId);
  }
}
