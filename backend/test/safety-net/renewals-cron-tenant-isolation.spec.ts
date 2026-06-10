/**
 * SAFETY NET — AUTO-RENEWALS CRON TENANT ISOLATION (audit finding B1)
 *
 * The @Cron(EVERY_DAY_AT_3AM) handler in RenewalsService.handleAutoRenewals
 * runs unattended — there is no HTTP request and therefore no
 * tenantContext.run() wrapping. Today it calls getTenantGymId()! when
 * writing the new membership + payment rows; that returns undefined off-
 * request, so renewals either silently fail (no row written) or — in the
 * worst case — land under a stale/wrong gym scope picked up from a pooled
 * connection.
 *
 * This test seeds two gyms (A and B), each with one expired auto-renew
 * membership, and asserts that:
 *  (1) BOTH gyms' renewals are processed,
 *  (2) every write happens with the SOURCE membership's gym_id
 *      (gym A's renewal → gym_id = A; gym B's → gym_id = B), and
 *  (3) at write time the ambient tenant context (ALS) matches the source
 *      gym — exactly as a real HTTP request would have established.
 *
 * Against current code this MUST FAIL: gym_id will be `undefined` (or the
 * tx will throw on the NOT NULL constraint) and the ALS gymId will be
 * empty at write time.
 */

import { Logger } from '@nestjs/common';
import { RenewalsService } from '../../src/members/renewals.service';
import { tenantContext, getTenantGymId } from '../../src/common/tenant-context';

const GYM_A = '11111111-1111-1111-1111-111111111111';
const GYM_B = '22222222-2222-2222-2222-222222222222';

type CapturedWrite = {
  table: 'memberMembership' | 'payment';
  data: any;
  ambientGymId: string | undefined;
};

function buildHarness(memberships: any[]) {
  const writes: CapturedWrite[] = [];
  const statusUpdates: Array<{ id: string; ambientGymId: string | undefined }> = [];

  // Mock tx — the object passed into the $transaction callback.
  const tx: any = {
    memberMembership: {
      update: jest.fn(async ({ where, data }: any) => {
        statusUpdates.push({ id: where.id, ambientGymId: getTenantGymId() });
        return { id: where.id, ...data };
      }),
      create: jest.fn(async ({ data }: any) => {
        writes.push({ table: 'memberMembership', data, ambientGymId: getTenantGymId() });
        return { id: `new-mm-${writes.length}`, ...data };
      }),
    },
    payment: {
      create: jest.fn(async ({ data }: any) => {
        writes.push({ table: 'payment', data, ambientGymId: getTenantGymId() });
        return { id: `new-pay-${writes.length}`, ...data };
      }),
    },
  };

  const prisma: any = {
    memberMembership: {
      // The cron's outer findMany — we ignore any filter and just return both
      // candidates, simulating the current bug (no gym_id filter is applied).
      findMany: jest.fn().mockResolvedValue(memberships),
    },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };

  const cronLock: any = {
    withLock: jest.fn(async (_name: string, cb: () => Promise<unknown>) => cb()),
  };

  const service = new RenewalsService(prisma, cronLock);
  // Silence the verbose logger output during the test run.
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

  return { service, prisma, tx, writes, statusUpdates };
}

function makeMembership(opts: { id: string; gymId: string; branchId: string; memberId: string; planPrice: number }) {
  return {
    id: opts.id,
    gym_id: opts.gymId,
    branch_id: opts.branchId,
    member_id: opts.memberId,
    auto_renew: true,
    status: 'active',
    end_date: new Date(Date.now() - 86400000),
    grace_end_date: null,
    plan: {
      id: `plan-${opts.id}`,
      price: opts.planPrice,
      duration_days: 30,
      grace_period_days: 7,
      total_classes: null,
      max_visits: null,
    },
    member: { id: opts.memberId },
  };
}

describe('SAFETY-NET / RenewalsService.handleAutoRenewals tenant isolation (B1)', () => {
  it('processes each gym’s renewal under its own tenant scope (no cross-gym writes, no undefined gym_id)', async () => {
    const membershipA = makeMembership({
      id: 'mm-A',
      gymId: GYM_A,
      branchId: 'branch-A',
      memberId: 'member-A',
      planPrice: 1000,
    });
    const membershipB = makeMembership({
      id: 'mm-B',
      gymId: GYM_B,
      branchId: 'branch-B',
      memberId: 'member-B',
      planPrice: 2000,
    });

    const { service, writes, statusUpdates } = buildHarness([membershipA, membershipB]);

    // Invoke the cron the same way @Cron would — with NO ambient tenant context.
    // This is the whole point: the cron must establish its own per-gym scope.
    const result = await service.handleAutoRenewals();

    // (1) Both gyms’ renewals were processed.
    expect(result).toEqual({ renewed: 2, failed: 0 });
    expect(statusUpdates).toHaveLength(2);
    expect(writes.filter((w) => w.table === 'memberMembership')).toHaveLength(2);
    expect(writes.filter((w) => w.table === 'payment')).toHaveLength(2);

    // (2) Every write carries the source gym’s gym_id — never undefined, never
    //     the other gym.
    const aWrites = writes.filter(
      (w) =>
        (w.table === 'memberMembership' && w.data.member_id === 'member-A') ||
        (w.table === 'payment' && w.data.member_id === 'member-A'),
    );
    const bWrites = writes.filter(
      (w) =>
        (w.table === 'memberMembership' && w.data.member_id === 'member-B') ||
        (w.table === 'payment' && w.data.member_id === 'member-B'),
    );
    expect(aWrites).toHaveLength(2);
    expect(bWrites).toHaveLength(2);

    for (const w of aWrites) {
      expect(w.data.gym_id).toBe(GYM_A); // never undefined, never GYM_B
    }
    for (const w of bWrites) {
      expect(w.data.gym_id).toBe(GYM_B); // never undefined, never GYM_A
    }

    // (3) At write time, the ambient ALS tenant context matches the source.
    //     This is what tenantContext.run({gymId: membership.gym_id}, ...) buys
    //     us — every nested Prisma call auto-scopes correctly.
    for (const w of aWrites) {
      expect(w.ambientGymId).toBe(GYM_A);
    }
    for (const w of bWrites) {
      expect(w.ambientGymId).toBe(GYM_B);
    }

    // And we are definitely NOT in any tenant context after the cron returns.
    expect(tenantContext.getStore()).toBeUndefined();
  });

  it('skips (and counts as failed) any candidate that somehow lacks a gym_id, rather than writing under the wrong/empty scope', async () => {
    const ghost = makeMembership({
      id: 'mm-ghost',
      gymId: '', // simulate corrupt/missing source gym_id
      branchId: 'branch-X',
      memberId: 'member-X',
      planPrice: 500,
    });
    (ghost as any).gym_id = null;

    const { service, writes } = buildHarness([ghost]);
    const result = await service.handleAutoRenewals();

    expect(result).toEqual({ renewed: 0, failed: 1 });
    // No writes happened — failed safe rather than processing under undefined scope.
    expect(writes).toHaveLength(0);
  });
});
