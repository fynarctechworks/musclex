import { MemberActivityService } from './member-activity.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * Activities are the first thing this product stores that can reveal where
 * someone lives. Two things therefore matter more than the feature working:
 *
 *   1. the cross-USER gate — every read and write is scoped by the appUserId
 *      from the token, never an id from the request body; and
 *   2. defaults that fail closed — a new activity is not public unless the
 *      member says so.
 */
describe('MemberActivityService', () => {
  const me: CurrentMemberContext = {
    appUserId: 'au-me', memberId: 'm1', tenantId: 't1', isGymMember: true,
  };

  let pub: any;
  let service: MemberActivityService;

  const row = (over: Record<string, unknown> = {}) => ({
    id: 'a1',
    app_user_id: 'au-me',
    sport_type: 'run',
    title: 'Morning run',
    source: 'gps',
    started_at: new Date('2026-08-20T05:00:00Z'),
    ended_at: new Date('2026-08-20T05:45:00Z'),
    elapsed_seconds: 2700,
    moving_seconds: 2600,
    distance_m: 8000,
    elevation_gain_m: 40,
    elevation_loss_m: 40,
    avg_speed_mps: 3.1,
    max_speed_mps: 4.2,
    avg_heart_rate: 150,
    max_heart_rate: 172,
    calories: 520,
    polyline: 'abc',
    start_latitude: 17.6868,
    start_longitude: 83.2185,
    visibility: 'followers',
    privacy_zone_m: null,
    kudos_count: 0,
    comment_count: 0,
    streams: [],
    laps: [],
    photos: [],
    ...over,
  });

  beforeEach(() => {
    pub = {
      appUserActivity: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(row()),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(row(data))),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      appUserActivityStream: { upsert: jest.fn().mockResolvedValue({}) },
      appUserActivityLap: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
      },
    };
    service = new MemberActivityService(pub as any);
  });

  describe('the cross-user gate', () => {
    it('scopes the list to the caller', async () => {
      await service.list(me);
      expect(pub.appUserActivity.findMany.mock.calls[0][0].where).toMatchObject({
        app_user_id: 'au-me',
      });
    });

    it('scopes a read by id to the caller', async () => {
      await service.get(me, 'a1');
      expect(pub.appUserActivity.findFirst.mock.calls[0][0].where).toEqual({
        id: 'a1', app_user_id: 'au-me',
      });
    });

    it('says "not found" for someone else\'s activity rather than "forbidden"', async () => {
      // A distinguishable 403 would confirm the id exists.
      pub.appUserActivity.findFirst.mockResolvedValue(null);
      await expect(service.get(me, 'someone-elses')).rejects.toThrow(/not found/i);
    });

    it('writes the owner from the token, never from the payload', async () => {
      await service.create(me, {
        sportType: 'run',
        startedAt: '2026-08-20T05:00:00Z',
        // A hostile client trying to file an activity under another account.
        app_user_id: 'au-someone-else',
      } as any);
      expect(pub.appUserActivity.create.mock.calls[0][0].data.app_user_id).toBe('au-me');
    });

    it('updates through a WHERE that carries the owner', async () => {
      await service.update(me, 'a1', { title: 'Renamed' });
      expect(pub.appUserActivity.updateMany.mock.calls[0][0].where).toEqual({
        id: 'a1', app_user_id: 'au-me',
      });
    });

    it('refuses an update that matched no row of the caller\'s', async () => {
      pub.appUserActivity.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.update(me, 'a1', { title: 'x' })).rejects.toThrow(/not found/i);
    });

    it('deletes through a WHERE that carries the owner', async () => {
      await service.remove(me, 'a1');
      expect(pub.appUserActivity.deleteMany.mock.calls[0][0].where).toEqual({
        id: 'a1', app_user_id: 'au-me',
      });
    });

    it('refuses to attach streams to an activity the caller does not own', async () => {
      pub.appUserActivity.findFirst.mockResolvedValue(null);
      await expect(
        service.putStreams(me, 'a1', { streams: { heartrate: [1, 2] } } as any),
      ).rejects.toThrow(/not found/i);
      expect(pub.appUserActivityStream.upsert).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('defaults visibility to followers, not everyone', async () => {
      // A GPS trace shows a home address and when the house is empty. Public
      // is not a default anyone should get without choosing it.
      const out = await service.create(me, {
        sportType: 'run', startedAt: '2026-08-20T05:00:00Z',
      } as any);
      expect(pub.appUserActivity.create.mock.calls[0][0].data.visibility).toBe('followers');
      expect(out.visibility).toBe('followers');
    });

    it('rejects an unknown sport', async () => {
      await expect(
        service.create(me, { sportType: 'quidditch', startedAt: '2026-08-20T05:00:00Z' } as any),
      ).rejects.toThrow(/unknown sport/i);
    });

    it('rejects an activity that starts in the future', async () => {
      // A device with a wrong clock would otherwise pin a card to the top of
      // the feed forever.
      const future = new Date(Date.now() + 86_400_000).toISOString();
      await expect(
        service.create(me, { sportType: 'run', startedAt: future } as any),
      ).rejects.toThrow(/future/i);
    });

    it('rejects an activity that ends before it starts', async () => {
      await expect(
        service.create(me, {
          sportType: 'run',
          startedAt: '2026-08-20T06:00:00Z',
          endedAt: '2026-08-20T05:00:00Z',
        } as any),
      ).rejects.toThrow(/before it starts/i);
    });

    it('accepts an indoor sport with no track at all', async () => {
      const out = await service.create(me, {
        sportType: 'weight_training',
        startedAt: '2026-08-20T05:00:00Z',
        elapsedSeconds: 3600,
      } as any);
      expect(out.polyline).toBeNull();
      expect(out.distanceM).toBeNull();
    });
  });

  describe('streams', () => {
    it('replaces a series rather than appending it', async () => {
      // The upload has to be safe to retry on a gym connection: an appended
      // retry would store the same ride twice.
      await service.putStreams(me, 'a1', { streams: { heartrate: [1, 2, 3] } } as any);
      const call = pub.appUserActivityStream.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ activity_id_type: { activity_id: 'a1', type: 'heartrate' } });
      expect(call.update.point_count).toBe(3);
    });

    it('rejects an unknown stream type', async () => {
      await expect(
        service.putStreams(me, 'a1', { streams: { vibes: [1] } } as any),
      ).rejects.toThrow(/unknown stream/i);
    });

    it('rejects a series longer than the cap', async () => {
      // Ten hours at 1 Hz. Beyond it, a broken client is filling a jsonb column.
      const huge = new Array(36_001).fill(0);
      await expect(
        service.putStreams(me, 'a1', { streams: { heartrate: huge } } as any),
      ).rejects.toThrow(/limit is 36000/i);
    });

    it('rejects a series that is not an array', async () => {
      await expect(
        service.putStreams(me, 'a1', { streams: { heartrate: { nope: true } } } as any),
      ).rejects.toThrow(/must be an array/i);
    });

    it('replaces laps wholesale so a retry does not double them', async () => {
      await service.putStreams(me, 'a1', {
        streams: {},
        laps: [{ elapsedSeconds: 300 }, { elapsedSeconds: 280 }],
      } as any);
      expect(pub.appUserActivityLap.deleteMany).toHaveBeenCalledWith({
        where: { activity_id: 'a1' },
      });
      const created = pub.appUserActivityLap.createMany.mock.calls[0][0].data;
      expect(created.map((l: any) => l.lap_index)).toEqual([0, 1]);
    });
  });

  describe('list', () => {
    it('pages by keyset, not offset', async () => {
      // An activity recorded mid-scroll shifts every offset page by one and
      // silently repeats a row.
      await service.list(me, { before: '2026-08-20T05:00:00Z' });
      const where = pub.appUserActivity.findMany.mock.calls[0][0].where;
      expect(where.started_at).toEqual({ lt: new Date('2026-08-20T05:00:00Z') });
    });

    it('reports a cursor only when there is another page', async () => {
      pub.appUserActivity.findMany.mockResolvedValue([row()]);
      expect((await service.list(me, { limit: 5 })).nextBefore).toBeNull();
    });

    it('hands back the last row\'s timestamp when more remain', async () => {
      pub.appUserActivity.findMany.mockResolvedValue([row(), row(), row()]);
      const out = await service.list(me, { limit: 2 });
      expect(out.activities).toHaveLength(2);
      expect(out.nextBefore).toBe('2026-08-20T05:00:00.000Z');
    });

    it('ignores a sport filter that is not a real sport', async () => {
      await service.list(me, { sport: 'quidditch' });
      expect(pub.appUserActivity.findMany.mock.calls[0][0].where.sport_type).toBeUndefined();
    });
  });
});
