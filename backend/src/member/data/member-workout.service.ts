import { Injectable } from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { FriendPublisherService } from './friend-publisher.service';
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
  /** Seconds, for interval exercises. Null/absent for rep-based sets. */
  durationSeconds?: number;
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
  constructor(
    private readonly tenant: TenantPrisma,
    private readonly friendPublisher: FriendPublisherService,
  ) {}

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
  /**
   * Log sets against a trainer-assigned workout. The assignment is
   * ownership-checked before anything is written, and completing it flips the
   * assignment to `completed` so the trainer's dashboard reflects the session.
   */
  async logWorkout(
    member: CurrentMemberContext,
    workoutId: string,
    sets: SetInput[],
    idempotencyKey?: string,
    span?: { startedAt?: string; endedAt?: string },
  ): Promise<WorkoutLogResultData> {
    // Ownership gate: the assigned workout must belong to THIS member.
    const assigned = await this.tenant.client.assignedWorkout.findFirst({
      where: { id: workoutId, member_id: member.memberId },
      select: { id: true, workout_plan_id: true },
    });
    if (!assigned) throw MemberException.notFound('Workout not found.');

    return this.persistSets(member, sets, idempotencyKey, assigned, span);
  }

  /**
   * Log a workout the member started themselves, with no trainer assignment
   * behind it — the app's core loop, where someone walks in and lifts.
   *
   * Same body, same idempotency and the same PR detection as the assigned
   * variant; it simply leaves `assigned_workout_id` null (the column is
   * nullable) and marks no assignment complete. Nothing about the write is
   * client-trusted: member_id comes from the token and gym_id from the tenant
   * client, so a freestyle log can only ever land in the caller's own gym.
   */
  async logFreestyle(
    member: CurrentMemberContext,
    sets: SetInput[],
    idempotencyKey?: string,
    span?: { startedAt?: string; endedAt?: string },
  ): Promise<WorkoutLogResultData> {
    return this.persistSets(member, sets, idempotencyKey, null, span);
  }

  /**
   * Shared write path for both logging routes.
   *
   * `assigned` is the ownership-checked assignment, or null for a freestyle
   * session. Replay safety is doubled up: the @Idempotent interceptor catches
   * the common case, and the `client_key` unique index catches a retry that
   * outlived the interceptor's cache — which matters here because the app logs
   * through an offline outbox and may retry a set hours later.
   */
  private async persistSets(
    member: CurrentMemberContext,
    sets: SetInput[],
    idempotencyKey: string | undefined,
    assigned: { id: string; workout_plan_id: string } | null,
    span?: { startedAt?: string; endedAt?: string },
  ): Promise<WorkoutLogResultData> {
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
        assigned_workout_id: assigned?.id ?? null,
        workout_plan_id: assigned?.workout_plan_id ?? null,
        client_key: idempotencyKey ?? null,
        // When the session actually happened, for a workout logged after the
        // fact. `logged_at` stays the write time.
        started_at: span?.startedAt ? new Date(span.startedAt) : null,
        ended_at: span?.endedAt ? new Date(span.endedAt) : null,
        sets: {
          create: sets.map((s, i) => ({
            gym_id: gymId,
            exercise_id: s.exerciseId,
            set_number: s.setNumber ?? i + 1,
            reps: s.reps ?? 0,
            weight: s.weight ?? 0,
            duration_seconds: s.durationSeconds ?? null,
            unit: s.unit === 'lb' ? 'lb' : 'kg',
          })),
        },
      },
      select: { id: true },
    });

    // Mark the assignment complete (idempotent — repeated calls are harmless).
    if (assigned) {
      await this.tenant.client.assignedWorkout.updateMany({
        where: { id: assigned.id, member_id: member.memberId },
        data: { status: 'completed', completed_at: new Date() },
      });
    }

    const newPersonalRecords = await this.updatePersonalRecords(
      member,
      log.id,
      sets,
    );

    // Copy out to the friends feed, but only if this member turned sharing on
    // — the publisher checks their own flag, so nothing leaves the gym schema
    // by default.
    //
    // Deliberately AFTER the workout is durable, and best-effort inside the
    // publisher: a social copy failing must never cost someone the session
    // they just trained.
    await this.friendPublisher.publishSession(member, log.id, sets, span);
    if (newPersonalRecords.length) {
      await this.friendPublisher.publishPrs(
        member,
        newPersonalRecords.map((r) => r.exerciseId).filter((id): id is string => !!id),
      );
    }

    return { logId: log.id, newPersonalRecords };
  }

  /**
   * Training statistics over a window.
   *
   * Computed from the member's own logs rather than stored as counters: a
   * counter drifts the moment a log is edited or deleted, and these are read
   * far less often than sets are written. `started_at`/`ended_at` are optional,
   * so duration only counts sessions that recorded a span — reporting a
   * best-guess there would make "average session length" quietly fictional.
   */
  async stats(
    member: CurrentMemberContext,
    days = 30,
    /**
     * The member's offset from UTC in MINUTES EAST (IST = +330).
     *
     * Days are the unit this whole endpoint reports in — active days, both
     * streaks, the calendar built on top of them — and a day is a fact about
     * where the member is standing, not about the server. Defaults to 0 so an
     * existing caller that sends nothing keeps the behaviour it already has.
     */
    tzOffsetMinutes = 0,
  ): Promise<{
    periodDays: number;
    workouts: number;
    totalVolumeKg: number;
    avgVolumeKg: number;
    totalSets: number;
    totalExercises: number;
    totalSeconds: number;
    timedSessions: number;
    avgSessionSeconds: number | null;
    currentStreak: number;
    longestStreak: number;
    activeDays: { date: string; sets: number }[];
    /** Sets per muscle group over the window — what the body map is drawn from. */
    byMuscle: { muscle: string; sets: number }[];
    mostPerformed: { exerciseId: string; name: string; sessions: number }[];
    personalRecords: {
      exerciseId: string;
      name: string;
      weight: number;
      reps: number;
      unit: string;
      achievedAt: string;
    }[];
  }> {
    const tz = tzOffsetMinutes;
    /** "YYYY-MM-DD" on the member's own calendar. */
    const dayKey = (at: Date) =>
      new Date(at.getTime() + tz * 60_000).toISOString().slice(0, 10);

    // The window starts at the member's local midnight `days` ago, so its edge
    // lines up with the day keys below rather than falling mid-day.
    const startKey = dayKey(new Date(Date.now() - days * 86_400_000));
    const since = new Date(new Date(`${startKey}T00:00:00Z`).getTime() - tz * 60_000);

    const logs = await this.tenant.client.workoutLog.findMany({
      where: { member_id: member.memberId, logged_at: { gte: since } },
      select: {
        id: true,
        logged_at: true,
        started_at: true,
        ended_at: true,
        sets: {
          select: {
            reps: true,
            weight: true,
            duration_seconds: true,
            exercise_id: true,
            exercise: {
              select: { name: true, muscle_group: true, target_muscle: true },
            },
          },
        },
      },
      orderBy: { logged_at: 'asc' },
    });

    let totalVolume = 0;
    let totalSeconds = 0;
    let totalSets = 0;
    let sessionSeconds = 0;
    let timedSessions = 0;
    const exercises = new Set<string>();
    const byDay = new Map<string, number>();
    const byMuscle = new Map<string, number>();
    const perExercise = new Map<string, { name: string; sessions: number }>();

    for (const log of logs) {
      // NOT toISOString() on the raw timestamp. That keys by UTC, so a 5am
      // session in IST (+5:30) was filed under the previous day — visible on
      // the calendar as a workout on a day the member did not train, and
      // invisible on the day they did.
      const day = dayKey(log.logged_at);
      byDay.set(day, (byDay.get(day) ?? 0) + log.sets.length);
      totalSets += log.sets.length;

      if (log.started_at && log.ended_at) {
        sessionSeconds += Math.max(
          0,
          Math.round((log.ended_at.getTime() - log.started_at.getTime()) / 1000),
        );
        timedSessions += 1;
      }

      const seenHere = new Set<string>();
      for (const set of log.sets) {
        totalVolume += (Number(set.weight) || 0) * (set.reps || 0);
        totalSeconds += set.duration_seconds ?? 0;
        exercises.add(set.exercise_id);

        // Counted per SET, not per session: three sets of squats is three
        // times the work of one, and a body map that cannot show that is
        // just a list of what you touched.
        const muscle = set.exercise?.target_muscle || set.exercise?.muscle_group;
        if (muscle) byMuscle.set(muscle, (byMuscle.get(muscle) ?? 0) + 1);
        if (!seenHere.has(set.exercise_id)) {
          seenHere.add(set.exercise_id);
          const prev = perExercise.get(set.exercise_id);
          perExercise.set(set.exercise_id, {
            name: set.exercise?.name ?? 'Exercise',
            sessions: (prev?.sessions ?? 0) + 1,
          });
        }
      }
    }

    // Streaks run over calendar days with at least one logged set. Computed
    // across the window only, so a longer streak that started before it is
    // reported as the part that falls inside.
    const days_ = [...byDay.keys()].sort();
    let longest = 0;
    let run = 0;
    let prev: Date | null = null;
    for (const d of days_) {
      const cur = new Date(d + 'T00:00:00Z');
      const consecutive =
        prev && Math.round((cur.getTime() - prev.getTime()) / 86_400_000) === 1;
      run = consecutive ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = cur;
    }

    // The current streak only counts if it reaches today or yesterday —
    // otherwise it is a streak the member has already broken.
    // Walk back from the member's today. Keys are plain dates, so stepping in
    // UTC across them is exact — no DST arithmetic, no drift.
    const todayUtc = new Date(`${dayKey(new Date())}T00:00:00Z`).getTime();
    let current = 0;
    for (let i = 0; ; i += 1) {
      const key = new Date(todayUtc - i * 86_400_000).toISOString().slice(0, 10);
      if (byDay.has(key)) current += 1;
      // Today not yet trained does not break the run — it is still live until
      // the day ends. Any other gap does.
      else if (i > 0) break;
      else continue;
    }

    // PRs come back with the stats rather than one request per exercise. The
    // client used to fetch history for every catalogue entry to build its PR
    // wall, which is N calls that grow with the gym's library — at 13 exercises
    // it was already tripping the rate limiter.
    const prRows = await this.tenant.client.personalRecord.findMany({
      where: { member_id: member.memberId },
      orderBy: { weight: 'desc' },
      select: {
        exercise_id: true,
        weight: true,
        reps: true,
        unit: true,
        achieved_at: true,
        exercise: { select: { name: true } },
      },
    });

    return {
      periodDays: days,
      workouts: logs.length,
      totalVolumeKg: Math.round(totalVolume),
      avgVolumeKg: logs.length ? Math.round(totalVolume / logs.length) : 0,
      totalSets,
      totalExercises: exercises.size,
      totalSeconds,
      timedSessions,
      avgSessionSeconds: timedSessions ? Math.round(sessionSeconds / timedSessions) : null,
      currentStreak: current,
      longestStreak: longest,
      activeDays: days_.map((d) => ({ date: d, sets: byDay.get(d) ?? 0 })),
      byMuscle: [...byMuscle.entries()]
        .map(([muscle, sets]) => ({ muscle, sets }))
        .sort((a, b) => b.sets - a.sets),
      mostPerformed: [...perExercise.entries()]
        .map(([exerciseId, v]) => ({ exerciseId, name: v.name, sessions: v.sessions }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 5),
      personalRecords: prRows.map((r) => ({
        exerciseId: r.exercise_id,
        name: r.exercise?.name ?? 'Exercise',
        weight: Number(r.weight) || 0,
        reps: r.reps,
        unit: r.unit,
        achievedAt: r.achieved_at.toISOString(),
      })),
    };
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
