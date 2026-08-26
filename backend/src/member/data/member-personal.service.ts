import { Injectable } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * ────────────────────────────────────────────────────────────────
 * PERSONAL TRAINING & NUTRITION — for members with no gym
 * ────────────────────────────────────────────────────────────────
 *
 * The gym versions of routines and meal logging live in a studio schema behind
 * a gym_id, so someone who belongs to no gym gets a clean 403 on every one of
 * them. That made two of the four things an independent member installs this
 * app for — routines and meals — impossible.
 *
 * These are the public mirrors. Additive: no gym member's data moved, and no
 * existing table changed.
 *
 * TENANT SAFETY. Every table here is keyed by app_user_id and has NO gym_id
 * column, so there is nothing for the tenant injection to scope and no way to
 * express another gym's row. Isolation is therefore a single rule, applied on
 * every read and write below: filter by the app_user_id from the TOKEN, never
 * one from the request. Ownership on nested rows is proven by joining up to the
 * parent rather than trusting an id the client sent.
 */
@Injectable()
export class MemberPersonalService {
  private static readonly MAX_EXERCISES_PER_ROUTINE = 60;

  constructor(private readonly pub: PublicPrismaService) {}

  /**
   * The exercise catalogue: everything global, plus this person's own.
   *
   * `app_user_id IS NULL` marks a system exercise. A member never sees another
   * member's personal exercises because the only non-null id accepted here is
   * their own, from the token.
   */
  async exercises(member: CurrentMemberContext, q?: string) {
    const search = (q ?? '').trim();
    return {
      exercises: await this.pub.appUserExercise.findMany({
        where: {
          OR: [{ app_user_id: null }, { app_user_id: member.appUserId }],
          ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
        },
        orderBy: [{ muscle_group: 'asc' }, { name: 'asc' }],
        take: 500,
      }),
    };
  }

  async createExercise(
    member: CurrentMemberContext,
    dto: { name: string; muscleGroup?: string; trackingType?: string },
  ) {
    const name = dto.name?.trim();
    if (!name) throw MemberException.badRequest('An exercise needs a name.');
    return this.pub.appUserExercise.create({
      data: {
        // Always the token's id — a personal exercise cannot be created for
        // somebody else, and it can never be created as a system one (null).
        app_user_id: member.appUserId,
        name,
        muscle_group: dto.muscleGroup ?? null,
        tracking_type: dto.trackingType === 'duration' ? 'duration' : 'reps',
      },
    });
  }

  async routines(member: CurrentMemberContext) {
    const rows = await this.pub.appUserRoutine.findMany({
      where: { app_user_id: member.appUserId },
      orderBy: { updated_at: 'desc' },
      include: {
        exercises: {
          orderBy: { position: 'asc' },
          include: { exercise: { select: { id: true, name: true, tracking_type: true } } },
        },
      },
    });
    return { routines: rows.map((r) => this.toRoutine(r)) };
  }

  async routine(member: CurrentMemberContext, id: string) {
    const r = await this.pub.appUserRoutine.findFirst({
      // id AND owner together: an id alone would let anyone read any routine.
      where: { id, app_user_id: member.appUserId },
      include: {
        exercises: {
          orderBy: { position: 'asc' },
          include: { exercise: { select: { id: true, name: true, tracking_type: true } } },
        },
      },
    });
    // Not found and not yours are the same answer, so a 403 cannot be used to
    // confirm that an id exists.
    if (!r) throw MemberException.notFound('Routine not found.');
    return this.toRoutine(r);
  }

  async createRoutine(
    member: CurrentMemberContext,
    dto: { name: string; notes?: string; exercises?: RoutineExerciseInput[] },
  ) {
    const name = dto.name?.trim();
    if (!name) throw MemberException.badRequest('A routine needs a name.');
    const exercises = await this.validExercises(member, dto.exercises ?? []);

    const created = await this.pub.appUserRoutine.create({
      data: {
        app_user_id: member.appUserId,
        name,
        notes: dto.notes ?? null,
        exercises: { create: exercises },
      },
      include: {
        exercises: {
          orderBy: { position: 'asc' },
          include: { exercise: { select: { id: true, name: true, tracking_type: true } } },
        },
      },
    });
    return this.toRoutine(created);
  }

