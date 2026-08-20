import { MemberWorkoutService } from './member-workout.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * Which calendar day a workout belongs to.
 *
 * `stats` reports almost everything in days — active days, both streaks, and
 * the training calendar built on top of them. The day was keyed off
 * `logged_at.toISOString()`, i.e. UTC, so for a member anywhere east of
 * Greenwich an early-morning session was filed under the day before. In IST
 * (+5:30) anything logged before 05:30 landed on yesterday: the calendar showed
 * a session on a day they rested, and nothing on the day they trained.
 *
 * These pin the fix in the member's own timezone rather than the server's.
 */
describe('MemberWorkoutService.stats — day keying', () => {
  const member: CurrentMemberContext = {
    appUserId: 'au1', memberId: 'm1', tenantId: 't1', isGymMember: true,
  };
  const IST = 330; // minutes east of UTC

  let prisma: any;
  let service: MemberWorkoutService;

  /** One log with `n` sets at an exact instant. */
  const log = (isoUtc: string, n = 1) => ({
    id: `l-${isoUtc}`,
    logged_at: new Date(isoUtc),
    started_at: null,
    ended_at: null,
    sets: Array.from({ length: n }, () => ({
      reps: 10, weight: 20, duration_seconds: null,
      exercise_id: 'e1', exercise: { name: 'Bench' },
    })),
  });

  const build = (logs: any[]) => {
    prisma = {
      workoutLog: { findMany: jest.fn().mockResolvedValue(logs) },
      personalRecord: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new MemberWorkoutService({ client: prisma } as any, {} as any);
  };

  it('files a small-hours session under the member\'s day, not UTC\'s', async () => {
    // 01:30 on 20 Aug in IST is 20:00 on 19 Aug UTC.
    build([log('2026-08-19T20:00:00Z', 5)]);
    const out = await service.stats(member, 30, IST);
    expect(out.activeDays).toEqual([{ date: '2026-08-20', sets: 5 }]);
  });

  it('still reports UTC when no offset is given, so old callers do not shift', async () => {
    build([log('2026-08-19T20:00:00Z', 5)]);
    const out = await service.stats(member, 30);
    expect(out.activeDays).toEqual([{ date: '2026-08-19', sets: 5 }]);
  });

  it('merges two sessions that share a local day but straddle UTC midnight', async () => {
    // 06:00 IST on the 20th (00:30 UTC) and 23:00 IST on the 20th (17:30 UTC).
    // Keyed by UTC these are one day apart; to the member they are one day.
    build([log('2026-08-20T00:30:00Z', 4), log('2026-08-20T17:30:00Z', 6)]);
    const out = await service.stats(member, 30, IST);
    expect(out.activeDays).toEqual([{ date: '2026-08-20', sets: 10 }]);
  });

  it('counts a run of local days as one streak', async () => {
    const now = new Date();
    const at = (daysAgo: number) =>
      new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
    build([log(at(0)), log(at(1)), log(at(2))]);
    const out = await service.stats(member, 30, IST);
    expect(out.currentStreak).toBe(3);
    expect(out.longestStreak).toBe(3);
  });

  it('keeps a streak alive on a day not yet trained', async () => {
    const now = new Date();
    const at = (daysAgo: number) =>
      new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
    build([log(at(1)), log(at(2))]);
    const out = await service.stats(member, 30, IST);
    expect(out.currentStreak).toBe(2);
  });

  it('breaks the streak on a real gap', async () => {
    const now = new Date();
    const at = (daysAgo: number) =>
      new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
    build([log(at(0)), log(at(3)), log(at(4))]);
    const out = await service.stats(member, 30, IST);
    expect(out.currentStreak).toBe(1);
    expect(out.longestStreak).toBe(2);
  });

  it('handles a negative offset without shifting the wrong way', async () => {
    // 22:00 on 19 Aug UTC is 17:00 on 19 Aug in New York (-300).
    build([log('2026-08-19T22:00:00Z', 3)]);
    const out = await service.stats(member, 30, -300);
    expect(out.activeDays).toEqual([{ date: '2026-08-19', sets: 3 }]);
  });

  it('asks the database for a window starting at the member\'s local midnight', async () => {
    build([]);
    await service.stats(member, 7, IST);
    const since: Date = prisma.workoutLog.findMany.mock.calls[0][0].where.logged_at.gte;
    // Local midnight in IST is 18:30 UTC the previous day.
    expect(since.getUTCHours()).toBe(18);
    expect(since.getUTCMinutes()).toBe(30);
  });
});
