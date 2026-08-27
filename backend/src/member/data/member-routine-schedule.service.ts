import { Injectable } from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER ROUTINE SCHEDULE
 * ────────────────────────────────────────────────────────────────
 *
 * Which routine the member trains on each weekday, and what to do when they
 * miss one.
 *
 * WHY THIS EXISTS. Routines used to carry a name, notes and a list of
 * exercises — and no schedule. Two consequences, both on the home screen:
 * `todayWorkout` was built only from trainer-assigned rows, so a self-directed
 * member had no path to a non-null value and read "Nothing assigned today"
 * every day forever; and nothing could be "missed", because nothing was ever
 * planned.
 *
 * THE OFFSET. Resuming a missed session shifts the whole week forward, so a
 * Push/Pull/Legs cycle keeps its ORDER rather than its calendar. That shift is
 * held as `members.schedule_offset_days` and applied when resolving a weekday,
 * never by rewriting the schedule rows: rewriting would permanently destroy the
 * days the member actually chose — a Monday person quietly becomes a Tuesday
 * person, and a second missed day compounds it with no way back.
 *
 * DAYS ARE THE MEMBER'S, NOT THE SERVER'S. Every boundary here is computed from
 * the device's `tzOffsetMinutes`, the same way the streak card does it. A
 * schedule keyed on weekday is meaningless if the server's Monday and the
 * member's Monday are different days.
 */

/** 0 = Sunday .. 6 = Saturday, matching Date#getUTCDay and the DB check. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ScheduledRoutine {
  routineId: string;
  name: string;
  exerciseCount: number;
}

export interface TodayPlan {
  /** What to train today, or null on a rest day / with nothing set up. */
  routine: ScheduledRoutine | null;
  /** True when a schedule exists but today is deliberately a rest day. */
  restDay: boolean;
  /** True when the member has no schedule at all — nothing set up yet. */
  unscheduled: boolean;
}

export interface MissedDay {
  /** The routine that was planned and not done, in the member's own days. */
  routine: ScheduledRoutine;
  /** ISO date (YYYY-MM-DD) it was scheduled for. */
  date: string;
  /** Weekday name for the copy, e.g. "Thursday". */
  weekdayName: string;
}

const DAY_MS = 86_400_000;
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * The member's local calendar date, as a UTC-midnight Date.
 *
 * Shifting by the offset and then reading the UTC parts gives the member's
 * OWN day without pulling in a timezone library: the result is only ever used
 * for its date and weekday, never as a real instant.
 */
function localDay(tzOffsetMinutes: number, daysAgo = 0): Date {
  const shifted = new Date(Date.now() + tzOffsetMinutes * 60_000 - daysAgo * DAY_MS);
  return new Date(`${shifted.toISOString().slice(0, 10)}T00:00:00Z`);
}

/** The instant that local day begins, for comparing against stored timestamps. */
function startOfLocalDay(day: Date, tzOffsetMinutes: number): Date {
  return new Date(day.getTime() - tzOffsetMinutes * 60_000);
}

@Injectable()
export class MemberRoutineScheduleService {
  constructor(private readonly tenant: TenantPrisma) {}

  /**
   * Which weekday's routine to show for a given day.
   *
   * The offset is SUBTRACTED: an offset of 1 means the member is a day behind
   * their stated week, so today should show what they had planned for
   * yesterday's slot. Modulo is written to stay non-negative — JavaScript's %
   * returns a negative for a negative left operand, which would miss every row.
   */
  private resolveWeekday(day: Date, offsetDays: number): Weekday {
    return (((day.getUTCDay() - offsetDays) % 7) + 7) % 7 as Weekday;
  }

  private async offsetFor(memberId: string): Promise<number> {
    const m = await this.tenant.client.member.findFirst({
      where: { id: memberId },
      select: { schedule_offset_days: true },
    });
    return m?.schedule_offset_days ?? 0;
  }

  private async routineForWeekday(
    memberId: string,
    weekday: Weekday,
  ): Promise<ScheduledRoutine | null> {
    const row = await this.tenant.client.memberRoutineSchedule.findFirst({
      where: { member_id: memberId, weekday },
      select: {
        routine: {
          select: { id: true, name: true, _count: { select: { exercises: true } } },
        },
      },
    });
    if (!row?.routine) return null;
    return {
      routineId: row.routine.id,
      name: row.routine.name,
      exerciseCount: row.routine._count.exercises,
    };
  }

  /** Does this member have any schedule at all? */
  private async hasSchedule(memberId: string): Promise<boolean> {
    const any = await this.tenant.client.memberRoutineSchedule.findFirst({
      where: { member_id: memberId },
      select: { id: true },
    });
    return any !== null;
  }

  /**
   * What the member is meant to train today.
   *
   * Distinguishes three states the home card must show differently: a routine,
   * a deliberate rest day, and nothing set up at all. Collapsing the last two
   * is what made the old card lie — it said "nothing assigned" to people who
   * had a full week planned and simply had Sunday off.
   */
  async getTodayPlan(
    member: CurrentMemberContext,
    tzOffsetMinutes = 0,
  ): Promise<TodayPlan> {
    const [offset, scheduled] = await Promise.all([
      this.offsetFor(member.memberId),
      this.hasSchedule(member.memberId),
    ]);
    if (!scheduled) return { routine: null, restDay: false, unscheduled: true };

    const weekday = this.resolveWeekday(localDay(tzOffsetMinutes), offset);
    const routine = await this.routineForWeekday(member.memberId, weekday);
    return { routine, restDay: routine === null, unscheduled: false };
  }