  async updateRoutine(
    member: CurrentMemberContext,
    id: string,
    dto: { name?: string; notes?: string; exercises?: RoutineExerciseInput[] },
  ) {
    // Prove ownership BEFORE writing anything.
    const owned = await this.pub.appUserRoutine.findFirst({
      where: { id, app_user_id: member.appUserId },
      select: { id: true },
    });
    if (!owned) throw MemberException.notFound('Routine not found.');

    const exercises =
      dto.exercises === undefined ? null : await this.validExercises(member, dto.exercises);

    await this.pub.$transaction(async (tx) => {
      await tx.appUserRoutine.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });
      if (exercises) {
        // Replaced wholesale rather than merged: a partial update would leave
        // rows from the previous version at unpredictable positions.
        await tx.appUserRoutineExercise.deleteMany({ where: { routine_id: id } });
        if (exercises.length > 0) {
          await tx.appUserRoutineExercise.createMany({
            data: exercises.map((e) => ({ ...e, routine_id: id })),
          });
        }
      }
    });

    return this.routine(member, id);
  }

  async deleteRoutine(member: CurrentMemberContext, id: string) {
    const { count } = await this.pub.appUserRoutine.deleteMany({
      where: { id, app_user_id: member.appUserId },
    });
    if (count === 0) throw MemberException.notFound('Routine not found.');
    return { deleted: true };
  }

  /* ── Meals ──────────────────────────────────────────────── */

  async meals(member: CurrentMemberContext, dayIso?: string, tzOffsetMinutes = 0) {
    const { from, to } = this.dayWindow(dayIso, tzOffsetMinutes);
    const logs = await this.pub.appUserMealLog.findMany({
      where: { app_user_id: member.appUserId, logged_at: { gte: from, lt: to } },
      orderBy: { logged_at: 'asc' },
      include: { items: true },
    });

    const totals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    for (const l of logs) {
      for (const i of l.items) {
        const q = Number(i.quantity) || 0;
        totals.kcal += Number(i.kcal) * q;
        totals.proteinG += Number(i.protein_g) * q;
        totals.carbsG += Number(i.carbs_g) * q;
        totals.fatG += Number(i.fat_g) * q;
      }
    }

    return {
      meals: logs.map((l) => ({
        id: l.id,
        mealType: l.meal_type,
        loggedAt: l.logged_at.toISOString(),
        notes: l.notes,
        items: l.items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: Number(i.quantity),
          unit: i.unit,
          kcal: Number(i.kcal),
          proteinG: Number(i.protein_g),
          carbsG: Number(i.carbs_g),
          fatG: Number(i.fat_g),
        })),
      })),
      totals: {
        kcal: Math.round(totals.kcal),
        proteinG: Math.round(totals.proteinG),
        carbsG: Math.round(totals.carbsG),
        fatG: Math.round(totals.fatG),
      },
    };
  }

  async logMeal(
    member: CurrentMemberContext,
    dto: { mealType?: string; loggedAt?: string; notes?: string; items: MealItemInput[]; clientKey?: string },
  ) {
    const items = (dto.items ?? []).slice(0, 50).map((i) => ({
      name: (i.name ?? '').trim().slice(0, 200) || 'Item',
      quantity: this.num(i.quantity, 1),
      unit: (i.unit ?? 'serving').slice(0, 40),
      kcal: this.num(i.kcal, 0),
      protein_g: this.num(i.proteinG, 0),
      carbs_g: this.num(i.carbsG, 0),
      fat_g: this.num(i.fatG, 0),
    }));
    if (items.length === 0) throw MemberException.badRequest('A meal needs at least one item.');

    /*
      The offline outbox retries, so the same meal can arrive twice. The unique
      index on (app_user_id, client_key) makes the second one a no-op rather
      than a duplicate breakfast — scoped to the person, so two members can
      never collide on the same key.
    */
    if (dto.clientKey) {
      const existing = await this.pub.appUserMealLog.findFirst({
        where: { app_user_id: member.appUserId, client_key: dto.clientKey },
        include: { items: true },
      });
      if (existing) return { id: existing.id, duplicate: true };
    }

    const created = await this.pub.appUserMealLog.create({
      data: {
        app_user_id: member.appUserId,
        meal_type: dto.mealType ?? 'snack',
        logged_at: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
        notes: dto.notes ?? null,
        client_key: dto.clientKey ?? null,
        items: { create: items },
      },
    });
    return { id: created.id, duplicate: false };
  }

  async deleteMeal(member: CurrentMemberContext, id: string) {
    const { count } = await this.pub.appUserMealLog.deleteMany({
      where: { id, app_user_id: member.appUserId },
    });
    if (count === 0) throw MemberException.notFound('Meal not found.');
    return { deleted: true };
  }

  /* ── helpers ────────────────────────────────────────────── */

  /**
   * Keep only exercises this person is allowed to reference.
   *
   * Without this a client could put ANY exercise id into a routine, including
   * another member's personal one, and then read its name back out of their own
   * routine — a read of somebody else's row through a door that looks like
   * their own data.
   */
  private async validExercises(member: CurrentMemberContext, input: RoutineExerciseInput[]) {
    const wanted = input.slice(0, MemberPersonalService.MAX_EXERCISES_PER_ROUTINE);
    if (wanted.length === 0) return [];

    const allowed = await this.pub.appUserExercise.findMany({
      where: {
        id: { in: wanted.map((e) => e.exerciseId) },
        OR: [{ app_user_id: null }, { app_user_id: member.appUserId }],
      },
      select: { id: true },
    });
    const ok = new Set(allowed.map((a) => a.id));

    const bad = wanted.find((e) => !ok.has(e.exerciseId));
    if (bad) throw MemberException.badRequest('Unknown exercise in routine.');

    return wanted.map((e, i) => ({
      exercise_id: e.exerciseId,
      position: i,
      target_sets: e.targetSets ?? null,
      target_reps: e.targetReps ?? null,
      target_duration_seconds: e.targetDurationSeconds ?? null,
      target_reps_per_set: e.targetRepsPerSet ?? [],
      target_seconds_per_set: e.targetSecondsPerSet ?? [],
      target_weight_per_set: e.targetWeightPerSet ?? [],
    }));
  }

  private dayWindow(dayIso: string | undefined, tzOffsetMinutes: number) {
    const base = dayIso ? new Date(`${dayIso}T00:00:00Z`) : new Date();
    const local = new Date(base.getTime() + tzOffsetMinutes * 60_000);
    const key = local.toISOString().slice(0, 10);
    // Back out of the member's calendar into real UTC instants.
    const from = new Date(new Date(`${key}T00:00:00Z`).getTime() - tzOffsetMinutes * 60_000);
    return { from, to: new Date(from.getTime() + 86_400_000) };
  }

  private num(v: unknown, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  private toRoutine(r: {
    id: string;
    name: string;
    notes: string | null;
    updated_at: Date;
    exercises: {
      id: string;
      exercise_id: string;
      position: number;
      target_sets: number | null;
      target_reps: number | null;
      target_duration_seconds: number | null;
      exercise: { id: string; name: string; tracking_type: string };
    }[];
  }) {
    return {
      id: r.id,
      name: r.name,
      notes: r.notes,
      updatedAt: r.updated_at.toISOString(),
      exercises: r.exercises.map((e) => ({
        id: e.id,
        exerciseId: e.exercise_id,
        name: e.exercise.name,
        trackingType: e.exercise.tracking_type,
        position: e.position,
        targetSets: e.target_sets,
        targetReps: e.target_reps,
        targetDurationSeconds: e.target_duration_seconds,
      })),
    };
  }
}

export interface RoutineExerciseInput {
  exerciseId: string;
  targetSets?: number;
  targetReps?: number;
  targetDurationSeconds?: number;
  targetRepsPerSet?: number[];
  targetSecondsPerSet?: number[];
  targetWeightPerSet?: number[];
}

export interface MealItemInput {
  name: string;
  quantity?: number;
  unit?: string;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}
