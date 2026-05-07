import { PortfolioService } from '../src/dashboard/portfolio.service';

interface MockPrisma {
  branch: { findMany: jest.Mock };
  member: { groupBy: jest.Mock };
  payment: { groupBy: jest.Mock };
  checkIn: { groupBy: jest.Mock };
  memberInvoice: { groupBy: jest.Mock };
  memberMembership: { groupBy: jest.Mock };
  $queryRawUnsafe: jest.Mock;
}

function makePrismaMock(overrides: Partial<MockPrisma> = {}): MockPrisma {
  const base: MockPrisma = {
    branch: { findMany: jest.fn().mockResolvedValue([]) },
    member: { groupBy: jest.fn().mockResolvedValue([]) },
    payment: { groupBy: jest.fn().mockResolvedValue([]) },
    checkIn: { groupBy: jest.fn().mockResolvedValue([]) },
    memberInvoice: { groupBy: jest.fn().mockResolvedValue([]) },
    memberMembership: { groupBy: jest.fn().mockResolvedValue([]) },
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  };
  return { ...base, ...overrides };
}

describe('PortfolioService', () => {
  it('returns empty rollup when there are no branches', async () => {
    const svc = new PortfolioService(makePrismaMock() as any);
    const result = await svc.getPortfolio({ studio_id: 's1' } as any);
    expect(result.branches).toEqual([]);
    expect(result.rollup.branch_count).toBe(0);
    expect(result.rollup.use_map_view).toBe(false);
  });

  it('rolls up totals across branches and computes per-branch metrics', async () => {
    const branches = [
      { id: 'b1', name: 'Andheri' },
      { id: 'b2', name: 'Bandra' },
    ];
    const prisma = makePrismaMock({
      branch: { findMany: jest.fn().mockResolvedValue(branches) },
      member: {
        groupBy: jest.fn().mockResolvedValue([
          { branch_id: 'b1', _count: { _all: 100 } },
          { branch_id: 'b2', _count: { _all: 200 } },
        ]),
      },
      payment: {
        groupBy: jest
          .fn()
          // today
          .mockResolvedValueOnce([
            { branch_id: 'b1', _sum: { amount: 1000 } },
            { branch_id: 'b2', _sum: { amount: 3000 } },
          ])
          // this week
          .mockResolvedValueOnce([
            { branch_id: 'b1', _sum: { amount: 7000 } },
            { branch_id: 'b2', _sum: { amount: 21000 } },
          ])
          // prior week
          .mockResolvedValueOnce([
            { branch_id: 'b1', _sum: { amount: 5000 } },
            { branch_id: 'b2', _sum: { amount: 30000 } },
          ]),
      },
      checkIn: {
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([
            { branch_id: 'b1', _count: { _all: 50 } },
            { branch_id: 'b2', _count: { _all: 80 } },
          ])
          .mockResolvedValueOnce([
            { branch_id: 'b1', _count: { _all: 350 } },
            { branch_id: 'b2', _count: { _all: 560 } },
          ])
          .mockResolvedValueOnce([
            { branch_id: 'b1', _count: { _all: 300 } },
            { branch_id: 'b2', _count: { _all: 400 } },
          ]),
      },
      memberInvoice: {
        groupBy: jest.fn().mockResolvedValue([
          { branch_id: 'b1', _sum: { total_amount: 2500 } },
        ]),
      },
      memberMembership: {
        groupBy: jest.fn().mockResolvedValue([
          { branch_id: 'b1', _count: { _all: 5 } },
          { branch_id: 'b2', _count: { _all: 12 } },
        ]),
      },
    });
    const svc = new PortfolioService(prisma as any);
    const result = await svc.getPortfolio({ studio_id: 's1' } as any);

    expect(result.branches).toHaveLength(2);
    expect(result.rollup.branch_count).toBe(2);
    expect(result.rollup.total_active_members).toBe(300);
    expect(result.rollup.total_today_revenue).toBe(4000);
    expect(result.rollup.total_check_ins_today).toBe(130);
    expect(result.rollup.total_outstanding_dues).toBe(2500);
    expect(result.rollup.total_renewals_at_risk_7d).toBe(17);

    const b1 = result.branches.find((b) => b.branch_id === 'b1')!;
    const b2 = result.branches.find((b) => b.branch_id === 'b2')!;

    // b1: 7000 vs 5000 prior → +40%
    expect(b1.revenue_wow_pct).toBe(40);
    // b2: 21000 vs 30000 → -30%
    expect(b2.revenue_wow_pct).toBe(-30);
    // Per-capita: b1 → 7000/100 = 70; b2 → 21000/200 = 105
    expect(b1.revenue_per_member).toBe(70);
    expect(b2.revenue_per_member).toBe(105);
  });

  it('flags hard-threshold revenue drops as outliers (≥25%)', async () => {
    const branches = [
      { id: 'b1', name: 'Andheri' },
      { id: 'b2', name: 'Bandra' },
      { id: 'b3', name: 'Colaba' },
    ];
    const prisma = makePrismaMock({
      branch: { findMany: jest.fn().mockResolvedValue(branches) },
      member: {
        groupBy: jest.fn().mockResolvedValue(
          branches.map((b) => ({ branch_id: b.id, _count: { _all: 100 } })),
        ),
      },
      payment: {
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([])
          // this week
          .mockResolvedValueOnce([
            { branch_id: 'b1', _sum: { amount: 10000 } },
            { branch_id: 'b2', _sum: { amount: 9500 } },
            { branch_id: 'b3', _sum: { amount: 6000 } },
          ])
          // prior week
          .mockResolvedValueOnce([
            { branch_id: 'b1', _sum: { amount: 10000 } },
            { branch_id: 'b2', _sum: { amount: 10000 } },
            { branch_id: 'b3', _sum: { amount: 10000 } }, // -40%
          ]),
      },
    });
    const svc = new PortfolioService(prisma as any);
    const result = await svc.getPortfolio({ studio_id: 's1' } as any);
    const b3 = result.branches.find((b) => b.branch_id === 'b3')!;
    expect(b3.outliers.length).toBeGreaterThan(0);
    expect(b3.outliers.some((o) => o.toLowerCase().includes('revenue'))).toBe(
      true,
    );
  });

  it('auto-engages map view when branch count > 8', async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      id: `b${i}`,
      name: `Branch ${i}`,
    }));
    const prisma = makePrismaMock({
      branch: { findMany: jest.fn().mockResolvedValue(many) },
    });
    const svc = new PortfolioService(prisma as any);
    const result = await svc.getPortfolio({ studio_id: 's1' } as any);
    expect(result.rollup.use_map_view).toBe(true);
    expect(result.rollup.branch_count).toBe(9);
  });

  it('keeps card view when branches ≤ 8', async () => {
    const few = Array.from({ length: 5 }, (_, i) => ({
      id: `b${i}`,
      name: `Branch ${i}`,
    }));
    const prisma = makePrismaMock({
      branch: { findMany: jest.fn().mockResolvedValue(few) },
    });
    const svc = new PortfolioService(prisma as any);
    const result = await svc.getPortfolio({ studio_id: 's1' } as any);
    expect(result.rollup.use_map_view).toBe(false);
  });

  it('caches subsequent calls within TTL', async () => {
    const prisma = makePrismaMock();
    const svc = new PortfolioService(prisma as any);
    await svc.getPortfolio({ studio_id: 's1' } as any);
    await svc.getPortfolio({ studio_id: 's1' } as any);
    expect(prisma.branch.findMany.mock.calls.length).toBe(1);
  });

  it('invalidate(studioId) only clears matching keys', async () => {
    const prisma = makePrismaMock();
    const svc = new PortfolioService(prisma as any);
    await svc.getPortfolio({ studio_id: 's1' } as any);
    await svc.getPortfolio({ studio_id: 's2' } as any);
    expect(prisma.branch.findMany.mock.calls.length).toBe(2);

    svc.invalidate('s1');
    await svc.getPortfolio({ studio_id: 's1' } as any); // miss
    await svc.getPortfolio({ studio_id: 's2' } as any); // hit
    expect(prisma.branch.findMany.mock.calls.length).toBe(3);
  });
});