  /**
   * Yesterday's planned routine, when it was planned and not done.
   *
   * YESTERDAY ONLY, deliberately. A member back from a week away should be
   * asked one question, not interrogated about six missed sessions — the point
   * is to help them resume, not to present a backlog.
   *
   * "Not done" means no workout log for THAT routine on that day. Before
   * `workout_logs.routine_id` existed the only answerable question was "did
   * they train at all", which would have counted an ad-hoc swim as leg day and
   * shifted a whole week on the strength of it.
   */
  async getMissedYesterday(
    member: CurrentMemberContext,
    tzOffsetMinutes = 0,
  ): Promise<MissedDay | null> {
    const offset = await this.offsetFor(member.memberId);
    const yesterday = localDay(tzOffsetMinutes, 1);
    const weekday = this.resolveWeekday(yesterday, offset);

    const routine = await this.routineForWeekday(member.memberId, weekday);
    if (!routine) return null; // a rest day cannot be missed

    const from = startOfLocalDay(yesterday, tzOffsetMinutes);
    const to = new Date(from.getTime() + DAY_MS);
    const done = await this.tenant.client.workoutLog.findFirst({
      where: {
        member_id: member.memberId,
        routine_id: routine.routineId,
        logged_at: { gte: from, lt: to },
      },
      select: { id: true },
    });
    if (done) return null;

    return {
      routine,
      date: yesterday.toISOString().slice(0, 10),
      weekdayName: WEEKDAY_NAMES[yesterday.getUTCDay()],
    };
  }

  /**
   * "Do it now" — take up yesterday's session and slide the rest of the week.
   *
   * Incrementing the offset is the whole shift: every later day now resolves to
   * what it would have been a day earlier, so the cycle keeps its order. The
   * member's chosen weekdays are untouched and `resetShift` puts them back.
   */
  async resumeMissed(member: CurrentMemberContext): Promise<{ offsetDays: number }> {
    const current = await this.offsetFor(member.memberId);
    // Bounded to one week. Beyond that the member is not "a few days behind",
    // they have stopped following the schedule, and an unbounded counter would
    // silently wander their week for months.
    const next = (current + 1) % 7;
    await this.tenant.client.member.update({
      where: { id: member.memberId },
      data: { schedule_offset_days: next },
    });
    return { offsetDays: next };
  }

  /** "Skip to today's" — yesterday is let go and the week is left alone. */
  async skipMissed(_member: CurrentMemberContext): Promise<{ offsetDays: number }> {
    // Deliberately a no-op on the schedule. Skipping means the member is back
    // on their normal week, which is exactly what the untouched offset says.
    return { offsetDays: await this.offsetFor(_member.memberId) };
  }

  /** "Back to my normal week" — undo every accumulated shift. */
  async resetShift(member: CurrentMemberContext): Promise<{ offsetDays: number }> {
    await this.tenant.client.member.update({
      where: { id: member.memberId },
      data: { schedule_offset_days: 0 },
    });
    return { offsetDays: 0 };
  }

  /** The member's whole week, for the schedule editor. */
  async getSchedule(
    member: CurrentMemberContext,
  ): Promise<{ days: { weekday: Weekday; routine: ScheduledRoutine | null }[]; offsetDays: number }> {
    const [rows, offsetDays] = await Promise.all([
      this.tenant.client.memberRoutineSchedule.findMany({
        where: { member_id: member.memberId },
        select: {
          weekday: true,
          routine: {
            select: { id: true, name: true, _count: { select: { exercises: true } } },
          },
        },
      }),
      this.offsetFor(member.memberId),
    ]);

    const byDay = new Map<number, ScheduledRoutine>();
    for (const r of rows) {
      if (!r.routine) continue;
      byDay.set(r.weekday, {
        routineId: r.routine.id,
        name: r.routine.name,
        exerciseCount: r.routine._count.exercises,
      });
    }

    return {
      days: ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((weekday) => ({
        weekday,
        routine: byDay.get(weekday) ?? null,
      })),
      offsetDays,
    };
  }

  /**
   * Set (or clear) the routine for one weekday.
   *
   * Passing a null routine clears the day, which is how a rest day is
   * expressed — the absence of a row, not a special "rest" routine.
   */
  async setDay(
    member: CurrentMemberContext,
    weekday: Weekday,
    routineId: string | null,
  ): Promise<void> {
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw MemberException.badRequest('weekday must be 0-6.');
    }

    if (routineId === null) {
      await this.tenant.client.memberRoutineSchedule.deleteMany({
        where: { member_id: member.memberId, weekday },
      });
      return;
    }

    // Ownership gate. The routine id comes from the client, and without this a
    // member could schedule — and therefore read the name and exercise count
    // of — another member's routine.
    const owned = await this.tenant.client.memberRoutine.findFirst({
      where: { id: routineId, member_id: member.memberId },
      select: { id: true },
    });
    if (!owned) throw MemberException.notFound('Routine not found.');

    const existing = await this.tenant.client.memberRoutineSchedule.findFirst({
      where: { member_id: member.memberId, weekday },
      select: { id: true },
    });

    if (existing) {
      await this.tenant.client.memberRoutineSchedule.update({
        where: { id: existing.id },
        data: { routine_id: routineId },
      });
      return;
    }

    await this.tenant.client.memberRoutineSchedule.create({
      data: {
        gym_id: member.tenantId,
        member_id: member.memberId,
        routine_id: routineId,
        weekday,
      },
    });
  }
}
