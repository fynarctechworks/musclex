import { MemberFeedService } from './member-feed.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { decodePolyline, encodePolyline, trimPrivacyZone } from './polyline';

/**
 * Who may see an activity.
 *
 * This is the highest-consequence rule in the feature: a GPS trace shows where
 * someone lives and when they are out. The rule lives in ONE place so the feed
 * and a direct link cannot disagree — these tests exist to keep it that way.
 */
describe('MemberFeedService — visibility', () => {
  const me: CurrentMemberContext = {
    appUserId: 'me', memberId: 'm', tenantId: 't', isGymMember: true,
  };

  let pub: any;
  let service: MemberFeedService;

  beforeEach(() => {
    pub = {
      follow: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      block: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      appUser: { findUnique: jest.fn().mockResolvedValue({ id: 'other' }) },
      appUserActivity: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      activityKudos: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      activityComment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    service = new MemberFeedService(pub as any);
  });

  /** The AND/OR filter the service hands Prisma for the feed. */
  const filterFromFeed = async () => {
    await service.feed(me);
    return pub.appUserActivity.findMany.mock.calls[0][0].where.AND[0];
  };

  it('always includes the member\'s own activities', async () => {
    const f = await filterFromFeed();
    expect(f.AND[1].OR).toContainEqual({ app_user_id: 'me' });
  });

  it('includes public activities', async () => {
    const f = await filterFromFeed();
    expect(f.AND[1].OR).toContainEqual({ visibility: 'everyone' });
  });

  it('includes followers-only activities ONLY from people the member follows', async () => {
    pub.follow.findMany.mockResolvedValue([{ followee_id: 'alice' }, { followee_id: 'bob' }]);
    const f = await filterFromFeed();
    expect(f.AND[1].OR).toContainEqual({
      visibility: 'followers',
      app_user_id: { in: ['alice', 'bob'] },
    });
  });

  it('never includes only_me, for anyone but the owner', async () => {
    pub.follow.findMany.mockResolvedValue([{ followee_id: 'alice' }]);
    const f = await filterFromFeed();
    const clauses = JSON.stringify(f.AND[1].OR);
    // The only route to another person's activity is 'everyone' or 'followers'.
    expect(clauses).not.toContain('only_me');
  });

  it('excludes people the member blocked', async () => {
    pub.block.findMany.mockResolvedValue([{ blocker_id: 'me', blocked_id: 'troll' }]);
    const f = await filterFromFeed();
    expect(f.AND[0]).toEqual({ app_user_id: { notIn: ['troll'] } });
  });

  it('excludes people who blocked the member — a block cuts both ways', async () => {
    pub.block.findMany.mockResolvedValue([{ blocker_id: 'grumpy', blocked_id: 'me' }]);
    const f = await filterFromFeed();
    expect(f.AND[0]).toEqual({ app_user_id: { notIn: ['grumpy'] } });
  });

  it('applies the very same filter to a single activity as to the feed', async () => {
    // A leak gets written when the feed is fixed and the direct link is not.
    pub.follow.findMany.mockResolvedValue([{ followee_id: 'alice' }]);
    await service.feed(me);
    const feedFilter = pub.appUserActivity.findMany.mock.calls[0][0].where.AND[0];

    await expect(service.view(me, 'a1')).rejects.toThrow();
    const viewFilter = pub.appUserActivity.findFirst.mock.calls[0][0].where.AND[1];
    expect(viewFilter).toEqual(feedFilter);
  });

  it('answers "not found" for a hidden activity, not "forbidden"', async () => {
    pub.appUserActivity.findFirst.mockResolvedValue(null);
    await expect(service.view(me, 'secret')).rejects.toThrow(/not found/i);
  });
});

describe('MemberFeedService — what a viewer receives', () => {
  const me: CurrentMemberContext = {
    appUserId: 'me', memberId: 'm', tenantId: 't', isGymMember: true,
  };
  let pub: any;
  let service: MemberFeedService;

  // A straight line of points 20 m apart.
  const track = Array.from({ length: 40 }, (_, i) => ({
    lat: 17.7 + (i * 20) / 111_320,
    lng: 83.3,
  }));

  const activity = (over: Record<string, unknown> = {}) => ({
    id: 'a1',
    app_user_id: 'alice',
    app_user: { id: 'alice', full_name: 'Alice' },
    sport_type: 'run',
    title: 'Morning run',
    started_at: new Date('2026-08-21T05:00:00Z'),
    elapsed_seconds: 1800,
    moving_seconds: 1750,
    distance_m: 5000,
    elevation_gain_m: 30,
    avg_heart_rate: 150,
    polyline: encodePolyline(track),
    start_latitude: 17.7,
    start_longitude: 83.3,
    visibility: 'everyone',
    privacy_zone_m: null,
    kudos_count: 3,
    comment_count: 1,
    kudos: [],
    ...over,
  });

  beforeEach(() => {
    pub = {
      follow: { findMany: jest.fn().mockResolvedValue([]) },
      block: { findMany: jest.fn().mockResolvedValue([]) },
      appUserActivity: { findFirst: jest.fn(), findMany: jest.fn() },
    };
    service = new MemberFeedService(pub as any);
  });

  it('hands the owner their own track whole', async () => {
    pub.appUserActivity.findFirst.mockResolvedValue(
      activity({ app_user_id: 'me', privacy_zone_m: 200 }),
    );
    const out: any = await service.view(me, 'a1');
    expect(decodePolyline(out.polyline).length).toBe(track.length);
    expect(out.startLatitude).toBeCloseTo(17.7, 4);
    expect(out.mine).toBe(true);
  });

  it('trims the privacy zone off both ends for everyone else', async () => {
    // The start of a route is usually someone's front door.
    pub.appUserActivity.findFirst.mockResolvedValue(activity({ privacy_zone_m: 200 }));
    const out: any = await service.view(me, 'a1');
    const shown = decodePolyline(out.polyline);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(track.length);
  });

  it('withholds the exact start coordinates from everyone else', async () => {
    pub.appUserActivity.findFirst.mockResolvedValue(activity({ privacy_zone_m: 200 }));
    const out: any = await service.view(me, 'a1');
    expect(out.startLatitude).toBeNull();
    expect(out.startLongitude).toBeNull();
  });

  it('leaves the track alone when no zone is set', async () => {
    pub.appUserActivity.findFirst.mockResolvedValue(activity({ privacy_zone_m: null }));
    const out: any = await service.view(me, 'a1');
    expect(decodePolyline(out.polyline).length).toBe(track.length);
  });

  it('reports whether this member has already given kudos', async () => {
    pub.appUserActivity.findFirst.mockResolvedValue(activity({ kudos: [{ id: 'k1' }] }));
    const out: any = await service.view(me, 'a1');
    expect(out.kudosedByMe).toBe(true);
  });
});

describe('MemberFeedService — actions', () => {
  const me: CurrentMemberContext = {
    appUserId: 'me', memberId: 'm', tenantId: 't', isGymMember: true,
  };
  let pub: any;
  let service: MemberFeedService;

  beforeEach(() => {
    pub = {
      follow: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      block: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      appUser: { findUnique: jest.fn().mockResolvedValue({ id: 'alice' }) },
      appUserActivity: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'a1', app_user_id: 'alice',
          app_user: { id: 'alice', full_name: 'Alice' },
          sport_type: 'run', title: null,
          started_at: new Date(), elapsed_seconds: 60, moving_seconds: 60,
          distance_m: null, elevation_gain_m: null, avg_heart_rate: null,
          polyline: null, start_latitude: null, start_longitude: null,
          visibility: 'everyone', privacy_zone_m: null,
          kudos_count: 0, comment_count: 0, kudos: [],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      activityKudos: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      activityComment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({
          id: 'c1', body: 'Nice one', created_at: new Date(),
          app_user: { id: 'me', full_name: 'Me' },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    service = new MemberFeedService(pub as any);
  });

  it('refuses to follow yourself', async () => {
    await expect(service.follow(me, 'me')).rejects.toThrow(/yourself/i);
  });

  it('refuses to follow someone who blocked you, without saying so', async () => {
    // Confirming the block would tell them they had been blocked.
    pub.block.findMany.mockResolvedValue([{ blocker_id: 'alice', blocked_id: 'me' }]);
    await expect(service.follow(me, 'alice')).rejects.toThrow(/not found/i);
  });

  it('blocking severs the follow in both directions', async () => {
    await service.block(me, 'alice');
    const where = pub.follow.deleteMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { follower_id: 'me', followee_id: 'alice' },
      { follower_id: 'alice', followee_id: 'me' },
    ]);
  });

  it('kudos twice is still one kudos, and the counter moves once', async () => {
    await service.giveKudos(me, 'a1');
    expect(pub.appUserActivity.update).toHaveBeenCalledTimes(1);

    pub.activityKudos.findFirst.mockResolvedValue({ id: 'k1' });
    await service.giveKudos(me, 'a1');
    expect(pub.activityKudos.create).toHaveBeenCalledTimes(1);
    expect(pub.appUserActivity.update).toHaveBeenCalledTimes(1);
  });

  it('does not decrement the counter when there was no kudos to remove', async () => {
    pub.activityKudos.deleteMany.mockResolvedValue({ count: 0 });
    await service.removeKudos(me, 'a1');
    expect(pub.appUserActivity.update).not.toHaveBeenCalled();
  });

  it('rejects an empty comment', async () => {
    await expect(service.addComment(me, 'a1', '   ')).rejects.toThrow(/write something/i);
  });

  it('rejects a comment past the length cap', async () => {
    await expect(service.addComment(me, 'a1', 'x'.repeat(1001))).rejects.toThrow(/1000/);
  });

  it('hides blocked people\'s comments from the thread', async () => {
    pub.block.findMany.mockResolvedValue([{ blocker_id: 'me', blocked_id: 'troll' }]);
    await service.comments(me, 'a1');
    expect(pub.activityComment.findMany.mock.calls[0][0].where.app_user_id).toEqual({
      notIn: ['troll'],
    });
  });

  it('lets the activity owner delete a comment on their own activity', async () => {
    // Someone must be able to clear abuse off their own post without us.
    pub.activityComment.findUnique.mockResolvedValue({
      id: 'c1', app_user_id: 'troll', deleted_at: null,
      activity: { id: 'a1', app_user_id: 'me' },
    });
    await expect(service.deleteComment(me, 'c1')).resolves.toEqual({ deleted: true });
  });

  it('refuses to let a bystander delete someone else\'s comment', async () => {
    pub.activityComment.findUnique.mockResolvedValue({
      id: 'c1', app_user_id: 'alice', deleted_at: null,
      activity: { id: 'a1', app_user_id: 'bob' },
    });
    await expect(service.deleteComment(me, 'c1')).rejects.toThrow(/not found/i);
  });
});

describe('MemberFeedService — mentions', () => {
  const me: CurrentMemberContext = {
    appUserId: 'me', memberId: 'm', tenantId: 't', isGymMember: true,
  };
  const ALICE = '59ab42bb-437a-4569-bc3f-d9795ce68a83';
  const TROLL = '5b6b21cc-cdd7-41ee-b9f4-b2749ce38ec8';

  let pub: any;
  let service: MemberFeedService;

  const visibleActivity = {
    id: 'a1', app_user_id: 'me', app_user: { id: 'me', full_name: 'Me' },
    sport_type: 'run', title: null, started_at: new Date(),
    elapsed_seconds: 60, moving_seconds: 60, distance_m: null,
    elevation_gain_m: null, avg_heart_rate: null, polyline: null,
    start_latitude: null, start_longitude: null, visibility: 'everyone',
    privacy_zone_m: null, kudos_count: 0, comment_count: 0, kudos: [],
  };

  beforeEach(() => {
    pub = {
      follow: { findMany: jest.fn().mockResolvedValue([]) },
      block: { findMany: jest.fn().mockResolvedValue([]) },
      appUser: { findMany: jest.fn().mockResolvedValue([{ id: ALICE }]) },
      appUserActivity: {
        findFirst: jest.fn().mockResolvedValue(visibleActivity),
        update: jest.fn().mockResolvedValue({}),
      },
      activityComment: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: 'c1', body: data.body, created_at: new Date(),
            app_user_id: data.app_user_id,
            app_user: { id: 'me', full_name: 'Me' },
          })),
      },
      commentMention: { createMany: jest.fn().mockResolvedValue({}) },
    };
    service = new MemberFeedService(pub as any);
  });

  it('records who was named, so a notification has somewhere to look', async () => {
    await service.addComment(me, 'a1', `nice one @[Alice](${ALICE})`);
    expect(pub.commentMention.createMany.mock.calls[0][0].data).toEqual([
      { comment_id: 'c1', app_user_id: ALICE },
    ]);
  });

  it('returns segments so no client has to re-implement the parse', async () => {
    const out: any = await service.addComment(me, 'a1', `hey @[Alice](${ALICE})`);
    expect(out.segments).toEqual([
      { type: 'text', value: 'hey ' },
      { type: 'mention', id: ALICE, name: 'Alice' },
    ]);
    expect(out.body).toBe('hey @Alice');
  });

  it('keeps the comment when a mention cannot be resolved', async () => {
    // Losing what somebody wrote over a stale @name is the wrong trade.
    pub.appUser.findMany.mockResolvedValue([]);
    const out: any = await service.addComment(me, 'a1', `hey @[Ghost](${ALICE})`);
    expect(out.segments).toEqual([{ type: 'text', value: 'hey @Ghost' }]);
    expect(pub.commentMention.createMany).not.toHaveBeenCalled();
  });

  it('never links a mention of somebody the AUTHOR blocked', async () => {
    pub.block.findMany.mockResolvedValue([{ blocker_id: 'me', blocked_id: TROLL }]);
    pub.appUser.findMany.mockResolvedValue([]);
    const out: any = await service.addComment(me, 'a1', `look @[Troll](${TROLL})`);
    expect(out.segments.every((s: any) => s.type === 'text')).toBe(true);
  });

  it('resolves mentions against the READER, not the author', async () => {
    // The author may name somebody the reader has blocked; that must not
    // become a tappable route to them.
    pub.activityComment.findMany.mockResolvedValue([{
      id: 'c1', body: `see @[Troll](${TROLL})`, created_at: new Date(),
      app_user_id: 'alice', app_user: { id: 'alice', full_name: 'Alice' },
    }]);
    pub.block.findMany.mockResolvedValue([{ blocker_id: 'me', blocked_id: TROLL }]);
    pub.appUser.findMany.mockResolvedValue([]);
    const out: any = await service.comments(me, 'a1');
    expect(out.comments[0].segments).toEqual([{ type: 'text', value: 'see @Troll' }]);
  });

  it('writes no mention rows for a plain comment', async () => {
    await service.addComment(me, 'a1', 'just a normal comment');
    expect(pub.commentMention.createMany).not.toHaveBeenCalled();
  });
});

