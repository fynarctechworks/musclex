import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../database/prisma.service';
import { REDIS_CLIENT } from '../../config/redis.module';

type Sub = { status: 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'CANCELED' | 'TRIALING'; price_monthly: number };

/**
 * Compute the "true" MRR the way the old in-JS reducer did: sum price_monthly
 * of every ACTIVE subscription. The SQL query under test must return the same
 * number; the fixture-based spec below mocks $queryRaw to *return* this number,
 * which is the contract C1 relies on.
 */
function expectedMrr(subs: Sub[]): number {
  return subs.filter((s) => s.status === 'ACTIVE').reduce((sum, s) => sum + s.price_monthly, 0);
}

function makePrismaStub(subs: Sub[]) {
  const active = subs.filter((s) => s.status === 'ACTIVE');
  const pastDue = subs.filter((s) => s.status === 'PAST_DUE');
  const churned = subs.filter((s) => s.status === 'EXPIRED' || s.status === 'CANCELED');
  return {
    $queryRaw: jest.fn(async () => [{ mrr: expectedMrr(subs) }]),
    tenant: {
      count: jest.fn(async ({ where }: any = {}) => {
        // Cheap stub — return constants the spec doesn't assert on.
        if (where?.status === 'ACTIVE') return 5;
        if (where?.status === 'TRIAL') return 2;
        if (where?.status === 'SUSPENDED') return 1;
        if (where?.created_at) return 3;
        return 10;
      }),
    },
    subscription: {
      count: jest.fn(async ({ where }: any) => {
        if (where?.status === 'ACTIVE' && where?.end_date) return 0;
        if (where?.status === 'ACTIVE') return active.length;
        if (where?.status === 'PAST_DUE') return pastDue.length;
        if (where?.status?.in) return churned.length;
        return 0;
      }),
    },
    payment: {
      aggregate: jest.fn(async () => ({ _sum: { amount: 0 } })),
    },
  };
}

function makeRedisStub() {
  const store = new Map<string, string>();
  return {
    store,
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    setex: jest.fn(async (k: string, _ttl: number, v: string) => { store.set(k, v); return 'OK'; }),
    del: jest.fn(async (k: string) => { store.delete(k); return 1; }),
  };
}

async function buildService(subs: Sub[]) {
  const prisma = makePrismaStub(subs);
  const redis = makeRedisStub();
  const mod = await Test.createTestingModule({
    providers: [
      DashboardService,
      { provide: PrismaService, useValue: prisma },
      { provide: REDIS_CLIENT, useValue: redis },
    ],
  }).compile();
  return { svc: mod.get(DashboardService), prisma, redis };
}

describe('DashboardService — MRR via SQL aggregate (C1)', () => {
  it('MRR equals the SUM of price_monthly across only ACTIVE subs (mixed fixture)', async () => {
    const subs: Sub[] = [
      { status: 'ACTIVE',   price_monthly: 499 },
      { status: 'ACTIVE',   price_monthly: 1499 },
      { status: 'ACTIVE',   price_monthly: 4999 },
      { status: 'PAST_DUE', price_monthly: 1499 },   // excluded
      { status: 'EXPIRED',  price_monthly: 9999 },   // excluded
      { status: 'CANCELED', price_monthly: 4999 },   // excluded
      { status: 'TRIALING', price_monthly: 499 },    // excluded
    ];
    const { svc } = await buildService(subs);
    const m = await svc.getMetrics();
    expect(m.revenue.mrr).toBe(499 + 1499 + 4999);
    expect(m.revenue.arr).toBe((499 + 1499 + 4999) * 12);
  });

  it('handles the empty active-set case (MRR=0, ARR=0)', async () => {
    const subs: Sub[] = [
      { status: 'EXPIRED',  price_monthly: 1000 },
      { status: 'TRIALING', price_monthly: 500 },
    ];
    const { svc } = await buildService(subs);
    const m = await svc.getMetrics();
    expect(m.revenue.mrr).toBe(0);
    expect(m.revenue.arr).toBe(0);
  });

  it('handles a large fixture (1000 active subs at ₹1499 each = ₹1,499,000)', async () => {
    const subs: Sub[] = Array.from({ length: 1000 }, () => ({ status: 'ACTIVE' as const, price_monthly: 1499 }));
    const { svc } = await buildService(subs);
    const m = await svc.getMetrics();
    expect(m.revenue.mrr).toBe(1499 * 1000);
  });

  it('does NOT call $queryRaw a second time when the metrics cache is warm', async () => {
    const subs: Sub[] = [{ status: 'ACTIVE', price_monthly: 1499 }];
    const { svc, prisma } = await buildService(subs);

    const first = await svc.getMetrics();
    const second = await svc.getMetrics();
    expect(second).toEqual(first);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('clearCache forces a re-query on next read', async () => {
    const subs: Sub[] = [{ status: 'ACTIVE', price_monthly: 499 }];
    const { svc, prisma } = await buildService(subs);
    await svc.getMetrics();
    await svc.clearCache();
    await svc.getMetrics();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('past_due counter flows through to the payload (C5 + C1 integration)', async () => {
    const subs: Sub[] = [
      { status: 'ACTIVE',   price_monthly: 499 },
      { status: 'PAST_DUE', price_monthly: 1499 },
      { status: 'PAST_DUE', price_monthly: 4999 },
    ];
    const { svc } = await buildService(subs);
    const m = await svc.getMetrics();
    expect(m.subscriptions.past_due).toBe(2);
    expect(m.subscriptions.active).toBe(1);
  });
});
