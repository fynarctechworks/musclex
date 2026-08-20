import { MemberChallengeService } from './member-challenge.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * Member-made challenges. The interesting parts are the leaderboard maths —
 * which metric is being summed, and over exactly which days — because an
 * off-by-one at the window edge silently robs somebody of their last workout.
 */
describe('MemberChallengeService', () => {
  const me: CurrentMemberContext = {
    appUserId: 'me', memberId: 'm', tenantId: 't', isGymMember: true,
  };

  let pub: any;
  let service: MemberChallengeService;

  const challenge = (over: Record<string, unknown> = {}) => ({
    id: 'ch1',
    owner_id: 'me',
    title: 'August 100K',
    metric: 'distance_m',
    sport_type: null,
    target: 100000,
    starts_on: new Date('2026-08-01T00:00:00Z'),
    ends_on: new Date('2026-08-31T00:00:00Z'),
    participants: [
      { app_user_id: 'me', app_user: { id: 'me', full_name: 'Me' } },
      { app_user_id: 'alice', app_user: { id: 'alice', full_name: 'Alice' } },
    ],
    ...over,
  });

  beforeEach(() => {
    pub = {
      groupChallenge: {
        findUnique: jest.fn().mockResolvedValue(challenge()),
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ ...data, id: 'ch1', starts_on: new Date(data.starts_on), ends_on: new Date(data.ends_on) })),
      },
      groupChallengeParticipant: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      appUserActivity: { groupBy: jest.fn().mockResolvedValue([]) },
      follow: { findMany: jest.fn().mockResolvedValue([]) },
      block: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new MemberChallengeService(pub as any);
  });

  describe('creating', () => {
    it('puts the creator in it immediately', async () => {
      await service.create(me, {
        title: 'August 100K', metric: 'distance_m',
        startsOn: '2026-08-01', endsOn: '2026-08-31',
      } as any);
      expect(pub.groupChallengeParticipant.create.mock.calls[0][0].data.app_user_id).toBe('me');
    });

    it('rejects an unknown metric', async () => {
      await expect(
        service.create(me, {
          title: 'x', metric: 'vibes', startsOn: '2026-08-01', endsOn: '2026-08-31',
        } as any),
      ).rejects.toThrow(/unknown metric/i);
    });

    it('rejects an unknown sport', async () => {
      await expect(
        service.create(me, {
          title: 'x', metric: 'distance_m', sportType: 'quidditch',
          startsOn: '2026-08-01', endsOn: '2026-08-31',
        } as any),
      ).rejects.toThrow(/unknown sport/i);
    });

    it('rejects a window that ends before it starts', async () => {
      await expect(
        service.create(me, {
          title: 'x', metric: 'distance_m', startsOn: '2026-08-31', endsOn: '2026-08-01',
        } as any),
      ).rejects.toThrow(/before it starts/i);
    });
  });

  describe('the leaderboard window', () => {
    it('includes the whole of the final day', async () => {
      // ends_on is a DATE. Querying `lte ends_on` would cut the last day off at
      // midnight and lose every workout done on it.
      await service.get(me, 'ch1');
      const where = pub.appUserActivity.groupBy.mock.calls[0][0].where;
      expect(where.started_at.gte).toEqual(new Date('2026-08-01T00:00:00Z'));
      expect(where.started_at.lt).toEqual(new Date('2026-09-01T00:00:00Z'));
    });

    it('filters by sport only when the challenge names one', async () => {
      await service.get(me, 'ch1');
      expect(pub.appUserActivity.groupBy.mock.calls[0][0].where.sport_type).toBeUndefined();

      pub.groupChallenge.findUnique.mockResolvedValue(challenge({ sport_type: 'ride' }));
      await service.get(me, 'ch1');
      expect(pub.appUserActivity.groupBy.mock.calls[1][0].where.sport_type).toBe('ride');
    });
  });

  describe('the leaderboard values', () => {
    const withTotals = (rows: any[]) => pub.appUserActivity.groupBy.mockResolvedValue(rows);

    it('sums distance for a distance challenge', async () => {
      withTotals([
        { app_user_id: 'alice', _sum: { distance_m: 42000 }, _count: { _all: 4 } },
        { app_user_id: 'me', _sum: { distance_m: 31000 }, _count: { _all: 6 } },
      ]);
      const out: any = await service.get(me, 'ch1');
      expect(out.leaderboard.map((r: any) => [r.name, r.value, r.rank])).toEqual([
        ['Alice', 42000, 1],
        ['Me', 31000, 2],
      ]);
    });

    it('counts activities for a count challenge — the other order entirely', async () => {
      pub.groupChallenge.findUnique.mockResolvedValue(challenge({ metric: 'activity_count' }));
      withTotals([
        { app_user_id: 'alice', _sum: { distance_m: 42000 }, _count: { _all: 4 } },
        { app_user_id: 'me', _sum: { distance_m: 31000 }, _count: { _all: 6 } },
      ]);
      const out: any = await service.get(me, 'ch1');
      expect(out.leaderboard.map((r: any) => [r.name, r.value])).toEqual([['Me', 6], ['Alice', 4]]);
    });

    it('gives a participant with no activities a zero, not a missing row', async () => {
      // Dropping them would make it look like they left.
      withTotals([{ app_user_id: 'alice', _sum: { distance_m: 5000 }, _count: { _all: 1 } }]);
      const out: any = await service.get(me, 'ch1');
      expect(out.leaderboard).toHaveLength(2);
      expect(out.leaderboard.find((r: any) => r.mine).value).toBe(0);
    });

    it('drops blocked people from the board', async () => {
      pub.block.findMany.mockResolvedValue([{ blocker_id: 'me', blocked_id: 'alice' }]);
      const out: any = await service.get(me, 'ch1');
      expect(out.leaderboard.map((r: any) => r.name)).toEqual(['Me']);
    });
  });

  describe('access', () => {
    it('is invite-only — a non-participant cannot read the board', async () => {
      pub.groupChallenge.findUnique.mockResolvedValue(
        challenge({ participants: [{ app_user_id: 'alice', app_user: { id: 'alice', full_name: 'Alice' } }] }),
      );
      await expect(service.get(me, 'ch1')).rejects.toThrow(/not found/i);
    });

    it('refuses to join one that has already finished', async () => {
      pub.groupChallenge.findUnique.mockResolvedValue({
        id: 'ch1', ends_on: new Date('2020-01-01T00:00:00Z'),
      });
      await expect(service.join(me, 'ch1')).rejects.toThrow(/already finished/i);
    });

    it('joining twice is joining once', async () => {
      pub.groupChallenge.findUnique.mockResolvedValue({
        id: 'ch1', ends_on: new Date('2099-01-01T00:00:00Z'),
      });
      pub.groupChallengeParticipant.findFirst.mockResolvedValue({ id: 'p1' });
      await service.join(me, 'ch1');
      expect(pub.groupChallengeParticipant.create).not.toHaveBeenCalled();
    });

    it('only the owner may invite — an open invite is a spam vector', async () => {
      pub.groupChallenge.findUnique.mockResolvedValue({ id: 'ch1', owner_id: 'alice' });
      await expect(service.invite(me, 'ch1', 'bob')).rejects.toThrow(/only the person who made it/i);
    });

    it('will not invite someone blocked', async () => {
      pub.groupChallenge.findUnique.mockResolvedValue({ id: 'ch1', owner_id: 'me' });
      pub.block.findMany.mockResolvedValue([{ blocker_id: 'me', blocked_id: 'troll' }]);
      await expect(service.invite(me, 'ch1', 'troll')).rejects.toThrow(/not found/i);
    });
  });
});
