import { MemberPeopleService } from './member-people.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * Finding people is where a fitness app is most tempted to over-collect. The
 * tests that matter here are the ones about what we DO NOT do: no address book
 * reaches the server, nobody blocked is ever surfaced, and an id is not a way
 * to read somebody's profile.
 */
describe('MemberPeopleService', () => {
  const me: CurrentMemberContext = {
    appUserId: 'me', memberId: 'm', tenantId: 't', isGymMember: true,
  };

  let pub: any;
  let config: any;
  let service: MemberPeopleService;

  beforeEach(() => {
    pub = {
      follow: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      block: { findMany: jest.fn().mockResolvedValue([]) },
      clubMember: { findMany: jest.fn().mockResolvedValue([]) },
      friendship: { findMany: jest.fn().mockResolvedValue([]) },
      appUser: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'alice', full_name: 'Alice' }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    config = { get: jest.fn().mockReturnValue('test.salt') };
    service = new MemberPeopleService(pub as any, config as any);
  });

  describe('suggestions', () => {
    it('never suggests the member themselves', async () => {
      pub.friendship.findMany.mockResolvedValue([
        { requester_id: 'me', addressee_id: 'me' },
      ]);
      expect((await service.suggestions(me)).people).toEqual([]);
    });

    it('never suggests someone already followed', async () => {
      pub.follow.findMany.mockResolvedValue([{ followee_id: 'alice' }]);
      pub.clubMember.findMany.mockResolvedValue([{ app_user_id: 'alice' }]);
      expect((await service.suggestions(me)).people).toEqual([]);
      expect(pub.appUser.findMany).not.toHaveBeenCalled();
    });

    it('never suggests someone blocked in either direction', async () => {
      pub.block.findMany.mockResolvedValue([{ blocker_id: 'troll', blocked_id: 'me' }]);
      pub.clubMember.findMany.mockResolvedValue([{ app_user_id: 'troll' }]);
      expect((await service.suggestions(me)).people).toEqual([]);
    });

    it('ranks someone reachable several ways above someone reachable one', async () => {
      pub.follow.findMany.mockImplementation(({ where }: any) =>
        // First call loads who I follow; the second loads who THEY follow.
        where.follower_id === 'me'
          ? Promise.resolve([{ followee_id: 'mutual' }])
          : Promise.resolve([{ followee_id: 'popular' }]),
      );
      pub.clubMember.findMany.mockResolvedValue([
        { app_user_id: 'popular' },
        { app_user_id: 'quiet' },
      ]);
      pub.appUser.findMany.mockResolvedValue([
        { id: 'popular', full_name: 'Popular' },
        { id: 'quiet', full_name: 'Quiet' },
      ]);
      const out = await service.suggestions(me);
      expect(out.people[0].name).toBe('Popular');
    });

    it('explains itself — a suggestion with no reason is unsettling', async () => {
      pub.clubMember.findMany.mockResolvedValue([{ app_user_id: 'alice' }]);
      pub.appUser.findMany.mockResolvedValue([{ id: 'alice', full_name: 'Alice' }]);
      expect((await service.suggestions(me)).people[0].reason).toBe('in a club with you');
    });
  });

  describe('contact matching', () => {
    it('sends nothing to the database for an empty list', async () => {
      expect(await service.matchContacts(me, [])).toEqual({ people: [] });
      expect(pub.$queryRaw).not.toHaveBeenCalled();
    });

    it('refuses more than a phone book', async () => {
      const many = new Array(2001).fill('a'.repeat(64));
      await expect(service.matchContacts(me, many)).rejects.toThrow(/at most 2000/i);
    });

    it('drops anything that is not a sha-256 digest', async () => {
      // A client sending raw phone numbers here must not have them queried.
      await service.matchContacts(me, ['9877000111', 'not-a-hash', '']);
      expect(pub.$queryRaw).not.toHaveBeenCalled();
    });

    it('de-duplicates and lower-cases before querying', async () => {
      const h = 'A'.repeat(64);
      await service.matchContacts(me, [h, h.toLowerCase()]);
      expect(pub.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('never returns the member themselves', async () => {
      pub.$queryRaw.mockResolvedValue([
        { id: 'me', full_name: 'Me' },
        { id: 'alice', full_name: 'Alice' },
      ]);
      const out = await service.matchContacts(me, ['a'.repeat(64)]);
      expect(out.people.map((p) => p.id)).toEqual(['alice']);
    });

    it('never returns someone blocked', async () => {
      pub.block.findMany.mockResolvedValue([{ blocker_id: 'me', blocked_id: 'troll' }]);
      pub.$queryRaw.mockResolvedValue([{ id: 'troll', full_name: 'Troll' }]);
      expect((await service.matchContacts(me, ['a'.repeat(64)])).people).toEqual([]);
    });

    it('says whether each match is already followed, so the UI need not ask', async () => {
      pub.follow.findMany.mockResolvedValue([{ followee_id: 'alice' }]);
      pub.$queryRaw.mockResolvedValue([{ id: 'alice', full_name: 'Alice' }]);
      expect((await service.matchContacts(me, ['a'.repeat(64)])).people[0].following).toBe(true);
    });
  });

  describe('profile by id', () => {
    it('is deliberately thin — an id is not a key to somebody\'s account', async () => {
      const out: any = await service.profile(me, 'alice');
      expect(Object.keys(out).sort()).toEqual(
        ['followerCount', 'followingCount', 'id', 'isYou', 'name', 'youFollow'].sort(),
      );
    });

    it('refuses for someone blocked', async () => {
      pub.block.findMany.mockResolvedValue([{ blocker_id: 'alice', blocked_id: 'me' }]);
      await expect(service.profile(me, 'alice')).rejects.toThrow(/not found/i);
    });

    it('404s an id that is not a person', async () => {
      pub.appUser.findUnique.mockResolvedValue(null);
      await expect(service.profile(me, 'nope')).rejects.toThrow(/not found/i);
    });
  });
});
