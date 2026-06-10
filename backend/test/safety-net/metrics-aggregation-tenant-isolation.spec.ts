/**
 * SAFETY NET — METRICS AGGREGATION CRON TENANT ISOLATION (audit finding M2)
 *
 * MetricsAggregationJob runs @Cron handlers off-request. Today each handler
 * enumerates rows (branches / templates / members / staff / campaigns) with
 * no tenant context, then runs per-row Prisma reads + writes — also without
 * tenant context.
 *
 * Blast radius today: defense-in-depth gap. Reads happen to stay scoped
 * because branch_id / member_id / template_id / trainer_id / campaign_id
 * are globally unique UUIDs, and writes carry gym_id explicitly from the
 * source row. But the Prisma $use middleware skips gym_id injection AND
 * skips SET app.gym_id when there is no ALS context, so:
 *   - Layer 1 (RLS) is INERT for the entire run.
 *   - Layer 2 (gym_id where-injection) is INERT for the entire run.
 *   - A future filter that's NOT globally unique would silently aggregate
 *     across gyms.
 *
 * The B1 pattern fix: wrap each per-row iteration in
 *   tenantContext.run({ gymId: row.gym_id, ... }, async () => ...)
 * so every nested Prisma call auto-scopes correctly.
 *
 * This test seeds two gyms (A and B) and asserts that at the moment each
 * per-row Prisma call runs, the ambient ALS gymId matches the row's source
 * gym. Against current code this MUST FAIL (ambient gymId is undefined).
 */

import { Logger } from '@nestjs/common';
import { MetricsAggregationJob } from '../../src/analytics/jobs/metrics-aggregation.job';
import {
  tenantContext,
  getTenantGymId,
} from '../../src/common/tenant-context';

const GYM_A = '11111111-1111-1111-1111-111111111111';
const GYM_B = '22222222-2222-2222-2222-222222222222';

type AmbientObservation = { branchId?: string; gymId: string | undefined };