describe('trimPrivacyZone', () => {
  const line = Array.from({ length: 50 }, (_, i) => ({
    lat: 17.7 + (i * 20) / 111_320,
    lng: 83.3,
  }));

  it('drops points near both the start and the finish', () => {
    const out = trimPrivacyZone(line, 200);
    expect(out.length).toBeLessThan(line.length);
    expect(out[0].lat).toBeGreaterThan(line[0].lat);
    expect(out[out.length - 1].lat).toBeLessThan(line[line.length - 1].lat);
  });

  it('returns nothing when the whole route is inside the zone', () => {
    // A short loop around the block is entirely private, which is correct.
    expect(trimPrivacyZone(line, 100_000)).toEqual([]);
  });

  it('is a no-op with no zone set', () => {
    expect(trimPrivacyZone(line, 0)).toEqual(line);
  });

  it('survives an empty track', () => {
    expect(trimPrivacyZone([], 200)).toEqual([]);
  });
});

describe('polyline round trip', () => {
  it('decodes what it encoded, to five decimal places', () => {
    const pts = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    const out = decodePolyline(encodePolyline(pts));
    out.forEach((p, i) => {
      expect(p.lat).toBeCloseTo(pts[i].lat, 5);
      expect(p.lng).toBeCloseTo(pts[i].lng, 5);
    });
  });

  it('decodes the reference string from the Google spec', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@').length).toBe(3);
  });
});
