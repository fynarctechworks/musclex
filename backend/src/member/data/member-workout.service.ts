import { Injectable } from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { toNumber } from './mappers';
import type {
  WorkoutData,
  WorkoutSummaryData,
  WorkoutLogResultData,
  SetLogData,
} from '../contract';

type SetInput = {
  exerciseId: string;
  setNumber?: number;
  reps?: number;
  weight?: number;
  unit?: 'kg' | 'lb';
};

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER WORKOUT SERVICE
 * ────────────────────────────────────────────────────────────────
 *
 * Reads the trainer-assigned workout for today and writes back logged sets.
 * Trainer assignment originates in the SaaS admin app (AssignedWorkout); the
 * member app reads it and posts completion — the same shared tables the owner
 * dashboards read. Every query is member_id-scoped on top of the gym_id the
 * tenant middleware injects; no id is ever trusted from the client without an
 * ownership check.
 */
@Injectable()
export class MemberWorkoutService {
  constructor(private readonly tenant: TenantPrisma) {}

  /** Today's assigned workout (full detail) or null if nothing is assigned. */
  async getTodayWorkout(member: CurrentMemberContext): Promise<WorkoutData | null> {
    const assigned = await this.findTodaysAssignment(member.memberId);
    if (!assigned) return null;

    const exercises = await Promise.all(
      assigned.workout_plan.exercises.map(async (pe) => {
        const lastLog = await this.lastSetLog(member.memberId, pe.exercise_id);
        return {
          // Use the plan-exercise's exercise id so logs reference the exercise.
          id: pe.exercise_id,
          name: pe.exercise.name,
          targetSets: pe.target_sets,
          targetReps: pe.target_reps,
          mediaUrl: pe.exercise.media_url ?? null,
          ...(lastLog ? { lastLog } : {}),
        };
      }),
    );

    return {
      id: assigned.id,
      title: assigned.workout_plan.title,
      assignedBy: assigned.assigned_by?.full_name ?? null,
      exercises,
    };
  }

  /** Compact summary for the home dashboard card (or null). */
  async getTodaySummary(
    member: CurrentMemberContext,
  ): Promise<WorkoutSummaryData | null> {
    const assigned = await this.findTodaysAssignment(member.memberId);
    if (!assigned) return null;
    return {
      id: assigned.id,
      title: assigned.workout_plan.title,
      assignedBy: assigned.assigned_by?.full_name ?? null,
      exerciseCount: assigned.workout_plan.exercises.length,
    };
  }

  /**
   * Log completed sets for an assigned workout. Idempotent: the HTTP layer
   * (@Idempotent) replays duplicate requests, and a unique (gym_id, client_key)
   * on workout_logs makes the DB write itself safe against offline-outbox
   * retries — a replayed key returns the original log instead of double-counting.
   */
  async logWorkout(
    member: CurrentMemberContext,
    workoutId: string,
    sets: SetInput[],
    idempotencyKey?: string,
  ): Promise<WorkoutLogResultData> {
    // Ownership gate: the assigned workout must belong to THIS member.
    const assigned = await this.tenant.client.assignedWorkout.findFirst({
      where: { id: workoutId, member_id: member.memberId },
      select: { id: true, workout_plan_id: true },
    });
    if (!assigned) throw MemberException.notFound('Workout not found.');

    if (!Array.isArray(sets) || sets.length === 0) {
      throw MemberException.badRequest('At least one set is required.');
    }

    // DB-level idempotency replay (belt-and-suspenders with @Idempotent).
    if (idempotencyKey) {
      const existing = await this.tenant.client.workoutLog.findFirst({
        where: { client_key: idempotencyKey, member_id: member.memberId },
        select: { id: true },
      });
      if (existing) return { logId: existing.id, newPersonalRecords: [] };
    }

    const gymId = member.tenantId;

    const log = await this.tenant.client.workoutLog.create({
      data: {
        gym_id: gymId,
        member_id: member.memberId,
        assigned_workout_id: assigned.id,
        workout_plan_id: assigned.workout_plan_id,
        client_key: idempotencyKey ?? null,
        sets: {
          create: sets.map((s, i) => ({
            gym_id: gymId,
            exercise_id: s.exerciseId,
            set_number: s.setNumber ?? i + 1,
            reps: s.reps ?? 0,
            weight: s.weight ?? 0,
            unit: s.unit === 'lb' ? 'lb' : 'kg',
          })),
        },
      },
      select: { id: true },
    });

    // Mark the assignment complete (idempotent — repeated calls are harmless).
    await this.tenant.client.assignedWorkout.updateMany({
      where: { id: assigned.id, member_id: member.memberId },
      data: { status: 'completed', completed_at: new Date() },
    });

    const newPersonalRecords = await this.updatePersonalRecords(
      member,
      log.id,
      sets,
    );

    return { logId: log.id, newPersonalRecords };
  }

