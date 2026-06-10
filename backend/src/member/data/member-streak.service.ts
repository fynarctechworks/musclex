import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { computeStreakDays } from './mappers';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER STREAK SERVICE — single source of truth for the activity streak
 * ────────────────────────────────────────────────────────────────
 *
 * A member's streak counts each consecutive day on which they did SOMETHING
 * that counts as showing up: checked in at the gym, logged a workout, OR
 * logged a meal. Unifying the sources (vs. check-ins only) makes the streak
 * easier to keep — strictly better for retention — and, just as importantly,
 * gives every surface (Home, post-check-in, badges) ONE definition so they can
 * never drift apart. (Drift between duplicated definitions is exactly what has
 * caused tenant bugs here before — keep this the only place that knows the rule.)
 *
 * Tenant safety: all three reads filter by member_id and run on the
 * tenant-scoped Prisma client (gym_id auto-injected from the JWT-derived
 * context). CheckIn / WorkoutLog / MealLog are all in the tenant-model set.
 * Same-day activity from different sources is de-duplicated by computeStreakDays
 * (it keys on the calendar day), so logging a meal AND checking in on one day
 * counts as a single streak day.
 */
@Injectable()
export class MemberStreakService {
  /** How far back to scan activity when computing a streak. */
  private readonly windowDays = 90;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The union of a member's activity dates within the window: check-ins,
   * workout logs and meal logs. Returned unsorted/with duplicates — the day
   * de-duplication happens in computeStreakDays.
   */
  async getActivityDates(memberId: string): Promise<Date[]> {
    const since = new Date(Date.now() - this.windowDays * 86_400_000);
    const [checkIns, workouts, meals] = await Promise.all([
      this.prisma.checkIn.findMany({
        where: { member_id: memberId, checked_in_at: { gte: since } },
        select: { checked_in_at: true },
      }),
      this.prisma.workoutLog.findMany({
        where: { member_id: memberId, logged_at: { gte: since } },
        select: { logged_at: true },
      }),
      this.prisma.mealLog.findMany({
        where: { member_id: memberId, logged_at: { gte: since } },
        select: { logged_at: true },
      }),
    ]);

    return [
      ...checkIns.map((c) => c.checked_in_at),
      ...workouts.map((w) => w.logged_at),
      ...meals.map((m) => m.logged_at),
    ];
  }

  /** Current consecutive-day activity streak for the member. */
  async getStreakDays(memberId: string): Promise<number> {
    return computeStreakDays(await this.getActivityDates(memberId));
  }

  /**
   * Which streak-qualifying actions the member has already completed TODAY.
   * Powers the Home "Today" ritual card — each flag is an honest, server-verified
   * fact (we never guess "done"). Member-scoped, gym auto-injected.
   */
  async getTodayActivity(
    memberId: string,
  ): Promise<{ checkedIn: boolean; workoutLogged: boolean; mealLogged: boolean }> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [checkIn, workout, meal] = await Promise.all([
      this.prisma.checkIn.findFirst({
        where: { member_id: memberId, checked_in_at: { gte: startOfToday } },
        select: { id: true },
      }),
      this.prisma.workoutLog.findFirst({
        where: { member_id: memberId, logged_at: { gte: startOfToday } },
        select: { id: true },
      }),
      this.prisma.mealLog.findFirst({
        where: { member_id: memberId, logged_at: { gte: startOfToday } },
        select: { id: true },
      }),
    ]);

    return {
      checkedIn: !!checkIn,
      workoutLogged: !!workout,
      mealLogged: !!meal,
    };
  }
}
