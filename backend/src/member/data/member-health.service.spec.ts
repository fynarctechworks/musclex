import { MemberHealthService } from './member-health.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import type { HealthSampleInputData } from '../contract';

/**
 * Health service: the consent gate (no wearable ingest without a CONNECTED
 * provider), idempotent dedupe accounting, daily-rollup upsert, and member
 * scoping. Mirrors member-workout.service.spec — mock Prisma, capture args.
 */
describe('MemberHealthService', () => {
  const memberA: CurrentMemberContext = { appUserId: 'auA', memberId: 'mA', tenantId: 'tA', isGymMember: true };
  let prisma: any;
  let service: MemberHealthService;

  const sample = (over: Partial<HealthSampleInputData> = {}): HealthSampleInputData => ({
    type: 'steps',
    value: 1000,
    unit: 'count',
    startAt: '2026-06-03T08:00:00.000Z',
    endAt: '2026-06-03T08:10:00.000Z',
    source: 'manual',
    sourceUuid: 'u1',
    ...over,
  });

  beforeEach(() => {
    prisma = {
      memberWearableConnection: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn(),
        findFirst: jest.fn(),
      },
      memberHealthSample: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        // Daily rollup now resolves conflicts via groupBy-by-source (default:
        // a single source present).
        groupBy: jest.fn().mockResolvedValue([
          {
            source: 'manual',
            _sum: { value: '1000' },
            _min: { value: '1000' },
            _max: { value: '1000' },
            _avg: { value: '1000' },
            _count: 1,
          },
        ]),
      },
      memberHealthDaily: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new MemberHealthService(prisma);
  });

  it('ingests a manual sample (no connection required) with member_id + gym_id', async () => {
    const result = await service.ingest(memberA, [sample()]);

    const createArg = prisma.memberHealthSample.createMany.mock.calls[0][0];
    expect(createArg.skipDuplicates).toBe(true);
    expect(createArg.data[0].member_id).toBe('mA');
    expect(createArg.data[0].gym_id).toBe('tA');
    // Manual source never hits the connection lookup.
    expect(prisma.memberWearableConnection.findMany).not.toHaveBeenCalled();
    expect(prisma.memberHealthDaily.upsert).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ accepted: 1, duplicates: 0, daysAffected: 1 });
  });

  it('rejects wearable ingest when the provider is not connected', async () => {
    prisma.memberWearableConnection.findMany.mockResolvedValue([]); // nothing connected
    await expect(
      service.ingest(memberA, [sample({ source: 'apple_health' })]),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(prisma.memberHealthSample.createMany).not.toHaveBeenCalled();
  });

  it('allows wearable ingest once the provider is connected + stamps last_synced_at', async () => {
    prisma.memberWearableConnection.findMany.mockResolvedValue([
      { provider: 'apple_health' },
    ]);
    await service.ingest(memberA, [sample({ source: 'apple_health' })]);
    expect(prisma.memberHealthSample.createMany).toHaveBeenCalled();
    expect(prisma.memberWearableConnection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { member_id: 'mA', provider: { in: ['apple_health'] } },
        data: { last_synced_at: expect.any(Date) },
      }),
    );
  });

  it('counts deduped samples as duplicates (createMany skips them)', async () => {
    prisma.memberHealthSample.createMany.mockResolvedValue({ count: 1 }); // only 1 of 2 new
    const result = await service.ingest(memberA, [
      sample({ sourceUuid: 'u1' }),
      sample({ sourceUuid: 'u2' }),
    ]);
    expect(result.accepted).toBe(1);
    expect(result.duplicates).toBe(1);
  });

  it('conflict resolution: same metric/day from two providers rolls up only the higher-priority source (no double count)', async () => {
    prisma.memberWearableConnection.findMany.mockResolvedValue([
      { provider: 'apple_health' },
      { provider: 'garmin' },
    ]);
    // Both providers reported steps for the same day; garmin outranks apple_health.
    prisma.memberHealthSample.groupBy.mockResolvedValue([
      { source: 'apple_health', _sum: { value: '8000' }, _min: { value: '0' }, _max: { value: '500' }, _avg: { value: '120' }, _count: 30 },
      { source: 'garmin', _sum: { value: '9500' }, _min: { value: '0' }, _max: { value: '600' }, _avg: { value: '140' }, _count: 40 },
    ]);

    await service.ingest(memberA, [
      sample({ source: 'apple_health', sourceUuid: 'a1' }),
      sample({ source: 'garmin', sourceUuid: 'g1' }),
    ]);

    const upsertArg = prisma.memberHealthDaily.upsert.mock.calls[0][0];
    // Picks garmin's total (9500), NOT the 17500 sum-across-sources double count.
    expect(upsertArg.create.total).toBe(9500);
    expect(upsertArg.create.primary_source).toBe('garmin');
  });

  it('conflict resolution: body composition prefers the scale over a wearable estimate', async () => {
    prisma.memberWearableConnection.findMany.mockResolvedValue([
      { provider: 'scale' },
      { provider: 'garmin' },
    ]);
    prisma.memberHealthSample.groupBy.mockResolvedValue([
      { source: 'garmin', _sum: { value: '74.2' }, _min: { value: '74.2' }, _max: { value: '74.2' }, _avg: { value: '74.2' }, _count: 1 },
      { source: 'scale', _sum: { value: '73.1' }, _min: { value: '73.1' }, _max: { value: '73.1' }, _avg: { value: '73.1' }, _count: 1 },
    ]);

    await service.ingest(memberA, [
      sample({ type: 'body_weight', unit: 'kg', source: 'garmin', sourceUuid: 'gw' }),
      sample({ type: 'body_weight', unit: 'kg', source: 'scale', sourceUuid: 'sw' }),
    ]);

    const upsertArg = prisma.memberHealthDaily.upsert.mock.calls[0][0];
    expect(upsertArg.create.primary_source).toBe('scale');
    expect(upsertArg.create.total).toBe(73.1);
  });

  it('getSummary scopes by member_id and groups rollups into per-metric series', async () => {
    prisma.memberHealthDaily.findMany.mockResolvedValue([
      {
        type: 'steps',
        unit: 'count',
        day: new Date('2026-06-03T00:00:00.000Z'),
        total: '8000',
        min: '0',
        max: '500',
        avg: '120',
        sample_count: 12,
      },
    ]);
    const out = await service.getSummary(memberA, '2026-06-01', '2026-06-03');
    expect(prisma.memberHealthDaily.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ member_id: 'mA' }),
      }),
    );
    expect(out.metrics).toHaveLength(1);
    expect(out.metrics![0]).toMatchObject({ type: 'steps', unit: 'count' });
    expect(out.metrics![0].points![0]).toMatchObject({ day: '2026-06-03', total: 8000 });
  });

  it('connect upserts the provider with explicit consent + gym_id', async () => {
    prisma.memberWearableConnection.upsert.mockResolvedValue({
      provider: 'fitbit',
      status: 'connected',
      consented_at: new Date('2026-06-03T00:00:00.000Z'),
      last_synced_at: null,
    });
    const out = await service.connect(memberA, { provider: 'fitbit' });
    const arg = prisma.memberWearableConnection.upsert.mock.calls[0][0];
    expect(arg.where.member_id_provider).toEqual({ member_id: 'mA', provider: 'fitbit' });
    expect(arg.create.gym_id).toBe('tA');
    expect(arg.create.consented_at).toBeInstanceOf(Date);
    expect(out).toMatchObject({ provider: 'fitbit', status: 'connected' });
  });
});
