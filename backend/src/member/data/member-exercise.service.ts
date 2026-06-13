import { Injectable } from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
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

  /** Active exercises, optionally filtered by name (q), muscle group, and/or the
   * member's favorites. Each item carries this member's `favorited` flag. */
  async list(
    member: CurrentMemberContext,
    q?: string,
    muscle?: string,
    favoritesOnly?: boolean,
  ): Promise<ExerciseListData> {
    const term = (q ?? '').trim();
    const muscleGroup = (muscle ?? '').trim();

    const favIds = await this.favoriteIds(member);
    if (favoritesOnly && favIds.size === 0) return { exercises: [] };

    const rows = await this.tenant.client.exercise.findMany({
      where: {
        is_active: true,
        ...(term ? { name: { contains: term, mode: 'insensitive' } } : {}),
        ...(muscleGroup ? { muscle_group: muscleGroup } : {}),
        ...(favoritesOnly ? { id: { in: [...favIds] } } : {}),
      },
      orderBy: { name: 'asc' },
      take: 200,
      select: {
        id: true,
        name: true,
        muscle_group: true,
        equipment: true,
        media_url: true,
        instructions: true,
      },
    });

    return {
      exercises: rows.map((e) => ({
        id: e.id,
        name: e.name,
        muscleGroup: e.muscle_group ?? null,
        equipment: e.equipment ?? null,
        mediaUrl: e.media_url ?? null,
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
}
