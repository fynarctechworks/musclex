import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { toNumber } from './mappers';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER ROUTINES
 * ────────────────────────────────────────────────────────────────
 *
 * A routine is a member's own saved workout: personal, editable, repeatable.
 * Trainer-assigned plans are a different thing entirely — authored in the admin
 * app and owned by the gym.
 *
 * SHARING is by immutable snapshot, not by reference. `share()` copies the
 * routine into `public.shared_routines` keyed by an unguessable token, storing
 * exercise NAMES rather than ids. Ids are gym-scoped and gyms hold different
 * catalogues, so names are the only portable key; the recipient re-matches
 * against their own gym on import.
 *
 * The snapshot deliberately carries no member id, gym id or gym name. Opening a
 * share link reveals a workout and nothing about who wrote it or where they
 * train. Import produces a COPY — later edits by the author never propagate,
 * which is what "add it to mine" should mean.
 */
export interface RoutineExerciseInput {
  exerciseId: string;
  position?: number;
  targetSets?: number;
  targetReps?: number;
  targetDurationSeconds?: number;
  /** Per-set plan, e.g. [12, 10, 8]. Length is the set count when present. */
  targetRepsPerSet?: number[];
  targetSecondsPerSet?: number[];
  /** Canonical kg. */
  targetWeightPerSet?: number[];
}

/**
 * Map one input row to its stored columns.
 *
 * `target_sets` is DERIVED from a per-set array when one is given, never taken
 * from the client alongside it: two sources for the same fact drift, and a
 * routine claiming "3 sets" while listing four rep targets is unreadable to
 * every consumer downstream.
 *
 * Empty arrays are normalised to null so "no per-set plan" has ONE
 * representation rather than two that behave differently.
 */
function perSetColumns(e: RoutineExerciseInput, index: number) {
  const reps = e.targetRepsPerSet?.length ? e.targetRepsPerSet : null;
  const secs = e.targetSecondsPerSet?.length ? e.targetSecondsPerSet : null;
  const weight = e.targetWeightPerSet?.length ? e.targetWeightPerSet : null;
  const derivedSets = reps?.length ?? secs?.length ?? null;

  return {
    position: e.position ?? index,
    target_sets: derivedSets ?? e.targetSets ?? null,
    target_reps: e.targetReps ?? null,
    target_duration_seconds: e.targetDurationSeconds ?? null,
    target_reps_per_set: reps ?? [],
    target_seconds_per_set: secs ?? [],
    target_weight_per_set: weight ?? [],
  };
}

/**
 * One exercise inside a shared snapshot.
 *
 * Carries the PER-SET arrays as well as the uniform fields: a pyramid is the
 * main reason to share a routine, and dropping the arrays here would silently
 * flatten 12/10/8 into whatever single number survived.
 */
export interface SharedRoutineExercise {
  name: string;
  position?: number;
  targetSets?: number;
  targetReps?: number;
  targetDurationSeconds?: number;
  targetRepsPerSet?: number[];
  targetSecondsPerSet?: number[];
  targetWeightPerSet?: number[];
}

@Injectable()
export class MemberRoutineService {
  constructor(
    private readonly tenant: TenantPrisma,
    private readonly pub: PublicPrismaService,
  ) {}

  /** This member's routines, newest first. gym_id is auto-injected. */
  async list(member: CurrentMemberContext) {
    const rows = await this.tenant.client.memberRoutine.findMany({
      where: { member_id: member.memberId },
      orderBy: { updated_at: 'desc' },
      include: {
        exercises: {
          orderBy: { position: 'asc' },
          include: {
            exercise: {
              select: { id: true, name: true, thumb_url: true, tracking_type: true },
            },
          },
        },
      },
    });
    return { routines: rows.map((r) => this.toRoutine(r)) };
  }

  async get(member: CurrentMemberContext, id: string) {
    const row = await this.tenant.client.memberRoutine.findFirst({
      where: { id, member_id: member.memberId },
      include: {
        exercises: {
          orderBy: { position: 'asc' },
          include: {
            exercise: {
              select: { id: true, name: true, thumb_url: true, tracking_type: true },
            },
          },
        },
      },
    });
    if (!row) throw MemberException.notFound('Routine not found.');
    return this.toRoutine(row);
  }

