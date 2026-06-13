import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../node_modules/.prisma/client-public';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { MemberException } from '../common/member-exception';
import type {
  WeightInputDto,
  WaterInputDto,
  GoalInputDto,
  GoalUpdateDto,
  HealthDailyInputDto,
} from './dto';
import type {
  WeightSeriesData,
  WeightEntryData,
  WaterDayData,
  GoalData,
  GoalListData,
  HealthDayData,
  HealthSeriesData,
} from '../contract';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER PUBLIC HEALTH SERVICE
 * ────────────────────────────────────────────────────────────────
 *
 * Personal (gym-less) tracking for the canonical app_user: weight, water, goals,
 * and on-device daily health rollups. Lives in the PUBLIC schema and is keyed by
 * app_user_id — NOT a tenant model, so gym_id is never injected. EVERY query here
 * filters by the appUserId from the verified token (the cross-user gate); no id is
 * ever taken from the client.
 *
 * Available to public users and gym members alike (the app_user is the person).
 */
@Injectable()
export class MemberPublicHealthService {
  constructor(private readonly pub: PublicPrismaService) {}

  /** UTC midnight for an ISO date string, or today when omitted. */
  private day(dateStr?: string | null): Date {
    const base = dateStr ? new Date(dateStr) : new Date();
    return new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()),
    );
  }

  private ymd(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private num(v: Prisma.Decimal | number | null | undefined): number | null {
    if (v === null || v === undefined) return null;
    return typeof v === 'number' ? v : Number(v);
  }

  // ── Weight ──────────────────────────────────────────────────────
  async getWeight(appUserId: string, days = 90): Promise<WeightSeriesData> {
    const cutoff = this.day();
    cutoff.setUTCDate(cutoff.getUTCDate() - Math.max(1, Math.min(days, 365)));
    const rows = await this.pub.appUserWeightLog.findMany({
      where: { app_user_id: appUserId, logged_on: { gte: cutoff } },
      orderBy: { logged_on: 'desc' },
    });
    const entries: WeightEntryData[] = rows.map((r) => ({
      date: this.ymd(r.logged_on),
      weightKg: Number(r.weight_kg),
      bodyFatPct: this.num(r.body_fat_pct),
      note: r.note,
    }));
    return { latest: entries[0] ?? null, entries };
  }

  async logWeight(
    appUserId: string,
    dto: WeightInputDto,
  ): Promise<WeightEntryData> {
    const logged_on = this.day(dto.date);
    const row = await this.pub.appUserWeightLog.upsert({
      where: { app_user_id_logged_on: { app_user_id: appUserId, logged_on } },
      create: {
        app_user_id: appUserId,
        logged_on,
        weight_kg: dto.weightKg,
        body_fat_pct: dto.bodyFatPct ?? null,
        note: dto.note ?? null,
      },
      update: {
        weight_kg: dto.weightKg,
        body_fat_pct: dto.bodyFatPct ?? null,
        note: dto.note ?? null,
      },
    });
    return {
      date: this.ymd(row.logged_on),
      weightKg: Number(row.weight_kg),
      bodyFatPct: this.num(row.body_fat_pct),
      note: row.note,
    };
  }

  // ── Water ───────────────────────────────────────────────────────
  async getWater(appUserId: string, dateStr?: string): Promise<WaterDayData> {
    const logged_on = this.day(dateStr);
    const row = await this.pub.appUserWaterLog.findUnique({
      where: { app_user_id_logged_on: { app_user_id: appUserId, logged_on } },
    });
    return {
      date: this.ymd(logged_on),
      amountMl: row?.amount_ml ?? 0,
      goalMl: row?.goal_ml ?? null,
    };
  }

  async logWater(appUserId: string, dto: WaterInputDto): Promise<WaterDayData> {
    const logged_on = this.day(dto.date);
    const mode = dto.mode ?? 'add';
    const row = await this.pub.appUserWaterLog.upsert({
      where: { app_user_id_logged_on: { app_user_id: appUserId, logged_on } },
      create: {
        app_user_id: appUserId,
        logged_on,
        amount_ml: Math.max(0, dto.amountMl),
        goal_ml: dto.goalMl ?? null,
      },
      update: {
        amount_ml:
          mode === 'add' ? { increment: dto.amountMl } : dto.amountMl,
        ...(dto.goalMl !== undefined ? { goal_ml: dto.goalMl } : {}),
      },
    });
    return {
      date: this.ymd(row.logged_on),
      amountMl: row.amount_ml,
      goalMl: row.goal_ml,
    };
  }

  // ── Goals ───────────────────────────────────────────────────────
  private toGoal(r: {
    id: string;
    type: string;
    title: string | null;
    target_value: Prisma.Decimal | null;
    current_value: Prisma.Decimal | null;
    unit: string | null;
    target_date: Date | null;
    status: string;
  }): GoalData {
    return {
      id: r.id,
      type: r.type as GoalData['type'],
      title: r.title,
      targetValue: this.num(r.target_value),
      currentValue: this.num(r.current_value),
      unit: r.unit,
      targetDate: r.target_date ? this.ymd(r.target_date) : null,
      status: r.status as GoalData['status'],
    };
  }

  async listGoals(appUserId: string): Promise<GoalListData> {
    const rows = await this.pub.appUserGoal.findMany({
      where: { app_user_id: appUserId },
      orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
    });
    return { goals: rows.map((r) => this.toGoal(r)) };
  }

  async createGoal(appUserId: string, dto: GoalInputDto): Promise<GoalData> {
    const row = await this.pub.appUserGoal.create({
      data: {
        app_user_id: appUserId,
        type: dto.type,
        title: dto.title ?? null,
        target_value: dto.targetValue ?? null,
        current_value: dto.currentValue ?? 0,
        unit: dto.unit ?? null,
        target_date: dto.targetDate ? this.day(dto.targetDate) : null,
      },
    });
    return this.toGoal(row);
  }

  async updateGoal(
    appUserId: string,
    goalId: string,
    dto: GoalUpdateDto,
  ): Promise<GoalData> {
    // Ownership gate: only the caller's own goal can be updated.
    const existing = await this.pub.appUserGoal.findFirst({
      where: { id: goalId, app_user_id: appUserId },
      select: { id: true },
    });
    if (!existing) throw MemberException.notFound('Goal not found.');

    const row = await this.pub.appUserGoal.update({
      where: { id: goalId },
      data: {
        ...(dto.currentValue !== undefined ? { current_value: dto.currentValue } : {}),
        ...(dto.targetValue !== undefined ? { target_value: dto.targetValue } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    return this.toGoal(row);
  }

  // ── On-device health daily ──────────────────────────────────────
  private toHealthDay(r: {
    logged_on: Date;
    steps: number;
    active_calories: Prisma.Decimal | null;
    distance_m: Prisma.Decimal | null;
    resting_heart_rate: number | null;
    source: string | null;
  }): HealthDayData {
    return {
      date: this.ymd(r.logged_on),
      steps: r.steps,
      activeCalories: this.num(r.active_calories),
      distanceM: this.num(r.distance_m),
      restingHeartRate: r.resting_heart_rate,
      source: r.source,
    };
  }

  async getHealthDaily(appUserId: string, days = 30): Promise<HealthSeriesData> {
    const cutoff = this.day();
    cutoff.setUTCDate(cutoff.getUTCDate() - Math.max(1, Math.min(days, 365)));
    const rows = await this.pub.appUserHealthDaily.findMany({
      where: { app_user_id: appUserId, logged_on: { gte: cutoff } },
      orderBy: { logged_on: 'desc' },
    });
    return { days: rows.map((r) => this.toHealthDay(r)) };
  }

  async upsertHealthDaily(
    appUserId: string,
    dto: HealthDailyInputDto,
  ): Promise<HealthDayData> {
    const logged_on = this.day(dto.date);
    const row = await this.pub.appUserHealthDaily.upsert({
      where: { app_user_id_logged_on: { app_user_id: appUserId, logged_on } },
      create: {
        app_user_id: appUserId,
        logged_on,
        steps: dto.steps,
        active_calories: dto.activeCalories ?? null,
        distance_m: dto.distanceM ?? null,
        resting_heart_rate: dto.restingHeartRate ?? null,
        source: dto.source ?? null,
      },
      update: {
        steps: dto.steps,
        active_calories: dto.activeCalories ?? null,
        distance_m: dto.distanceM ?? null,
        resting_heart_rate: dto.restingHeartRate ?? null,
        source: dto.source ?? null,
      },
    });
    return this.toHealthDay(row);
  }
}
