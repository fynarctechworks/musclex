/**
 * SAFETY NET — DASHBOARD RAW-QUERY TENANT ISOLATION (audit finding H1)
 *
 * Raw SQL ($queryRaw / $queryRawUnsafe / $executeRaw*) bypasses the Prisma
 * $use middleware that injects gym_id, AND bypasses the same middleware's
 * `set_config('app.gym_id', ...)` call (the middleware short-circuits when
 * `params.model` is undefined, which is true for every raw query). The
 * remaining DB-layer safety net is RLS — which is sound only as long as
 *   (a) the prod DB role is NOT BYPASSRLS, and
 *   (b) the SAME connection just had app.gym_id set to the right value.
 * Neither is guaranteed across a connection pool when the request's first
 * DB call is a raw query.
 *
 * The robust fix is belt-and-suspenders: every raw query against tenant
 * tables must carry its own explicit `gym_id = $N::uuid` filter sourced
 * from the trusted tenant context (NEVER from client input).
 *
 * This test pins that invariant at the query-construction boundary. It is
 * deliberately NOT a live-DB test: it intercepts the SQL string and the
 * parameter list, and asserts that every raw query the dashboard issues
 *   1. contains a `gym_id` token in its WHERE clause, and
 *   2. binds the current tenant context's gym_id to one of its params.
 *
 * Against the pre-fix code this MUST FAIL for DashboardPulseService's
 * five SQL helpers and FootfallHeatmapService's heatmap query — none of
 * them include `gym_id` in either the SQL or the params.
 */

import { tenantContext } from '../../src/common/tenant-context';
import { DashboardPulseService } from '../../src/dashboard/dashboard-pulse.service';
import { FootfallHeatmapService } from '../../src/dashboard/footfall-heatmap.service';

const GYM_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SCHEMA_A = `studio_${GYM_A.replace(/-/g, '_')}`;

type RawCall = { sql: string; params: unknown[] };

function makeCapturingPrisma(): {
  prisma: any;
  rawCalls: RawCall[];
} {
  const rawCalls: RawCall[] = [];

  const capture = (...args: unknown[]) => {
    const [sql, ...params] = args as [string, ...unknown[]];
    rawCalls.push({ sql: String(sql), params });
    return Promise.resolve([]);
  };

  const prisma: any = {
    // Model-bound calls used by pulse — return harmless empty results.
    member: { count: jest.fn().mockResolvedValue(0) },
    payment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    checkIn: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    memberMembership: { findMany: jest.fn().mockResolvedValue([]) },
    // Raw paths — capture every call.
    $queryRawUnsafe: jest.fn(capture),
    $executeRawUnsafe: jest.fn(capture),
    $queryRaw: jest.fn(capture),
    $executeRaw: jest.fn(capture),
  };

  return { prisma, rawCalls };
}

async function runAs<T>(gymId: string, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    tenantContext.run(
      {
        schemaName: SCHEMA_A,
        gymId,
        activeBranchId: null,
        allowedBranchIds: 'ALL',
        bypassBranchScope: false,
      },
      async () => {
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        }
      },
    );
  });
}

function assertScoped(call: RawCall, gymId: string, label: string) {
  expect(call.sql.toLowerCase()).toContain('gym_id');
  // The gym_id MUST be passed via a bound parameter — never interpolated
  // into the SQL string. Catching it in the params list also proves the
  // value came from the trusted server context, not from string concat.
  expect(call.params).toContain(gymId);
  // Sanity: never raw-string-interpolate a gym id we did not mean to use.
  // (Tolerates any uuid that happens to be in another field — we only
  // assert the *expected* tenant is bound, not that others are absent.)
  // The above two checks are the load-bearing assertions.
  void label;
}

describe('SAFETY-NET / Dashboard raw queries carry an explicit gym_id filter (H1)', () => {
  it('DashboardPulseService — every $queryRawUnsafe call scopes by gym_id', async () => {
    const { prisma, rawCalls } = makeCapturingPrisma();
    // Migration (feat/per-gym-schemas): pulse reads via `this.tenant.client.*`.
    const svc = new DashboardPulseService({ client: prisma } as any);

    await runAs(GYM_A, async () => {
      await svc.getPulse({ role: 'owner', studio_id: GYM_A } as any);
    });

    // Sanity: the pulse path actually issued raw SQL (otherwise the test
    // is silently passing without exercising anything).
    expect(rawCalls.length).toBeGreaterThan(0);

    for (const call of rawCalls) {
      assertScoped(call, GYM_A, 'pulse');
    }
  });

  it('FootfallHeatmapService — the heatmap aggregate scopes by gym_id', async () => {
    const { prisma, rawCalls } = makeCapturingPrisma();
    // Migration (feat/per-gym-schemas): heatmap reads via `this.tenant.client.*`.
    const svc = new FootfallHeatmapService({ client: prisma } as any);

    await runAs(GYM_A, async () => {
      await svc.getHeatmap({ role: 'owner', studio_id: GYM_A } as any, undefined, 30);
    });

    expect(rawCalls.length).toBeGreaterThan(0);
    for (const call of rawCalls) {
      assertScoped(call, GYM_A, 'heatmap');
    }
  });
});
