import { Injectable } from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { toNumber } from './mappers';
import type {
  ExerciseListData,
  ExerciseDetailData,
  FavoriteResultData,
} from '../contract';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER EXERCISE SERVICE (Member App V2.2 — Exercise Library)
 * ────────────────────────────────────────────────────────────────
 *
 * Browse/search the gym's exercise catalog (the same `exercises` rows trainers
 * build plans from) plus per-member favorites. The catalog is gym-wide (gym_id
 * auto-injected by the tenant layer, no member_id needed); favorites ARE
 * member-owned, so those queries additionally filter by member_id.
 */
@Injectable()
export class MemberExerciseService {
  constructor(private readonly tenant: TenantPrisma) {}

  /**
   * Create a personal exercise. Never enters the gym's shared catalogue — see
   * `created_by_member_id` on the model.
   */
  async createCustom(
    member: CurrentMemberContext,
    input: {
      name: string;
      muscleGroup?: string;
      targetMuscle?: string;
      equipment?: string;
      trackingType?: 'reps' | 'duration';
      instructions?: string;
    },
  ) {
    const name = input.name.trim();
    if (!name) throw MemberException.badRequest('An exercise needs a name.');

    // Reuse rather than duplicate: if the gym already stocks this movement the
    // member should log against the shared row, so their history and PRs line
    // up with everyone else's and the picker does not show it twice.
    const existing = await this.tenant.client.exercise.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        OR: [{ created_by_member_id: null }, { created_by_member_id: member.memberId }],
      },
      select: { id: true, name: true, created_by_member_id: true },
    });
    if (existing) {
      throw MemberException.badRequest(
        existing.created_by_member_id
          ? `You already have an exercise called "${existing.name}".`
          : `Your gym already has "${existing.name}" — search for it instead.`,
      );
    }

    const row = await this.tenant.client.exercise.create({
      data: {
        gym_id: member.tenantId,
        name,
        muscle_group: input.muscleGroup ?? null,
        target_muscle: input.targetMuscle ?? null,
        equipment: input.equipment ?? null,
        tracking_type: input.trackingType === 'duration' ? 'duration' : 'reps',
        instructions: input.instructions ?? null,
        created_by_member_id: member.memberId,
        is_active: true,
      },
      select: { id: true, name: true },
    });
    return { id: row.id, name: row.name, isCustom: true };
  }

  /** Delete one of the member's OWN exercises. The gym's are untouchable. */
  async deleteCustom(member: CurrentMemberContext, id: string) {
    const owned = await this.tenant.client.exercise.findFirst({
      where: { id, created_by_member_id: member.memberId },
      select: { id: true },
    });
    if (!owned) {
      throw MemberException.notFound('That is not one of your own exercises.');
    }

    // Logged sets reference it, so deactivate rather than delete: removing the
    // row would orphan history the member can still see in their PRs.
    await this.tenant.client.exercise.update({
      where: { id },
      data: { is_active: false },
    });
    return { deleted: true };
  }

  /** Active exercises, optionally filtered by name (q), muscle group, and/or the
   * member's favorites. Each item carries this member's `favorited` flag. */
  async list(
    member: CurrentMemberContext,
    q?: string,
    muscle?: string,
    favoritesOnly?: boolean,
    equipment?: string,
    target?: string,
  ): Promise<ExerciseListData> {
    const term = (q ?? '').trim();
    const muscleGroup = (muscle ?? '').trim();
    const equipmentName = (equipment ?? '').trim();
    const targetMuscle = (target ?? '').trim();

    const favIds = await this.favoriteIds(member);
    if (favoritesOnly && favIds.size === 0) return { exercises: [] };

    const rows = await this.tenant.client.exercise.findMany({
      where: {
        is_active: true,
        // The gym's catalogue plus THIS member's own. Another member's personal
        // exercises are invisible — they are not part of the gym library.
        OR: [{ created_by_member_id: null }, { created_by_member_id: member.memberId }],
        ...(term ? { name: { contains: term, mode: 'insensitive' } } : {}),
        ...(muscleGroup ? { muscle_group: muscleGroup } : {}),
        ...(equipmentName ? { equipment: equipmentName } : {}),
        ...(targetMuscle ? { target_muscle: targetMuscle } : {}),
        ...(favoritesOnly ? { id: { in: [...favIds] } } : {}),
      },
      orderBy: { name: 'asc' },
      take: 200,
      select: {
        id: true,
        name: true,
        muscle_group: true,
        target_muscle: true,
        secondary_muscles: true,
        tracking_type: true,
        created_by_member_id: true,
        equipment: true,
        media_url: true,
        thumb_url: true,
        instructions: true,
      },
    });

    return {
      exercises: rows.map((e) => ({
        id: e.id,
        name: e.name,
        muscleGroup: e.muscle_group ?? null,
        targetMuscle: e.target_muscle ?? null,
        secondaryMuscles: e.secondary_muscles ?? [],
        trackingType: e.tracking_type ?? 'reps',
        isCustom: !!e.created_by_member_id,
        equipment: e.equipment ?? null,
        mediaUrl: e.media_url ?? null,
        thumbUrl: e.thumb_url ?? null,
        hasInstructions: !!e.instructions,
        favorited: favIds.has(e.id),
      })),
    };
  }

  /** One exercise's full detail (or 404 if not in this gym), with favorited flag. */
  async detail(
    member: CurrentMemberContext,
    exerciseId: string,
  ): Promise<ExerciseDetailData> {
    const e = await this.tenant.client.exercise.findFirst({
      where: { id: exerciseId, is_active: true },
      select: {
        id: true,
        name: true,
        muscle_group: true,
        equipment: true,
        media_url: true,
        instructions: true,
      },
    });
    if (!e) throw MemberException.notFound('Exercise not found.');

    const fav = await this.tenant.client.exerciseFavorite.findFirst({
      where: { member_id: member.memberId, exercise_id: exerciseId },
      select: { id: true },
    });

    return {
      id: e.id,
      name: e.name,
      muscleGroup: e.muscle_group ?? null,
      equipment: e.equipment ?? null,
      mediaUrl: e.media_url ?? null,
      instructions: e.instructions ?? null,
      favorited: !!fav,
    };
  }

  /** Favorite an exercise (idempotent — re-favoriting is a no-op). */
  async favorite(
    member: CurrentMemberContext,
    exerciseId: string,
  ): Promise<FavoriteResultData> {
    // Ownership/existence gate: the exercise must be in THIS gym.
    const e = await this.tenant.client.exercise.findFirst({
      where: { id: exerciseId, is_active: true },
      select: { id: true },
    });
    if (!e) throw MemberException.notFound('Exercise not found.');

    const existing = await this.tenant.client.exerciseFavorite.findFirst({
      where: { member_id: member.memberId, exercise_id: exerciseId },
      select: { id: true },
    });
    if (!existing) {
      await this.tenant.client.exerciseFavorite.create({
        data: {
          gym_id: member.tenantId,
          member_id: member.memberId,
          exercise_id: exerciseId,
        },
      });
    }
    return { favorited: true };
  }

  /** Unfavorite an exercise (idempotent). */
  async unfavorite(
    member: CurrentMemberContext,
    exerciseId: string,
  ): Promise<FavoriteResultData> {
    await this.tenant.client.exerciseFavorite.deleteMany({
      where: { member_id: member.memberId, exercise_id: exerciseId },
    });
    return { favorited: false };
  }

  // ── helpers ────────────────────────────────────────────────────

  private async favoriteIds(member: CurrentMemberContext): Promise<Set<string>> {
    const rows = await this.tenant.client.exerciseFavorite.findMany({
      where: { member_id: member.memberId },
      select: { exercise_id: true },
    });
    return new Set(rows.map((r) => r.exercise_id));
  }

  /**
   * This member's logged history for one exercise, newest session first.
   *
   * Drives the "PREVIOUS" column on the set-logging screen — the app prefills
   * each set row from `sessions[0]`, which is the single highest-value
   * interaction in the logging loop (most members repeat last session, give or
   * take a rep). Also feeds the exercise detail chart and the PR badge.
   *
   * Scoping: gym_id is auto-injected by the tenant client and every query is
   * additionally pinned to member_id, so this can only ever read the caller's
   * own sets. The exercise itself is existence-checked first so an unknown or
   * other-gym id 404s rather than silently returning an empty history.
   */
  async history(
    member: CurrentMemberContext,
    exerciseId: string,
    limit = 10,
  ) {
    const exercise = await this.tenant.client.exercise.findFirst({
      where: { id: exerciseId },
      select: { id: true, name: true, tracking_type: true },
    });
    if (!exercise) throw MemberException.notFound('Exercise not found.');

    const take = Math.min(Math.max(Number(limit) || 10, 1), 50);

    const [pr, setRows] = await Promise.all([
      this.tenant.client.personalRecord.findFirst({
        where: { member_id: member.memberId, exercise_id: exerciseId },
        select: { weight: true, reps: true, unit: true, achieved_at: true },
      }),
      // Sets for this exercise, joined to their parent log so we can group by
      // session. Ordering by the log's logged_at keeps sessions contiguous.
      this.tenant.client.workoutSetLog.findMany({
        where: {
          exercise_id: exerciseId,
          workout_log: { member_id: member.memberId },
        },
        select: {
          set_number: true,
          reps: true,
          weight: true,
          duration_seconds: true,
          unit: true,
          workout_log: { select: { id: true, logged_at: true } },
        },
        orderBy: [{ workout_log: { logged_at: 'desc' } }, { set_number: 'asc' }],
        // Enough rows to cover `take` sessions without a second round-trip;
        // 200 sets is well past any realistic session count for one exercise.
        take: take * 20,
      }),
    ]);

    // Group flat set rows into sessions, preserving the desc logged_at order.
    const byLog = new Map<
      string,
      {
        loggedAt: string;
        sets: {
          setNumber: number;
          reps: number;
          weight: number;
          durationSeconds: number | null;
          unit: string;
        }[];
      }
    >();
    for (const r of setRows) {
      const logId = r.workout_log.id;
      let session = byLog.get(logId);
      if (!session) {
        if (byLog.size >= take) continue;
        session = { loggedAt: r.workout_log.logged_at.toISOString(), sets: [] };
        byLog.set(logId, session);
      }
      session.sets.push({
        setNumber: r.set_number,
        reps: r.reps,
        weight: toNumber(r.weight) ?? 0,
        durationSeconds: r.duration_seconds ?? null,
        unit: r.unit,
      });
    }

    return {
      exercise: {
        id: exercise.id,
        name: exercise.name,
        trackingType: exercise.tracking_type ?? 'reps',
      },
      personalRecord: pr
        ? {
            weight: toNumber(pr.weight) ?? 0,
            reps: pr.reps,
            unit: pr.unit,
            achievedAt: pr.achieved_at.toISOString(),
          }
        : null,
      sessions: [...byLog.values()],
    };
  }

}