  async create(
    member: CurrentMemberContext,
    input: {
      name: string;
      notes?: string;
      exercises: RoutineExerciseInput[];
      sourceToken?: string;
    },
  ) {
    if (!input.exercises?.length) {
      throw MemberException.badRequest('A routine needs at least one exercise.');
    }
    // Every exercise must belong to THIS gym. The tenant client scopes the
    // lookup, so an id from another gym simply will not be found.
    const ids = [...new Set(input.exercises.map((e) => e.exerciseId))];
    const found = await this.tenant.client.exercise.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw MemberException.badRequest('One or more exercises are not in your gym.');
    }

    const routine = await this.tenant.client.memberRoutine.create({
      data: {
        gym_id: member.tenantId,
        member_id: member.memberId,
        name: input.name.trim() || 'My routine',
        notes: input.notes ?? null,
        source_token: input.sourceToken ?? null,
        exercises: {
          create: input.exercises.map((e, i) => ({
            gym_id: member.tenantId,
            exercise_id: e.exerciseId,
            ...perSetColumns(e, i),
          })),
        },
      },
      select: { id: true },
    });
    return this.get(member, routine.id);
  }

  async update(
    member: CurrentMemberContext,
    id: string,
    input: { name?: string; notes?: string; exercises?: RoutineExerciseInput[] },
  ) {
    const owned = await this.tenant.client.memberRoutine.findFirst({
      where: { id, member_id: member.memberId },
      select: { id: true },
    });
    if (!owned) throw MemberException.notFound('Routine not found.');

    await this.tenant.client.memberRoutine.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    // Exercises are replaced wholesale when supplied: reconciling a reordered
    // list item-by-item is more code and more ways to end up half-applied.
    if (input.exercises) {
      await this.tenant.client.memberRoutineExercise.deleteMany({ where: { routine_id: id } });
      await this.tenant.client.memberRoutineExercise.createMany({
        data: input.exercises.map((e, i) => ({
          gym_id: member.tenantId,
          routine_id: id,
          exercise_id: e.exerciseId,
          ...perSetColumns(e, i),
        })),
      });
    }
    return this.get(member, id);
  }

  async remove(member: CurrentMemberContext, id: string) {
    const n = await this.tenant.client.memberRoutine.deleteMany({
      where: { id, member_id: member.memberId },
    });
    if (!n.count) throw MemberException.notFound('Routine not found.');
    return { deleted: true };
  }

  /** Snapshot the routine into the public registry and return its token. */
  async share(member: CurrentMemberContext, id: string) {
    const routine = await this.get(member, id);

    const token = randomBytes(9).toString('base64url'); // 12 chars, unguessable
    await this.pub.sharedRoutine.create({
      data: {
        token,
        name: routine.name,
        exercises: routine.exercises.map((e, i) => ({
          name: e.name,
          position: i,
          targetSets: e.targetSets,
          targetReps: e.targetReps,
          targetDurationSeconds: e.targetDurationSeconds,
          targetRepsPerSet: e.targetRepsPerSet,
          targetSecondsPerSet: e.targetSecondsPerSet,
          targetWeightPerSet: e.targetWeightPerSet,
        })),
      },
    });
    return { token, name: routine.name, exerciseCount: routine.exercises.length };
  }

  /** Read a shared snapshot. No gym scope needed — it holds no tenant data. */
  async preview(token: string) {
    const row = await this.pub.sharedRoutine.findUnique({ where: { token } });
    if (!row) throw MemberException.notFound('That routine link is not valid.');
    const exercises = row.exercises as { name: string }[];
    return {
      token: row.token,
      name: row.name,
      exerciseCount: exercises.length,
      exercises,
      importCount: row.import_count,
    };
  }

  /**
   * Resolve a name-described workout against THIS member's gym.
   *
   * Shared by routine import and Explore, because both face the same problem:
   * content authored elsewhere describes exercises by name, and only this gym
   * can say which of them it stocks. Two copies of this would drift.
   *
   * Matching is case-insensitive and includes the member's own personal
   * exercises, so someone who added "Sled Push" themselves gets it matched
   * rather than reported missing.
   */
  async resolveByName(
    member: CurrentMemberContext,
    wanted: SharedRoutineExercise[],
  ): Promise<{ matched: RoutineExerciseInput[]; missing: string[] }> {
    const found = await this.tenant.client.exercise.findMany({
      where: {
        name: { in: wanted.map((w) => w.name), mode: 'insensitive' },
        is_active: true,
        OR: [{ created_by_member_id: null }, { created_by_member_id: member.memberId }],
      },
      select: { id: true, name: true },
    });
    const byName = new Map(found.map((f) => [f.name.toLowerCase(), f.id]));

    const matched: RoutineExerciseInput[] = [];
    const missing: string[] = [];
    wanted.forEach((w, i) => {
      const id = byName.get(w.name.toLowerCase());
      if (!id) return void missing.push(w.name);
      matched.push({
        exerciseId: id,
        position: i,
        targetSets: w.targetSets,
        targetReps: w.targetReps,
        targetDurationSeconds: w.targetDurationSeconds,
        targetRepsPerSet: w.targetRepsPerSet,
        targetSecondsPerSet: w.targetSecondsPerSet,
        targetWeightPerSet: w.targetWeightPerSet,
      });
    });
    return { matched, missing };
  }

  /**
   * Copy a shared routine into this member's own list, re-matching exercises by
   * NAME against their gym's catalogue.
   *
   * Reports what could not be matched rather than silently dropping it: a
   * routine that quietly arrives with four of its six exercises is worse than
   * one that says which two are missing.
   */
  async importShared(member: CurrentMemberContext, token: string) {
    const snap = await this.preview(token);
    const { matched, missing } = await this.resolveByName(
      member,
      snap.exercises as SharedRoutineExercise[],
    );

    if (!matched.length) {
      throw MemberException.badRequest(
        'None of these exercises exist in your gym, so this routine cannot be added.',
      );
    }

    // sourceToken is set during create, not patched afterwards: patching it
    // left the returned object reporting importedFromLink=false on a routine
    // that plainly was imported.
    const routine = await this.create(member, {
      name: snap.name,
      exercises: matched,
      sourceToken: token,
    });
    await this.pub.sharedRoutine.update({
      where: { token },
      data: { import_count: { increment: 1 } },
    });

    return { routine, missing };
  }

  private toRoutine(r: {
    id: string;
    name: string;
    notes: string | null;
    source_token: string | null;
    updated_at: Date;
    exercises: {
      exercise_id: string;
      position: number;
      target_sets: number | null;
      target_reps: number | null;
      target_duration_seconds: number | null;
      target_reps_per_set: number[];
      target_seconds_per_set: number[];
      target_weight_per_set: unknown[];
      exercise: { id: string; name: string; thumb_url: string | null; tracking_type: string };
    }[];
  }) {
    return {
      id: r.id,
      name: r.name,
      notes: r.notes,
      importedFromLink: !!r.source_token,
      updatedAt: r.updated_at.toISOString(),
      exercises: r.exercises.map((e) => ({
        exerciseId: e.exercise_id,
        name: e.exercise.name,
        thumbUrl: e.exercise.thumb_url,
        trackingType: e.exercise.tracking_type,
        targetSets: e.target_sets ?? undefined,
        targetReps: e.target_reps ?? undefined,
        targetDurationSeconds: e.target_duration_seconds ?? undefined,
        // Omitted entirely when empty rather than sent as [], so a client can
        // test presence instead of length to decide uniform vs per-set.
        targetRepsPerSet: e.target_reps_per_set?.length ? e.target_reps_per_set : undefined,
        targetSecondsPerSet: e.target_seconds_per_set?.length ? e.target_seconds_per_set : undefined,
        // Decimal -> number at the edge, matching how weights are sent
        // everywhere else in the member API.
        targetWeightPerSet: e.target_weight_per_set?.length
          ? e.target_weight_per_set.map((d) => toNumber(d) ?? 0)
          : undefined,
      })),
    };
  }
}