  // ── helpers ────────────────────────────────────────────────────

  private async findTodaysAssignment(memberId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86_400_000);

    return this.tenant.client.assignedWorkout.findFirst({
      where: {
        member_id: memberId,
        scheduled_date: { gte: start, lt: end },
        status: { not: 'skipped' },
      },
      // Prefer not-yet-completed; then the most recently created.
      orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
      include: {
        assigned_by: { select: { full_name: true } },
        workout_plan: {
          include: {
            exercises: {
              orderBy: { position: 'asc' },
              include: { exercise: { select: { name: true, media_url: true } } },
            },
          },
        },
      },
    });
  }

  /** Most recent logged set for an exercise → prefill value for the next session. */
  private async lastSetLog(
    memberId: string,
    exerciseId: string,
  ): Promise<SetLogData | undefined> {
    const last = await this.tenant.client.workoutSetLog.findFirst({
      where: { exercise_id: exerciseId, workout_log: { member_id: memberId } },
      orderBy: { created_at: 'desc' },
    });
    if (!last) return undefined;
    return {
      exerciseId,
      setNumber: last.set_number,
      reps: last.reps,
      weight: toNumber(last.weight) ?? 0,
      unit: last.unit === 'lb' ? 'lb' : 'kg',
    };
  }

  /**
   * Compare each exercise's best set in this log to the member's standing PR
   * (heaviest weight wins; reps break ties). Upserts beaten records and returns
   * the ones newly set so the app can celebrate them.
   */
  private async updatePersonalRecords(
    member: CurrentMemberContext,
    workoutLogId: string,
    sets: SetInput[],
  ): Promise<NonNullable<WorkoutLogResultData['newPersonalRecords']>> {
    // Best set per exercise in this submission.
    const bestByExercise = new Map<string, { weight: number; reps: number; unit: 'kg' | 'lb' }>();
    for (const s of sets) {
      const weight = s.weight ?? 0;
      const reps = s.reps ?? 0;
      const unit = s.unit === 'lb' ? 'lb' : 'kg';
      const cur = bestByExercise.get(s.exerciseId);
      if (!cur || weight > cur.weight || (weight === cur.weight && reps > cur.reps)) {
        bestByExercise.set(s.exerciseId, { weight, reps, unit });
      }
    }

    const newRecords: NonNullable<WorkoutLogResultData['newPersonalRecords']> = [];

    for (const [exerciseId, best] of bestByExercise) {
      if (best.weight <= 0) continue; // bodyweight/empty sets don't set weight PRs
      const existing = await this.tenant.client.personalRecord.findFirst({
        where: { member_id: member.memberId, exercise_id: exerciseId },
        select: { id: true, weight: true },
      });
      const prevWeight = existing ? toNumber(existing.weight) ?? 0 : -1;
      if (best.weight <= prevWeight) continue;

      if (existing) {
        await this.tenant.client.personalRecord.update({
          where: { id: existing.id },
          data: {
            weight: best.weight,
            reps: best.reps,
            unit: best.unit,
            achieved_at: new Date(),
            workout_log_id: workoutLogId,
          },
        });
      } else {
        await this.tenant.client.personalRecord.create({
          data: {
            gym_id: member.tenantId,
            member_id: member.memberId,
            exercise_id: exerciseId,
            weight: best.weight,
            reps: best.reps,
            unit: best.unit,
            workout_log_id: workoutLogId,
          },
        });
      }
      newRecords.push({ exerciseId, weight: best.weight });
    }

    return newRecords;
  }
}
