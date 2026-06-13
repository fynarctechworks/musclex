import { Injectable } from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { toNumber } from './mappers';
import type {
  NutritionDayData,
  NutritionGoalData,
  NutritionMealData,
  NutritionTotalsData,
  FoodSearchData,
  FoodItemData,
  MealLogResultData,
  WaterLogResultData,
} from '../contract';

type MealItemInput = {
  foodItemId?: string;
  name: string;
  quantity?: number;
  unit?: string;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
};
type MealInput = {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  loggedAt?: string;
  notes?: string;
  items: MealItemInput[];
};
type GoalInput = {
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  waterMl?: number;
};

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER NUTRITION SERVICE (Member App V2.1)
 * ────────────────────────────────────────────────────────────────
 *
 * Daily nutrition for the member core loop: read today's goal/totals/meals/
 * water, search the gym's food catalog, and log meals + water. Every query is
 * member_id-scoped on top of the gym_id the tenant extension injects — the
 * extension only enforces gym_id, so member ownership is added explicitly here
 * exactly as the workout service does. Writes are offline-safe: a (gym_id,
 * client_key) unique makes a replayed outbox request return the original row
 * instead of double-counting.
 */
@Injectable()
export class MemberNutritionService {
  constructor(private readonly tenant: TenantPrisma) {}

  /** Today's nutrition: goal (created with defaults on first read), running
   * macro totals, total water, and the logged meals. */
  async getToday(member: CurrentMemberContext): Promise<NutritionDayData> {
    const { start, end } = dayBounds();
    const goal = await this.ensureGoal(member);

    const meals = await this.tenant.client.mealLog.findMany({
      where: { member_id: member.memberId, logged_at: { gte: start, lt: end } },
      orderBy: { logged_at: 'asc' },
      include: { items: true },
    });

    const water = await this.tenant.client.waterLog.findMany({
      where: { member_id: member.memberId, logged_at: { gte: start, lt: end } },
      select: { amount_ml: true },
    });

    // Inferred concrete type (numbers, not the contract's optional widening) so
    // the totals below sum cleanly; still assignable to NutritionMealData[].
    const mealData = meals.map((m) => {
      const items = m.items.map((it) => ({
        id: it.id,
        foodItemId: it.food_item_id ?? null,
        name: it.name,
        quantity: toNumber(it.quantity) ?? 0,
        unit: it.unit,
        kcal: toNumber(it.kcal) ?? 0,
        proteinG: toNumber(it.protein_g) ?? 0,
        carbsG: toNumber(it.carbs_g) ?? 0,
        fatG: toNumber(it.fat_g) ?? 0,
      }));
      return {
        id: m.id,
        mealType: m.meal_type as NutritionMealData['mealType'],
        loggedAt: m.logged_at.toISOString(),
        notes: m.notes ?? null,
        items,
        totals: sumTotals(items),
      };
    });

    const totals = sumTotals(mealData.flatMap((m) => m.items));
    const waterMl = water.reduce((a, w) => a + w.amount_ml, 0);

    return {
      date: start.toISOString().slice(0, 10),
      goal,
      totals,
      waterMl,
      meals: mealData,
    };
  }

  /** Compact today summary for the Home dashboard card. Read-only — unlike
   * getToday() it does NOT create a default goal (Home loads shouldn't write);
   * it falls back to the schema defaults when no goal exists yet. */
  async getTodaySummary(member: CurrentMemberContext): Promise<{
    kcal: number;
    kcalGoal: number;
    waterMl: number;
    waterGoal: number;
  }> {
    const { start, end } = dayBounds();
    const [goalRow, meals, water] = await Promise.all([
      this.tenant.client.nutritionGoal.findFirst({ where: { member_id: member.memberId } }),
      this.tenant.client.mealLog.findMany({
        where: { member_id: member.memberId, logged_at: { gte: start, lt: end } },
        select: { items: { select: { kcal: true } } },
      }),
      this.tenant.client.waterLog.findMany({
        where: { member_id: member.memberId, logged_at: { gte: start, lt: end } },
        select: { amount_ml: true },
      }),
    ]);
    const kcal = Math.round(
      meals.flatMap((m) => m.items).reduce((a, i) => a + (toNumber(i.kcal) ?? 0), 0),
    );
    return {
      kcal,
      kcalGoal: goalRow?.kcal_target ?? 2000,
      waterMl: water.reduce((a, w) => a + w.amount_ml, 0),
      waterGoal: goalRow?.water_ml_target ?? 2500,
    };
  }

