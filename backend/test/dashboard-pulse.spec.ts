import { DashboardPulseService } from '../src/dashboard/dashboard-pulse.service';

/**
 * Unit tests for DashboardPulseService — the dashboard's hero zone.
 * We mock PrismaService so that the focus is on:
 *   1. delta math (null when previous is unknown / zero)
 *   2. response shape (all 6 KPIs always returned)
 *   3. resilience (one failing subquery does not 500 the whole pulse)
 */

function makePrismaMock(overrides: Partial<MockPrisma> = {}): MockPrisma {
  const base: MockPrisma = {
    member: {
      count: jest.fn().mockResolvedValue(100),
    },
    payment: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    checkIn: {
      count: jest.fn().mockResolvedValue(0),
    },
    memberMembership: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  };
  return { ...base, ...overrides };
}

interface MockPrisma {
  member: { count: jest.Mock };
  payment: { aggregate: jest.Mock };
  checkIn: { count: jest.Mock };
  memberMembership: { findMany: jest.Mock };
  $queryRawUnsafe: jest.Mock;
}

describe('DashboardPulseService', () => {
  it('returns all 6 KPIs in the response shape', async () => {
    const svc = new DashboardPulseService(makePrismaMock() as any);
    const result = await svc.getPulse({ role: 'owner' } as any);
    const keys = Object.keys(result).sort();
    [
      'active_members',
      'capabilities',
      'check_ins_today',
      'generated_at',
      'mrr',
      'outstanding_dues',
      'renewals_at_risk_7d',
      'today_revenue',
      'view',
    ].forEach((k) => expect(keys).toContain(k));
    expect(result.outstanding_dues).toHaveProperty('invoice_count');
    expect(result.outstanding_dues).toHaveProperty('oldest_age_days');
    expect(result.renewals_at_risk_7d).toHaveProperty('value_at_stake');
  });

  it('reports null delta_pct when previous period is zero', async () => {
    const prisma = makePrismaMock({
      // active members: 5 now, 0 before
      member: {
        count: jest
          .fn()
          .mockResolvedValueOnce(5) // now
          .mockResolvedValueOnce(0), // 30d ago
      },
    });
    const svc = new DashboardPulseService(prisma as any);
    const result = await svc.getPulse(undefined);
    expect(result.active_members.value).toBe(5);
    expect(result.active_members.delta_pct).toBeNull();
    expect(result.active_members.delta_abs).toBe(5);
  });

  it('computes delta_pct correctly when both periods have data', async () => {
    const prisma = makePrismaMock({
      payment: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 1500 } }) // today
          .mockResolvedValueOnce({ _sum: { amount: 1000 } }), // yesterday
      },
    });
    const svc = new DashboardPulseService(prisma as any);
    // Bypass cache between calls
    svc.invalidate();
    const result = await svc.getPulse({ role: 'owner' } as any);
    expect(result.today_revenue.value).toBe(1500);
    expect(result.today_revenue.delta_abs).toBe(500);
    expect(result.today_revenue.delta_pct).toBe(50);
    expect(result.today_revenue.delta_label).toBe('vs yesterday');
  });

  it('survives a failing subquery (returns 0 for that KPI, others succeed)', async () => {
    const prisma = makePrismaMock({
      checkIn: {
        count: jest.fn().mockRejectedValue(new Error('boom')),
      },
      member: {
        count: jest.fn().mockResolvedValue(42),
      },
    });
    const svc = new DashboardPulseService(prisma as any);
    svc.invalidate();
    const result = await svc.getPulse(undefined);
    expect(result.check_ins_today.value).toBe(0);
    expect(result.active_members.value).toBe(42);
  });

  it('caches subsequent calls within TTL', async () => {
    const prisma = makePrismaMock();
    const svc = new DashboardPulseService(prisma as any);
    await svc.getPulse(undefined);
    const callsAfterFirst = prisma.member.count.mock.calls.length;
    await svc.getPulse(undefined);
    expect(prisma.member.count.mock.calls.length).toBe(callsAfterFirst);
  });

  it('invalidate(studioId) only clears matching keys', async () => {
    const prisma = makePrismaMock();
    const svc = new DashboardPulseService(prisma as any);
    const userA = { studio_id: 'studio-a', branch_ids: [] } as any;
    const userB = { studio_id: 'studio-b', branch_ids: [] } as any;
    await svc.getPulse(userA);
    await svc.getPulse(userB);
    const callsBefore = prisma.member.count.mock.calls.length;

    svc.invalidate('studio-a');
    await svc.getPulse(userA); // miss → recompute
    await svc.getPulse(userB); // hit → no recompute
    const callsAfter = prisma.member.count.mock.calls.length;
    // userA recompute issues 2 active-member counts (now + 30d-ago).
    // userB stays cached.
    expect(callsAfter - callsBefore).toBe(2);
  });
});
