import { computeStreakDays } from './mappers';
import { MemberStreakService } from './member-streak.service';

/** A Date `n` whole days before now. */
const daysAgo = (n: number): Date => new Date(Date.now() - n * 86_400_000);

describe('computeStreakDays — unified activity streak', () => {
  it('returns 0 for no activity', () => {
    expect(computeStreakDays([])).toBe(0);
  });

  it('counts a single day of activity today', () => {
    expect(computeStreakDays([daysAgo(0)])).toBe(1);
  });

  it('counts consecutive days ending today', () => {
    expect(computeStreakDays([daysAgo(0), daysAgo(1), daysAgo(2)])).toBe(3);
  });

  it('still counts when today is missing but yesterday is present', () => {
    // The loop is allowed to start from yesterday (today not yet visited is OK).
    expect(computeStreakDays([daysAgo(1), daysAgo(2)])).toBe(2);
  });

  it('breaks the streak on a gap day', () => {
    // today + 2-days-ago, but yesterday missing → only today counts.
    expect(computeStreakDays([daysAgo(0), daysAgo(2), daysAgo(3)])).toBe(1);
  });

  it('de-duplicates multiple activities on the same calendar day', () => {
    // e.g. a check-in AND a workout AND a meal, all logged today → 1 day.
    const today = daysAgo(0);
    expect(
      computeStreakDays([
        new Date(today),
        new Date(today.getTime() + 3_600_000), // +1h, same day
        new Date(today.getTime() + 7_200_000), // +2h, same day
      ]),
    ).toBe(1);
  });

  it('unifies sources: a streak held by mixing check-ins, workouts and meals', () => {
    // day0 check-in, day1 workout, day2 meal — three different sources, one streak.
    expect(computeStreakDays([daysAgo(0), daysAgo(1), daysAgo(2)])).toBe(3);
  });
});

describe('MemberStreakService — source union + member scoping', () => {
  let prisma: any;
  let service: MemberStreakService;

  beforeEach(() => {
    prisma = {
      checkIn: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
      workoutLog: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
      mealLog: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    };
    service = new MemberStreakService( { client: prisma } as any);
  });

  it('queries all three sources, each filtered by the authenticated member_id', async () => {
    await service.getActivityDates('mA');

    for (const model of ['checkIn', 'workoutLog', 'mealLog'] as const) {
      expect(prisma[model].findMany).toHaveBeenCalledTimes(1);
      expect(prisma[model].findMany.mock.calls[0][0].where.member_id).toBe('mA');
    }
  });

  it('unions dates from check-ins, workout logs and meal logs', async () => {
    prisma.checkIn.findMany.mockResolvedValue([{ checked_in_at: daysAgo(0) }]);
    prisma.workoutLog.findMany.mockResolvedValue([{ logged_at: daysAgo(1) }]);
    prisma.mealLog.findMany.mockResolvedValue([{ logged_at: daysAgo(2) }]);

    const dates = await service.getActivityDates('mA');
    expect(dates).toHaveLength(3);
    expect(await service.getStreakDays('mA')).toBe(3);
  });

  it('a meal-only day still extends the streak (not check-in-only)', async () => {
    prisma.checkIn.findMany.mockResolvedValue([{ checked_in_at: daysAgo(0) }]);
    prisma.mealLog.findMany.mockResolvedValue([{ logged_at: daysAgo(1) }]);
    // no workouts, no check-in yesterday — meal yesterday keeps the streak alive.
    expect(await service.getStreakDays('mA')).toBe(2);
  });

  describe('getTodayActivity', () => {
    it('reports false for every action when nothing is logged today', async () => {
      expect(await service.getTodayActivity('mA')).toEqual({
        checkedIn: false,
        workoutLogged: false,
        mealLogged: false,
      });
    });

    it('reflects which sources have an entry today, each scoped to the member', async () => {
      prisma.checkIn.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.mealLog.findFirst.mockResolvedValue({ id: 'm1' });
      // workoutLog stays null

      const today = await service.getTodayActivity('mA');
      expect(today).toEqual({ checkedIn: true, workoutLogged: false, mealLogged: true });

      for (const model of ['checkIn', 'workoutLog', 'mealLog'] as const) {
        expect(prisma[model].findFirst.mock.calls[0][0].where.member_id).toBe('mA');
      }
    });
  });
});

/**
 * The streak's day boundary belongs to the MEMBER, not the server.
 *
 * These were not covered before, and the gap was load-bearing: the day used to
 * be keyed with getFullYear()/getMonth(), i.e. the server's calendar, which is
 * only correct while the server and the member share a timezone. It passed on
 * a dev box set to Asia/Calcutta and would have broken on a UTC host.
 */
describe('computeStreakDays — whose day is it', () => {
  const IST = 330;

  it('counts a small-hours session as the member\'s today, not yesterday', () => {
    // 01:00 IST today = 19:30 UTC yesterday.
    const nowIst = new Date(Date.now() + IST * 60_000);
    const todayIstMidnightUtc = new Date(
      new Date(`${nowIst.toISOString().slice(0, 10)}T00:00:00Z`).getTime() - IST * 60_000,
    );
    const oneAmIst = new Date(todayIstMidnightUtc.getTime() + 60 * 60_000);
    expect(computeStreakDays([oneAmIst], IST)).toBe(1);
  });

  it('merges two sessions either side of UTC midnight but inside one local day', () => {
    const nowIst = new Date(Date.now() + IST * 60_000);
    const midnightUtc = new Date(
      new Date(`${nowIst.toISOString().slice(0, 10)}T00:00:00Z`).getTime() - IST * 60_000,
    );
    const early = new Date(midnightUtc.getTime() + 60 * 60_000);       // 01:00 local
    const late = new Date(midnightUtc.getTime() + 22 * 60 * 60_000);   // 22:00 local
    // One day, not two — so a two-day run does not appear from one day's work.
    expect(computeStreakDays([early, late], IST)).toBe(1);
  });

  it('is 0 with no activity at all', () => {
    expect(computeStreakDays([], IST)).toBe(0);
  });

  it('survives a gap by ending the run', () => {
    const day = 86_400_000;
    const now = Date.now();
    expect(
      computeStreakDays([new Date(now), new Date(now - day), new Date(now - 3 * day)], IST),
    ).toBe(2);
  });
});
