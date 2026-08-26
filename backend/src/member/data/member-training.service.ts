import { Injectable } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import {
  activityLoad,
  formAdvice,
  formSeries,
  DEFAULT_HR_MAX,
  DEFAULT_HR_REST,
  zoneBands,
  type DailyLoad,
} from './training-load';
import { bestOneRepMax, predictRaces } from './predictions';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER TRAINING SERVICE — the numbers Strava paywalls
 * ────────────────────────────────────────────────────────────────
 *
 * Everything here is COMPUTED from data already stored. Nothing is
 * persisted: a cached training load drifts the moment an activity is edited
 * or deleted, and a leaderboard that is quietly wrong for a fortnight is
 * worse than one that takes an extra query.
 *
 * Activities live in `public`; strength sets live in the member's GYM schema.
 * The two are read separately and never joined — the gym-scoped read goes
 * through the tenant client so gym_id is injected, and the public read is
 * keyed by app_user_id. Neither can see another member's rows.
 */
@Injectable()
export class MemberTrainingService {
  private static readonly WINDOW_DAYS = 120;

  constructor(
    private readonly pub: PublicPrismaService,
    private readonly tenant: TenantPrisma,
  ) {}

  private dayKey(at: Date, tzOffsetMinutes: number): string {
    return new Date(at.getTime() + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
  }

  /**
   * Fitness, fatigue and form over the window, plus today's headline.
   *
   * The daily series is built in the member's OWN calendar — the same rule as
   * the streak and the training calendar. A session at 1am is that day's
   * training to the person who did it.
   */
  async load(member: CurrentMemberContext, tzOffsetMinutes = 0, days = 90) {
    const window = Math.min(Math.max(days, 7), MemberTrainingService.WINDOW_DAYS);
    const since = new Date(Date.now() - window * 86_400_000);

    const activities = await this.pub.appUserActivity.findMany({
      where: { app_user_id: member.appUserId, started_at: { gte: since } },
      select: {
        sport_type: true, started_at: true, elapsed_seconds: true,
        moving_seconds: true, avg_heart_rate: true,
      },
      orderBy: { started_at: 'asc' },
    });

    const byDay = new Map<string, number>();
    let measured = 0;
    for (const a of activities) {
      const { score, basis } = activityLoad({
        sportType: a.sport_type,
        movingSeconds: a.moving_seconds,
        elapsedSeconds: a.elapsed_seconds,
        avgHeartRate: a.avg_heart_rate,
      });
      if (basis === 'heart_rate') measured++;
      const key = this.dayKey(a.started_at, tzOffsetMinutes);
      byDay.set(key, (byDay.get(key) ?? 0) + score);
    }

    const daily: DailyLoad[] = [...byDay.entries()].map(([date, load]) => ({ date, load }));
    const from = this.dayKey(since, tzOffsetMinutes);
    const to = this.dayKey(new Date(), tzOffsetMinutes);
    const series = formSeries(daily, from, to);
    const today = series[series.length - 1] ?? { fitness: 0, fatigue: 0, form: 0, date: to };

    return {
      series,
      today: { ...today, ...formAdvice(today.form) },
      // Said plainly, because it changes how much the numbers are worth: with
      // no heart rate everything above is estimated from duration and sport.
      basis: {
        activities: activities.length,
        withHeartRate: measured,
        estimated: activities.length - measured,
      },
    };
  }

  /**
   * Projected race times from the member's best recent effort.
   *
   * Uses the fastest PACE over a real distance rather than the longest run:
   * predicting from a slow long run flatters nobody and helps no one.
   */
  async racePredictions(member: CurrentMemberContext) {
    const since = new Date(Date.now() - 180 * 86_400_000);
    const runs = await this.pub.appUserActivity.findMany({
      where: {
        app_user_id: member.appUserId,
        started_at: { gte: since },
        sport_type: { in: ['run', 'trail_run'] },
        distance_m: { gte: 3000 },
      },
      select: { distance_m: true, moving_seconds: true, elapsed_seconds: true, started_at: true },
    });

    let best: { distanceM: number; seconds: number; at: Date } | null = null;
    for (const r of runs) {
      const distance = Number(r.distance_m ?? 0);
      const seconds = r.moving_seconds ?? r.elapsed_seconds;
      if (distance <= 0 || !seconds) continue;
      const pace = seconds / distance;
      if (!best || pace < best.seconds / best.distanceM) {
        best = { distanceM: distance, seconds, at: r.started_at };
      }
    }
    if (!best) return { from: null, predictions: [] };

    return {
      from: {
        distanceM: Math.round(best.distanceM),
        seconds: best.seconds,
        at: best.at.toISOString(),
      },
      predictions: predictRaces(best.distanceM, best.seconds),
    };
  }

  /**
   * Projected one-rep max per exercise.
   *
   * The half Strava cannot do: they record weight training as a stopwatch, so
   * they have no weight and no reps to project from. Gym-scoped — the sets
   * live in the member's studio schema and are read through the tenant client.
   */
  async strengthPredictions(member: CurrentMemberContext, limit = 10) {
    if (!member.memberId) return { lifts: [] };

    const since = new Date(Date.now() - 90 * 86_400_000);
    const sets = await this.tenant.client.workoutSetLog.findMany({
      where: {
        workout_log: { member_id: member.memberId, logged_at: { gte: since } },
        weight: { gt: 0 },
        reps: { gt: 0 },
      },
      select: {
        weight: true, reps: true, exercise_id: true,
        exercise: { select: { name: true } },
      },
      take: 5000,
    });

    const byExercise = new Map<string, { name: string; sets: { weight: number; reps: number }[] }>();
    for (const s of sets) {
      const entry = byExercise.get(s.exercise_id) ?? {
        name: s.exercise?.name ?? 'Exercise',
        sets: [],
      };
      entry.sets.push({ weight: Number(s.weight) || 0, reps: s.reps ?? 0 });
      byExercise.set(s.exercise_id, entry);
    }

    const lifts = [...byExercise.entries()]
      .flatMap(([exerciseId, v]) => {
        const est = bestOneRepMax(v.sets);
        // flatMap over an empty array rather than filter(Boolean): the latter
        // does not narrow the type, and a maybe-null lift downstream is a lie.
        return est
          ? [{
              exerciseId,
              name: v.name,
              oneRepMax: est.value,
              fromWeight: est.fromWeight,
              fromReps: est.fromReps,
              confident: est.confident,
              setsConsidered: v.sets.length,
            }]
          : [];
      })
      .sort((a, b) => b.oneRepMax - a.oneRepMax)
      .slice(0, limit);

    return { lifts };
  }

  /**
   * The member's heart-rate zones, from their own max or the default.
   *
   * The band table itself lives in training-load.ts because the per-activity
   * zone breakdown uses the same edges, and two copies would drift.
   */
  zones(hrMax = DEFAULT_HR_MAX, hrRest = DEFAULT_HR_REST) {
    return { hrMax, hrRest, zones: zoneBands(hrMax, hrRest) };
  }
}
