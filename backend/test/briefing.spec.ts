import { BriefingService } from '../src/dashboard/briefing.service';

interface MockPrisma {
  studio: { findMany: jest.Mock };
  $queryRawUnsafe: jest.Mock;
  $executeRawUnsafe: jest.Mock;
}

function makePrisma(overrides: Partial<MockPrisma> = {}): MockPrisma {
  return {
    studio: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const config = {
  get: () => undefined, // No ANTHROPIC_API_KEY → fallback path
};

describe('BriefingService', () => {
  it('returns an empty briefing when no studio_id is in JWT', async () => {
    const svc = new BriefingService(makePrisma() as any, config as any);
    const result = await svc.getOrGenerate(undefined);
    expect(result.summary).toMatch(/not available/i);
    expect(result.recommendations).toEqual([]);
  });

  it('uses the fallback path when Claude is not configured (no API key)', async () => {
    const pulse = {
      getPulse: jest.fn().mockResolvedValue({
        active_members: { value: 250 },
        today_revenue: { value: 8400, delta_pct: 12 },
        mrr: { value: 180000, delta_pct: 5 },
        check_ins_today: { value: 47 },
        renewals_at_risk_7d: { value: 8, value_at_stake: 56000 },
        outstanding_dues: { value: 14000, invoice_count: 3 },
      }),
    };
    const queue = {
      getActions: jest.fn().mockResolvedValue([
        {
          id: 'renewal_at_risk:m1:2026-05-13',
          kind: 'renewal_at_risk',
          severity: 'medium',
          title: '8 memberships expire in 7 days',
          impact_amount: 56000,
        },
      ]),
    };
    const prisma = makePrisma();
    const svc = new BriefingService(
      prisma as any,
      config as any,
      pulse as any,
      queue as any,
    );
    const result = await svc.generate({ studio_id: 's1', user_id: 'u1' } as any);
    // Fallback always returns *something* (no model dependency)
    expect(result.summary).toBeTruthy();
    expect(result.summary).toMatch(/47|check-in/i);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.model).toBeNull();
  });

  it('persists the briefing on generate()', async () => {
    const pulse = {
      getPulse: jest.fn().mockResolvedValue({
        active_members: { value: 100 },
        today_revenue: { value: 5000 },
        mrr: { value: 50000 },
        check_ins_today: { value: 20 },
        renewals_at_risk_7d: { value: 0, value_at_stake: 0 },
        outstanding_dues: { value: 0, invoice_count: 0 },
      }),
    };
    const queue = { getActions: jest.fn().mockResolvedValue([]) };
    const prisma = makePrisma();
    const svc = new BriefingService(
      prisma as any,
      config as any,
      pulse as any,
      queue as any,
    );
    await svc.generate({ studio_id: 's1', user_id: 'u1' } as any);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalled();
    const sql = prisma.$executeRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('dashboard_briefings');
  });

  it('serves stored briefing when fresh (<24h old)', async () => {
    const recent = new Date(Date.now() - 1 * 3600 * 1000); // 1h ago
    const prisma = makePrisma({
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          briefing_date: '2026-05-07',
          headline: 'Renewals are stacking up',
          summary: 'cached summary',
          recommendations: [],
          metrics: {},
          generated_at: recent,
          model: 'claude-sonnet-4-20250514',
        },
      ]),
    });
    const svc = new BriefingService(prisma as any, config as any);
    const result = await svc.getOrGenerate({ studio_id: 's1' } as any);
    expect(result.summary).toBe('cached summary');
    expect(result.headline).toBe('Renewals are stacking up');
  });

  it('regenerates when stored briefing is older than 24h', async () => {
    const stale = new Date(Date.now() - 26 * 3600 * 1000); // 26h ago
    const prisma = makePrisma({
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          briefing_date: '2026-05-06',
          headline: 'old',
          summary: 'old summary',
          recommendations: [],
          metrics: {},
          generated_at: stale,
          model: null,
        },
      ]),
    });
    const pulse = {
      getPulse: jest.fn().mockResolvedValue({
        active_members: { value: 100 },
        today_revenue: { value: 5000 },
        mrr: { value: 50000 },
        check_ins_today: { value: 20 },
        renewals_at_risk_7d: { value: 0, value_at_stake: 0 },
        outstanding_dues: { value: 0, invoice_count: 0 },
      }),
    };
    const queue = { getActions: jest.fn().mockResolvedValue([]) };
    const svc = new BriefingService(
      prisma as any,
      config as any,
      pulse as any,
      queue as any,
    );
    const result = await svc.getOrGenerate({ studio_id: 's1', user_id: 'u1' } as any);
    expect(result.summary).not.toBe('old summary');
    expect(prisma.$executeRawUnsafe).toHaveBeenCalled();
  });
});
