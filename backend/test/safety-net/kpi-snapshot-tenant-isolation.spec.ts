/**
 * SAFETY NET — KPI SNAPSHOT CRON TENANT ISOLATION (audit finding M2, sibling)
 *
 * KpiSnapshotService.runNightlySnapshot enumerates studios and calls
 * captureNow() for each. captureNow() invokes DashboardPulseService.getPulse,
 * which internally reads getTenantGymId() — but the cron never wraps the
 * per-studio call in tenantContext.run(...). Off-request, getTenantGymId()
 * returns undefined, so the MRR / renewals / outstanding-dues computations
 * inside DashboardPulseService FAIL-CLOSED to 0. The snapshot rows therefore
 * persist zeroes attributed to the right gym — defeating the entire point
 * of the snapshot.
 *
 * The fix: wrap each per-studio iteration in
 *   tenantContext.run({ gymId: studio.id, ... }, async () => captureNow(...))
 * so the pulse computation runs under the studio's own tenant scope.
 *
 * This test seeds two studios (A and B) and asserts that at the moment
 * pulse.getPulse() is invoked, the ambient ALS gymId matches the studio
 * being processed. Against current code this MUST FAIL (ambient is undefined).
 */

import { Logger } from '@nestjs/common';
import { KpiSnapshotService } from '../../src/dashboard/kpi-snapshot.service';
import {
  tenantContext,
  getTenantGymId,
} from '../../src/common/tenant-context';

const GYM_A = '11111111-1111-1111-1111-111111111111';
const GYM_B = '22222222-2222-2222-2222-222222222222';

function buildHarness(studios: Array<{ id: string; owner_user_id: string }>) {
  const pulseAmbient: Array<{ studioId: string; gymId: string | undefined }> = [];
  const writes: Array<{ args: any[]; gymId: string | undefined }> = [];

  const prisma: any = {
    studio: {
      findMany: jest.fn().mockResolvedValue(studios),
    },
    $executeRawUnsafe: jest.fn(async (...args: any[]) => {
      writes.push({ args, gymId: getTenantGymId() });
      return 1;
    }),
  };

  const pulse: any = {
    getPulse: jest.fn(async (user: any) => {
      pulseAmbient.push({ studioId: user?.studio_id, gymId: getTenantGymId() });
      return {
        active_members: { value: 1 },
        today_revenue: { value: 1 },
        mrr: { value: 1 },
        check_ins_today: { value: 1 },
        renewals_at_risk_7d: { value: 1 },
        outstanding_dues: { value: 1 },
      };
    }),
  };

  const service = new KpiSnapshotService(prisma, pulse);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

  return { service, pulseAmbient, writes };
}

describe('SAFETY-NET / KpiSnapshotService tenant isolation (M2)', () => {
  it('runs each studio’s snapshot under its own tenant scope so pulse computations have a gymId', async () => {
    const studios = [
      { id: GYM_A, owner_user_id: 'u-A' },
      { id: GYM_B, owner_user_id: 'u-B' },
    ];
    const { service, pulseAmbient, writes } = buildHarness(studios);

    await service.runNightlySnapshot();

    // Pulse was invoked once per studio.
    expect(pulseAmbient).toHaveLength(2);

    // At the moment of each pulse call, ambient gymId must match the studio.
    const aPulse = pulseAmbient.find((p) => p.studioId === GYM_A);
    const bPulse = pulseAmbient.find((p) => p.studioId === GYM_B);
    expect(aPulse?.gymId).toBe(GYM_A);
    expect(bPulse?.gymId).toBe(GYM_B);

    // Snapshot writes must also have happened under the correct ambient scope.
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) {
      const sqlGymId = w.args[1] as string;
      expect(w.gymId).toBe(sqlGymId);
    }

    // No ambient context leaks out of the cron.
    expect(tenantContext.getStore()).toBeUndefined();
  });

  it('skips studios that lack an id rather than running pulse under undefined scope', async () => {
    const studios = [
      { id: '', owner_user_id: 'u-X' } as any,
      { id: GYM_A, owner_user_id: 'u-A' },
    ];
    const { service, pulseAmbient } = buildHarness(studios);
    await service.runNightlySnapshot();
    // Only the valid studio should have been pulsed.
    expect(pulseAmbient.find((p) => p.studioId === GYM_A)?.gymId).toBe(GYM_A);
    expect(pulseAmbient.find((p) => p.gymId === undefined)).toBeUndefined();
  });
});
