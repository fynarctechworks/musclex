import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../common/tenant-context';
import { EXERCISE_CATALOGUE } from './exercise-catalogue.data';

export interface ExerciseInput {
  name: string;
  muscle_group?: string;
  equipment?: string;
  media_url?: string;
  instructions?: string;
  is_active?: boolean;
}

/**
 * Exercise catalog management for staff.
 *
 * The catalog was read-only (`GET /exercises` and nothing else) AND unseeded,
 * so the workout-plan builder shipped with an empty, uncurateable picker.
 */
@Injectable()
export class ExercisesService {
  private readonly logger = new Logger(ExercisesService.name);

  constructor(private readonly tenant: TenantPrisma) {}

  async findAll(filters: {
    search?: string;
    muscle_group?: string;
    include_inactive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const take = Math.min(filters.limit ?? 100, 200);
    const where: Record<string, unknown> = {};
    if (!filters.include_inactive) where.is_active = true;
    if (filters.search) where.name = { contains: filters.search, mode: 'insensitive' };
    if (filters.muscle_group) where.muscle_group = filters.muscle_group;

    const [data, total] = await Promise.all([
      this.tenant.client.exercise.findMany({
        where,
        skip: (page - 1) * take,
        take,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          muscle_group: true,
          // The head the movement actually trains — "front_delt", not just
          // "shoulders". The catalogue carries it and the picker groups by it,
          // but the list endpoint was dropping it, so staff only ever saw the
          // coarse bucket.
          target_muscle: true,
          secondary_muscles: true,
          equipment: true,
          media_url: true,
          instructions: true,
          is_active: true,
        },
      }),
      this.tenant.client.exercise.count({ where }),
    ]);
    return { data, total, page, limit: take };
  }

  async create(input: ExerciseInput) {
    return this.tenant.client.exercise.create({
      data: {
        gym_id: getTenantGymId()!,
        name: input.name.trim(),
        muscle_group: input.muscle_group ?? null,
        equipment: input.equipment ?? null,
        media_url: input.media_url ?? null,
        instructions: input.instructions ?? null,
        is_active: input.is_active ?? true,
      },
    });
  }

  async update(id: string, input: Partial<ExerciseInput>) {
    // Explicit gym filter first: update-by-id is not covered by the gym_id
    // auto-injection (the known findUnique/​update fails-open class).
    const owned = await this.tenant.client.exercise.findFirst({
      where: { id, gym_id: getTenantGymId()! },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Exercise not found');

    return this.tenant.client.exercise.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.muscle_group !== undefined ? { muscle_group: input.muscle_group } : {}),
        ...(input.equipment !== undefined ? { equipment: input.equipment } : {}),
        ...(input.media_url !== undefined ? { media_url: input.media_url } : {}),
        ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      },
    });
  }

  /**
   * Soft delete — exercises are referenced by workout plans, set logs and
   * personal records, so a hard delete would orphan training history.
   */
  async archive(id: string) {
    const owned = await this.tenant.client.exercise.findFirst({
      where: { id, gym_id: getTenantGymId()! },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Exercise not found');

    await this.tenant.client.exercise.update({
      where: { id },
      data: { is_active: false },
    });
    return { success: true, archived: true };
  }

  /**
   * Populate the starter catalogue — the full 1,323-movement library, not a
   * 51-entry sample.
   *
   * A gym that opens with fifty exercises looks like a demo. The library is
   * also what the MEMBER app browses, so a thin catalogue makes the consumer
   * app look empty on day one too, which is the failure this exists to
   * prevent.
   *
   * Idempotent: only inserts names the gym does not already have, so it is
   * safe to re-run and never overwrites a gym's own curation or renames.
   *
   * Reads the existing names in ONE query rather than checking per row —
   * 1,323 round trips inside studio provisioning would make signup crawl.
   */
  async seedDefaults() {
    const gymId = getTenantGymId()!;
    const existing = await this.tenant.client.exercise.findMany({
      select: { name: true },
    });
    const have = new Set(existing.map((e) => e.name));
    const toCreate = EXERCISE_CATALOGUE.filter((e) => !have.has(e.name));

    if (toCreate.length === 0) {
      return { created: 0, skipped: EXERCISE_CATALOGUE.length, total: EXERCISE_CATALOGUE.length };
    }

    await this.tenant.client.exercise.createMany({
      data: toCreate.map((e) => ({
        gym_id: gymId,
        name: e.name,
        muscle_group: e.muscle_group,
        target_muscle: e.target_muscle,
        secondary_muscles: e.secondary_muscles,
        equipment: e.equipment,
        tracking_type: e.tracking_type,
        is_active: true,
      })),
      skipDuplicates: true,
    });

    this.logger.log(`Seeded ${toCreate.length} exercises for gym ${gymId}`);
    return {
      created: toCreate.length,
      skipped: EXERCISE_CATALOGUE.length - toCreate.length,
      total: EXERCISE_CATALOGUE.length,
    };
  }
}