function buildHarness(opts: {
  branches?: any[];
  templates?: any[];
  members?: any[];
  trainers?: any[];
  campaigns?: any[];
}) {
  const ambient: AmbientObservation[] = [];

  const captureAmbient = (branchId?: string) => {
    ambient.push({ branchId, gymId: getTenantGymId() });
  };

  const prisma: any = {
    branch: {
      findMany: jest.fn().mockResolvedValue(opts.branches ?? []),
    },
    classTemplate: {
      findMany: jest.fn().mockResolvedValue(opts.templates ?? []),
    },
    member: {
      findMany: jest.fn().mockResolvedValue(opts.members ?? []),
      update: jest.fn(async ({ where }: any) => {
        captureAmbient(where?.id);
        return { id: where?.id };
      }),
    },
    staff: {
      findMany: jest.fn().mockResolvedValue(opts.trainers ?? []),
    },
    campaign: {
      findMany: jest.fn().mockResolvedValue(opts.campaigns ?? []),
    },
    campaignAudience: {
      groupBy: jest.fn(async ({ where }: any) => {
        captureAmbient(where?.campaign_id);
        return [];
      }),
    },
    payment: {
      aggregate: jest.fn(async ({ where }: any) => {
        captureAmbient(where?.branch_id);
        return { _sum: { amount: 0 }, _count: 0 };
      }),
    },
    checkIn: {
      count: jest.fn(async ({ where }: any) => {
        captureAmbient(where?.branch_id ?? where?.member_id);
        return 0;
      }),
    },
    classSession: {
      count: jest.fn(async ({ where }: any) => {
        captureAmbient(where?.branch_id);
        return 0;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        captureAmbient(where?.branch_id);
        return [];
      }),
    },
    posSaleItem: {
      aggregate: jest.fn(async ({ where }: any) => {
        captureAmbient(where?.sale?.branch_id);
        return { _sum: { quantity: 0 } };
      }),
    },
    posSale: {
      aggregate: jest.fn(async ({ where }: any) => {
        captureAmbient(where?.branch_id);
        return { _sum: { total_amount: 0 }, _count: 0 };
      }),
    },
    memberMembership: {
      count: jest.fn(async ({ where }: any) => {
        captureAmbient(where?.branch_id);
        return 0;
      }),
    },
    classAttendance: {
      count: jest.fn(async ({ where }: any) => {
        captureAmbient(where?.member_id);
        return 0;
      }),
    },
    trainerSession: {
      count: jest.fn(async ({ where }: any) => {
        captureAmbient(where?.trainer_id ?? where?.member_id);
        return 0;
      }),
      groupBy: jest.fn(async ({ where }: any) => {
        captureAmbient(where?.trainer_id);
        return [];
      }),
    },
    trainerRevenue: {
      aggregate: jest.fn(async ({ where }: any) => {
        captureAmbient(where?.trainer_id);
        return { _sum: { revenue_amount: 0 } };
      }),
    },
    dailyGymMetrics: {
      upsert: jest.fn(async ({ create }: any) => {
        captureAmbient(create?.branch_id);
        return { id: 'dgm' };
      }),
    },
    revenueAnalytics: {
      upsert: jest.fn(async ({ create }: any) => {
        captureAmbient(create?.branch_id);
        return { id: 'ra' };
      }),
    },
    membershipAnalytics: {
      upsert: jest.fn(async ({ create }: any) => {
        captureAmbient(create?.branch_id);
        return { id: 'ma' };
      }),
    },
    classAnalytics: {
      upsert: jest.fn(async ({ create }: any) => {
        captureAmbient(create?.branch_id);
        return { id: 'ca' };
      }),
    },
    memberBehaviorAnalytics: {
      create: jest.fn(async ({ data }: any) => {
        captureAmbient(data?.member_id);
        return { id: 'mba' };
      }),
    },
    trainerAnalytics: {
      upsert: jest.fn(async ({ create }: any) => {
        captureAmbient(create?.branch_id);
        return { id: 'ta' };
      }),
    },
    campaignAnalyticsRecord: {
      create: jest.fn(async ({ data }: any) => {
        captureAmbient(data?.campaign_id);
        return { id: 'car' };
      }),
    },
  };

  const cronLock: any = {
    withLock: jest.fn(async (_n: string, cb: () => Promise<unknown>) => cb()),
  };

  const job = new MetricsAggregationJob(prisma, cronLock);

  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

  return { job, ambient };
}

function expectAllAmbientMatch(
  ambient: AmbientObservation[],
  branchToGym: Record<string, string>,
) {
  expect(ambient.length).toBeGreaterThan(0);
  for (const obs of ambient) {
    if (!obs.branchId) continue;
    const expected = branchToGym[obs.branchId];
    if (!expected) continue;
    expect(obs.gymId).toBe(expected);
  }
  // Outside the cron, no ambient context should remain.
  expect(tenantContext.getStore()).toBeUndefined();
}