  /** Search the gym's food catalog (name/brand). Empty query → recent foods. */
  async searchFoods(
    member: CurrentMemberContext,
    q?: string,
  ): Promise<FoodSearchData> {
    const term = (q ?? '').trim();
    const rows = await this.tenant.client.foodItem.findMany({
      where: {
        is_active: true,
        ...(term
          ? {
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { brand: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: term ? { name: 'asc' } : { updated_at: 'desc' },
      take: 30,
    });
    return { foods: rows.map(mapFood) };
  }

  /** Log a meal with its items. Idempotent on (gym_id, client_key). */
  async logMeal(
    member: CurrentMemberContext,
    input: MealInput,
    idempotencyKey?: string,
  ): Promise<MealLogResultData> {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw MemberException.badRequest('At least one meal item is required.');
    }

    if (idempotencyKey) {
      const existing = await this.tenant.client.mealLog.findFirst({
        where: { client_key: idempotencyKey, member_id: member.memberId },
        select: { id: true },
      });
      if (existing) return { mealId: existing.id };
    }

    // Resolve macros for each item: explicit client values win; otherwise scale
    // the catalog food's per-serving macros by quantity (quantity = servings).
    const items = await Promise.all(
      input.items.map(async (it) => {
        const macros = await this.resolveItemMacros(it);
        return {
          gym_id: member.tenantId,
          food_item_id: it.foodItemId ?? null,
          name: it.name,
          quantity: it.quantity ?? 1,
          unit: it.unit ?? 'serving',
          ...macros,
        };
      }),
    );

    const meal = await this.tenant.client.mealLog.create({
      data: {
        gym_id: member.tenantId,
        member_id: member.memberId,
        meal_type: input.mealType,
        logged_at: input.loggedAt ? new Date(input.loggedAt) : new Date(),
        notes: input.notes ?? null,
        client_key: idempotencyKey ?? null,
        items: { create: items },
      },
      select: { id: true },
    });

    return { mealId: meal.id };
  }

  /** Log water intake. Idempotent on (gym_id, client_key). Returns today's total. */
  async logWater(
    member: CurrentMemberContext,
    amountMl: number,
    loggedAt?: string,
    idempotencyKey?: string,
  ): Promise<WaterLogResultData> {
    if (!(amountMl > 0)) {
      throw MemberException.badRequest('amountMl must be greater than 0.');
    }

    let waterId: string;
    const existing = idempotencyKey
      ? await this.tenant.client.waterLog.findFirst({
          where: { client_key: idempotencyKey, member_id: member.memberId },
          select: { id: true },
        })
      : null;

    if (existing) {
      waterId = existing.id;
    } else {
      const row = await this.tenant.client.waterLog.create({
        data: {
          gym_id: member.tenantId,
          member_id: member.memberId,
          amount_ml: Math.round(amountMl),
          logged_at: loggedAt ? new Date(loggedAt) : new Date(),
          client_key: idempotencyKey ?? null,
        },
        select: { id: true },
      });
      waterId = row.id;
    }

    const { start, end } = dayBounds();
    const today = await this.tenant.client.waterLog.findMany({
      where: { member_id: member.memberId, logged_at: { gte: start, lt: end } },
      select: { amount_ml: true },
    });
    return { waterId, totalMl: today.reduce((a, w) => a + w.amount_ml, 0) };
  }

  /** Upsert the member's daily goal (one row per member). */
  async setGoal(
    member: CurrentMemberContext,
    input: GoalInput,
  ): Promise<NutritionGoalData> {
    const existing = await this.tenant.client.nutritionGoal.findFirst({
      where: { member_id: member.memberId },
      select: { id: true },
    });

    const data = {
      ...(input.kcal != null ? { kcal_target: Math.round(input.kcal) } : {}),
      ...(input.proteinG != null ? { protein_g_target: Math.round(input.proteinG) } : {}),
      ...(input.carbsG != null ? { carbs_g_target: Math.round(input.carbsG) } : {}),
      ...(input.fatG != null ? { fat_g_target: Math.round(input.fatG) } : {}),
      ...(input.waterMl != null ? { water_ml_target: Math.round(input.waterMl) } : {}),
    };

    const row = existing
      ? await this.tenant.client.nutritionGoal.update({ where: { id: existing.id }, data })
      : await this.tenant.client.nutritionGoal.create({
          data: { gym_id: member.tenantId, member_id: member.memberId, ...data },
        });

    return mapGoal(row);
  }

  // ── helpers ────────────────────────────────────────────────────

  /** Read the member's goal, creating it with defaults on first access. */
  private async ensureGoal(
    member: CurrentMemberContext,
  ): Promise<NutritionGoalData> {
    const existing = await this.tenant.client.nutritionGoal.findFirst({
      where: { member_id: member.memberId },
    });
    if (existing) return mapGoal(existing);
    const created = await this.tenant.client.nutritionGoal.create({
      data: { gym_id: member.tenantId, member_id: member.memberId },
    });
    return mapGoal(created);
  }

  /** Macros for one logged item: explicit client values win; else scale the
   * catalog food's per-serving macros by quantity (servings). */
  private async resolveItemMacros(it: MealItemInput): Promise<{
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }> {
    const hasExplicit =
      it.kcal != null || it.proteinG != null || it.carbsG != null || it.fatG != null;
    if (hasExplicit) {
      return {
        kcal: it.kcal ?? 0,
        protein_g: it.proteinG ?? 0,
        carbs_g: it.carbsG ?? 0,
        fat_g: it.fatG ?? 0,
      };
    }
    if (it.foodItemId) {
      // findFirst auto-scopes by gym_id; a cross-gym id simply resolves to null.
      const food = await this.tenant.client.foodItem.findFirst({
        where: { id: it.foodItemId },
      });
      if (food) {
        const servings = it.quantity ?? 1;
        return {
          kcal: (toNumber(food.kcal) ?? 0) * servings,
          protein_g: (toNumber(food.protein_g) ?? 0) * servings,
          carbs_g: (toNumber(food.carbs_g) ?? 0) * servings,
          fat_g: (toNumber(food.fat_g) ?? 0) * servings,
        };
      }
    }
    return { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  }
}

// ── module-local pure helpers ──────────────────────────────────────

function dayBounds(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

function sumTotals(
  items: { kcal: number; proteinG: number; carbsG: number; fatG: number }[],
): NutritionTotalsData {
  return items.reduce(
    (acc, it) => ({
      kcal: round1(acc.kcal + it.kcal),
      proteinG: round1(acc.proteinG + it.proteinG),
      carbsG: round1(acc.carbsG + it.carbsG),
      fatG: round1(acc.fatG + it.fatG),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function mapGoal(row: {
  kcal_target: number;
  protein_g_target: number;
  carbs_g_target: number;
  fat_g_target: number;
  water_ml_target: number;
}): NutritionGoalData {
  return {
    kcal: row.kcal_target,
    proteinG: row.protein_g_target,
    carbsG: row.carbs_g_target,
    fatG: row.fat_g_target,
    waterMl: row.water_ml_target,
  };
}

function mapFood(row: {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_size: unknown;
  serving_unit: string;
  kcal: unknown;
  protein_g: unknown;
  carbs_g: unknown;
  fat_g: unknown;
  source: string;
}): FoodItemData {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? null,
    barcode: row.barcode ?? null,
    servingSize: toNumber(row.serving_size) ?? 0,
    servingUnit: row.serving_unit,
    kcal: toNumber(row.kcal) ?? 0,
    proteinG: toNumber(row.protein_g) ?? 0,
    carbsG: toNumber(row.carbs_g) ?? 0,
    fatG: toNumber(row.fat_g) ?? 0,
    source: row.source as FoodItemData['source'],
  };
}
