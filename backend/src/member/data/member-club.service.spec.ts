import { MemberClubService } from './member-club.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { visibleActivityFilter } from './activity-visibility';

/**
 * Clubs, and the one property that matters most about them: joining a club
 * must NOT widen what a member can see. The club feed narrows WHO appears; the
 * visibility rule still decides WHAT.
 */
describe('MemberClubService', () => {
  const me: CurrentMemberContext = {
    appUserId: 'me', memberId: 'm', tenantId: 't', isGymMember: true,
  };

  let pub: any;
  let service: MemberClubService;

  const asMember = (role: string | null) =>
    pub.clubMember.findFirst.mockResolvedValue(role ? { role } : null);

  beforeEach(() => {
    pub = {
      club: {
        findUnique: jest.fn().mockResolvedValue({ id: 'c1', visibility: 'public' }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ ...data, id: 'c1' })),
        update: jest.fn().mockResolvedValue({}),
      },
      clubMember: {
        findFirst: jest.fn().mockResolvedValue({ role: 'member' }),
        findMany: jest.fn().mockResolvedValue([{ app_user_id: 'me' }, { app_user_id: 'alice' }]),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      clubEvent: {
        findUnique: jest.fn().mockResolvedValue({ id: 'e1', club_id: 'c1' }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ ...data, id: 'e1', starts_at: new Date(data.starts_at) })),
        update: jest.fn().mockResolvedValue({}),
      },
      eventAttendee: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      appUserActivity: { findMany: jest.fn().mockResolvedValue([]) },
      follow: { findMany: jest.fn().mockResolvedValue([{ followee_id: 'alice' }]) },
      block: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new MemberClubService(pub as any);
  });

  describe('the club feed does not widen visibility', () => {
    it('applies the shared activity filter verbatim', async () => {
      await service.feed(me, 'c1');
      const and = pub.appUserActivity.findMany.mock.calls[0][0].where.AND;
      expect(and).toContainEqual(
        visibleActivityFilter('me', { following: ['alice'], blocked: [] }),
      );
    });

    it('narrows to club members as well, never instead', async () => {
      await service.feed(me, 'c1');
      const and = pub.appUserActivity.findMany.mock.calls[0][0].where.AND;
      expect(and[0]).toEqual({ app_user_id: { in: ['me', 'alice'] } });
      expect(and.length).toBeGreaterThan(1);
    });

    it('refuses the feed to someone who is not in the club', async () => {
      asMember(null);
      await expect(service.feed(me, 'c1')).rejects.toThrow(/not found/i);
      expect(pub.appUserActivity.findMany).not.toHaveBeenCalled();
    });
  });

  describe('discovery', () => {
    it('lists public clubs only — private means unlisted', async () => {
      await service.discover(me);
      expect(pub.club.findMany.mock.calls[0][0].where.visibility).toBe('public');
    });

    it('ignores a sport filter that is not a real sport', async () => {
      await service.discover(me, 'quidditch');
      expect(pub.club.findMany.mock.calls[0][0].where.sport_type).toBeUndefined();
    });
  });

  describe('membership', () => {
    it('makes the creator a member immediately', async () => {
      // A club whose owner is not in it reports 0 members and an empty feed.
      await service.create(me, { name: 'Dawn Runners' } as any);
      expect(pub.club.create.mock.calls[0][0].data.member_count).toBe(1);
      expect(pub.clubMember.create.mock.calls[0][0].data.role).toBe('owner');
    });

    it('rejects a club whose sport is not real', async () => {
      await expect(
        service.create(me, { name: 'Quidditch Club', sportType: 'quidditch' } as any),
      ).rejects.toThrow(/unknown sport/i);
    });

    it('joining twice is joining once, and the counter moves once', async () => {
      asMember(null);
      await service.join(me, 'c1');
      expect(pub.club.update).toHaveBeenCalledTimes(1);

      asMember('member');
      await service.join(me, 'c1');
      expect(pub.clubMember.create).toHaveBeenCalledTimes(1);
      expect(pub.club.update).toHaveBeenCalledTimes(1);
    });

    it('stops the owner walking out and orphaning the club', async () => {
      asMember('owner');
      await expect(service.leave(me, 'c1')).rejects.toThrow(/hand the club/i);
    });

    it('leaving when not a member is a no-op, not an error', async () => {
      asMember(null);
      await expect(service.leave(me, 'c1')).resolves.toEqual({ joined: false });
      expect(pub.club.update).not.toHaveBeenCalled();
    });

    it('keeps blocked people out of the member list', async () => {
      pub.block.findMany.mockResolvedValue([{ blocker_id: 'me', blocked_id: 'troll' }]);
      pub.clubMember.findMany.mockResolvedValue([]);
      await service.members(me, 'c1');
      const call = pub.clubMember.findMany.mock.calls.at(-1)[0];
      expect(call.where.app_user_id).toEqual({ notIn: ['troll'] });
    });
  });

  describe('events', () => {
    const soon = () => new Date(Date.now() + 86_400_000).toISOString();

    it('only lists events that have not happened yet', async () => {
      await service.events(me, 'c1');
      expect(pub.clubEvent.findMany.mock.calls[0][0].where.starts_at.gte).toBeInstanceOf(Date);
    });

    it('lets an admin add one', async () => {
      asMember('admin');
      const out: any = await service.createEvent(me, 'c1', {
        title: 'Saturday long run', startsAt: soon(),
      } as any);
      expect(out.title).toBe('Saturday long run');
    });

    it('refuses an ordinary member — a club schedule is trusted', async () => {
      asMember('member');
      await expect(
        service.createEvent(me, 'c1', { title: 'Party', startsAt: soon() } as any),
      ).rejects.toThrow(/admins/i);
    });

    it('refuses an event in the past', async () => {
      asMember('owner');
      await expect(
        service.createEvent(me, 'c1', {
          title: 'Yesterday', startsAt: new Date(Date.now() - 86_400_000).toISOString(),
        } as any),
      ).rejects.toThrow(/past/i);
    });

    it('counts only "going" — a maybe is not a headcount', async () => {
      await service.rsvp(me, 'e1', 'interested');
      expect(pub.clubEvent.update).not.toHaveBeenCalled();

      await service.rsvp(me, 'e1', 'going');
      expect(pub.clubEvent.update.mock.calls[0][0].data.attendee_count).toEqual({ increment: 1 });
    });

    it('decrements when someone downgrades going to interested', async () => {
      pub.eventAttendee.findFirst.mockResolvedValue({ id: 'a1', status: 'going' });
      await service.rsvp(me, 'e1', 'interested');
      expect(pub.clubEvent.update.mock.calls[0][0].data.attendee_count).toEqual({ increment: -1 });
    });

    it('does not move the counter when the answer has not changed', async () => {
      pub.eventAttendee.findFirst.mockResolvedValue({ id: 'a1', status: 'going' });
      await service.rsvp(me, 'e1', 'going');
      expect(pub.clubEvent.update).not.toHaveBeenCalled();
    });

    it('clearing an RSVP removes the row and the head', async () => {
      pub.eventAttendee.findFirst.mockResolvedValue({ id: 'a1', status: 'going' });
      await service.rsvp(me, 'e1', null);
      expect(pub.eventAttendee.delete).toHaveBeenCalled();
      expect(pub.clubEvent.update.mock.calls[0][0].data.attendee_count).toEqual({ increment: -1 });
    });

    it('refuses an RSVP from outside the club', async () => {
      asMember(null);
      await expect(service.rsvp(me, 'e1', 'going')).rejects.toThrow(/not found/i);
    });
  });
});