describe('SAFETY-NET / MetricsAggregationJob tenant isolation (M2)', () => {
  const branches = [
    { id: 'branch-A', organization_id: 'org-A', gym_id: GYM_A, is_active: true },
    { id: 'branch-B', organization_id: 'org-B', gym_id: GYM_B, is_active: true },
  ];
  const branchToGym = { 'branch-A': GYM_A, 'branch-B': GYM_B };

  it('aggregateDailyMetrics processes each branch under its own tenant scope', async () => {
    const { job, ambient } = buildHarness({ branches });
    await job.aggregateDailyMetrics();
    expectAllAmbientMatch(ambient, branchToGym);
  });

  it('aggregateRevenueAnalytics processes each branch under its own tenant scope', async () => {
    const { job, ambient } = buildHarness({ branches });
    await job.aggregateRevenueAnalytics();
    expectAllAmbientMatch(ambient, branchToGym);
  });

  it('aggregateMembershipAnalytics processes each branch under its own tenant scope', async () => {
    const { job, ambient } = buildHarness({ branches });
    await job.aggregateMembershipAnalytics();
    expectAllAmbientMatch(ambient, branchToGym);
  });

  it('aggregateClassAnalytics processes each template under its own tenant scope', async () => {
    const templates = [
      { id: 'tmpl-A', branch_id: 'branch-A', gym_id: GYM_A, is_active: true },
      { id: 'tmpl-B', branch_id: 'branch-B', gym_id: GYM_B, is_active: true },
    ];
    const { job, ambient } = buildHarness({ templates });
    await job.aggregateClassAnalytics();
    expectAllAmbientMatch(ambient, branchToGym);
  });

  it('aggregateMemberBehavior processes each member under its own tenant scope', async () => {
    const members = [
      { id: 'mem-A', branch_id: 'branch-A', gym_id: GYM_A, last_visit_at: null, status: 'active' },
      { id: 'mem-B', branch_id: 'branch-B', gym_id: GYM_B, last_visit_at: null, status: 'active' },
    ];
    const { job, ambient } = buildHarness({ members });
    await job.aggregateMemberBehavior();
    // For this job the "id" passed to captureAmbient is the member id; map them.
    expect(ambient.length).toBeGreaterThan(0);
    const memberToGym: Record<string, string> = { 'mem-A': GYM_A, 'mem-B': GYM_B };
    for (const obs of ambient) {
      if (!obs.branchId) continue;
      const expected = memberToGym[obs.branchId];
      if (!expected) continue;
      expect(obs.gymId).toBe(expected);
    }
    expect(tenantContext.getStore()).toBeUndefined();
  });

  it('aggregateTrainerAnalytics processes each trainer under its own tenant scope', async () => {
    const trainers = [
      { id: 'tr-A', branch_id: 'branch-A', gym_id: GYM_A, status: 'active', role: 'trainer' },
      { id: 'tr-B', branch_id: 'branch-B', gym_id: GYM_B, status: 'active', role: 'trainer' },
    ];
    const { job, ambient } = buildHarness({ trainers });
    await job.aggregateTrainerAnalytics();
    expect(ambient.length).toBeGreaterThan(0);
    const trainerToGym: Record<string, string> = { 'tr-A': GYM_A, 'tr-B': GYM_B };
    for (const obs of ambient) {
      if (!obs.branchId) continue;
      const expected = trainerToGym[obs.branchId];
      if (!expected) continue;
      expect(obs.gymId).toBe(expected);
    }
    expect(tenantContext.getStore()).toBeUndefined();
  });

  it('aggregateCampaignAnalytics processes each campaign under its own tenant scope', async () => {
    const campaigns = [
      { id: 'cmp-A', gym_id: GYM_A, status: 'sent' },
      { id: 'cmp-B', gym_id: GYM_B, status: 'sent' },
    ];
    const { job, ambient } = buildHarness({ campaigns });
    await job.aggregateCampaignAnalytics();
    expect(ambient.length).toBeGreaterThan(0);
    const cmpToGym: Record<string, string> = { 'cmp-A': GYM_A, 'cmp-B': GYM_B };
    for (const obs of ambient) {
      if (!obs.branchId) continue;
      const expected = cmpToGym[obs.branchId];
      if (!expected) continue;
      expect(obs.gymId).toBe(expected);
    }
    expect(tenantContext.getStore()).toBeUndefined();
  });

  it('skips rows that lack a gym_id rather than processing under uncertain scope', async () => {
    const branchesMissingGym = [
      { id: 'branch-X', organization_id: 'org-X', gym_id: null, is_active: true },
      { id: 'branch-A', organization_id: 'org-A', gym_id: GYM_A, is_active: true },
    ];
    const { job, ambient } = buildHarness({ branches: branchesMissingGym });
    await job.aggregateDailyMetrics();
    // Nothing should have been computed under undefined ambient scope.
    for (const obs of ambient) {
      // Either ran under GYM_A or never ran at all for branch-X.
      if (obs.branchId === 'branch-X') {
        throw new Error('branch-X should have been skipped, not processed');
      }
    }
  });
});
