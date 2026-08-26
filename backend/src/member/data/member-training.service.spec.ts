import { MemberTrainingService } from './member-training.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * Training numbers are the easiest place in this product to be confidently
 * wrong: every output is a formula, so a plausible-looking figure can be
 * produced from the wrong rows without anything crashing. These tests hold
 * the three things that make the numbers trustworthy:
 *
 *   1. the cross-USER gate — activities are read by the token's appUserId,
 *      and strength sets by the token's memberId through the tenant client;
 *   2. days belong to the MEMBER's calendar, not the server's; and
 *   3. an estimate is labelled an estimate.
 */
describe('MemberTrainingService', () => {
  const me: CurrentMemberContext = {
    appUserId: 'au-me', memberId: 'm1', tenantId: 't1', isGymMember: true,
  };

  let pub: any;
  let tenant: any;
  let service: MemberTrainingService;

  const activity = (over: Record<string, unknown> = {}) => ({
    sport_type: 'run',
    started_at: new Date('2026-08-20T05:00:00Z'),
    elapsed_seconds: 3600,
    moving_seconds: 3500,
    avg_heart_rate: 150,
    distance_m: 10000,
    ...over,
  });

  beforeEach(() => {
    pub = { appUserActivity: { findMany: jest.fn().mockResolvedValue([]) } };
    tenant = { client: { workoutSetLog: { findMany: jest.fn().mockResolvedValue([]) } } };
    service = new MemberTrainingService(pub as any, tenant as any);
  });

  describe('the cross-user gate', () => {
    it('reads activities only for the token holder', async () => {
      await service.load(me);
      const where = pub.appUserActivity.findMany.mock.calls[0][0].where;
      expect(where.app_user_id).toBe('au-me');
    });

    it('reads strength sets only for the token holder, through the tenant client', async () => {
      await service.strengthPredictions(me);
      const where = tenant.client.workoutSetLog.findMany.mock.calls[0][0].where;
      expect(where.workout_log.member_id).toBe('m1');
    });

    it('returns no lifts at all for a member with no gym', async () => {
      const res = await service.strengthPredictions({ ...me, memberId: null } as any);
      expect(res.lifts).toEqual([]);
      // and crucially never touched the gym schema
      expect(tenant.client.workoutSetLog.findMany).not.toHaveBeenCalled();
    });

    it('scopes race predictions to the token holder', async () => {
      await service.racePredictions(me);
      const where = pub.appUserActivity.findMany.mock.calls[0][0].where;
      expect(where.app_user_id).toBe('au-me');
    });
  });

  describe('the member owns the calendar', () => {
    it('files a late-evening session under the local day, not the UTC one', async () => {
      // 20:30 on the 20th in Kolkata is 15:00Z on the 20th — same day.
      // 01:00 on the 21st local is 19:30Z on the 20th — the NEXT day locally.
      pub.appUserActivity.findMany.mockResolvedValue([
        activity({ started_at: new Date('2026-08-20T19:30:00Z') }),
      ]);
      const res = await service.load(me, 330, 30);
      const loaded = res.series.filter((d) => d.load > 0);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].date).toBe('2026-08-21');
    });

    it('sums two sessions on the same local day into one load', async () => {
      pub.appUserActivity.findMany.mockResolvedValue([
        activity({ started_at: new Date('2026-08-20T05:00:00Z') }),
        activity({ started_at: new Date('2026-08-20T12:00:00Z') }),
      ]);
      const res = await service.load(me, 0, 30);
      const loaded = res.series.filter((d) => d.load > 0);
      expect(loaded).toHaveLength(1);
    });
  });

  describe('honesty about where the numbers came from', () => {
    it('counts how many sessions had a strap and how many were guessed', async () => {
      pub.appUserActivity.findMany.mockResolvedValue([
        activity({ avg_heart_rate: 150 }),
        activity({ avg_heart_rate: null }),
        activity({ avg_heart_rate: null }),
      ]);
      const res = await service.load(me);
      expect(res.basis).toEqual({ activities: 3, withHeartRate: 1, estimated: 2 });
    });

    it('still produces a form reading with no heart rate at all', async () => {
      pub.appUserActivity.findMany.mockResolvedValue([activity({ avg_heart_rate: null })]);
      const res = await service.load(me);
      expect(res.today.fitness).toBeGreaterThan(0);
      expect(res.basis.withHeartRate).toBe(0);
    });
  });

  describe('race predictions', () => {
    it('predicts from the fastest pace, not the longest run', async () => {
      pub.appUserActivity.findMany.mockResolvedValue([
        // 21km at 6:00/km — long but slow
        activity({ distance_m: 21000, moving_seconds: 7560 }),
        // 5km at 4:00/km — short but fast
        activity({ distance_m: 5000, moving_seconds: 1200 }),
      ]);
      const res = await service.racePredictions(me);
      expect(res.from?.distanceM).toBe(5000);
    });

    it('says nothing rather than guessing when there is no run to go on', async () => {
      const res = await service.racePredictions(me);
      expect(res.from).toBeNull();
      expect(res.predictions).toEqual([]);
    });

    it('ignores a run with a distance but no time', async () => {
      pub.appUserActivity.findMany.mockResolvedValue([
        activity({ distance_m: 5000, moving_seconds: null, elapsed_seconds: null }),
      ]);
      const res = await service.racePredictions(me);
      expect(res.from).toBeNull();
    });
  });

  describe('strength predictions', () => {
    const set = (over: Record<string, unknown> = {}) => ({
      weight: 100, reps: 5, exercise_id: 'e1', exercise: { name: 'Back squat' }, ...over,
    });

    it('groups sets by exercise and ranks the heaviest projection first', async () => {
      tenant.client.workoutSetLog.findMany.mockResolvedValue([
        set({ exercise_id: 'e1', exercise: { name: 'Back squat' }, weight: 100, reps: 5 }),
        set({ exercise_id: 'e2', exercise: { name: 'Bench press' }, weight: 60, reps: 5 }),
      ]);
      const res = await service.strengthPredictions(me);
      expect(res.lifts.map((l: any) => l.name)).toEqual(['Back squat', 'Bench press']);
      expect(res.lifts[0].oneRepMax).toBeGreaterThan(100);
    });

    it('shows which set the projection came from', async () => {
      tenant.client.workoutSetLog.findMany.mockResolvedValue([set({ weight: 120, reps: 3 })]);
      const res = await service.strengthPredictions(me);
      expect(res.lifts[0].fromWeight).toBe(120);
      expect(res.lifts[0].fromReps).toBe(3);
    });

    it('survives an exercise whose name did not load', async () => {
      tenant.client.workoutSetLog.findMany.mockResolvedValue([set({ exercise: null })]);
      const res = await service.strengthPredictions(me);
      expect(res.lifts[0].name).toBe('Exercise');
    });
  });

  describe('heart-rate zones', () => {
    it('bands sit between rest and max, in order, without gaps', async () => {
      const { zones } = service.zones(190, 50);
      expect(zones).toHaveLength(5);
      expect(zones[0].fromBpm).toBe(120);
      expect(zones[4].toBpm).toBe(190);
      for (let i = 1; i < zones.length; i++) {
        expect(zones[i].fromBpm).toBe(zones[i - 1].toBpm);
      }
    });
  });

  describe('window bounds', () => {
    it('will not be talked into a thousand-day query', async () => {
      await service.load(me, 0, 100000);
      const since = pub.appUserActivity.findMany.mock.calls[0][0].where.started_at.gte;
      const days = (Date.now() - since.getTime()) / 86_400_000;
      expect(days).toBeLessThanOrEqual(121);
    });

    it('will not be talked into a zero-day query either', async () => {
      await service.load(me, 0, 0);
      const since = pub.appUserActivity.findMany.mock.calls[0][0].where.started_at.gte;
      const days = (Date.now() - since.getTime()) / 86_400_000;
      expect(days).toBeGreaterThanOrEqual(6.9);
    });
  });
});
