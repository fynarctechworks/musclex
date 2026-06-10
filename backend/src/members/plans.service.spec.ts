import { BadRequestException } from '@nestjs/common';
import { PlansService } from './plans.service';
import { tenantContext } from '../common/tenant-context';

/**
 * Focused tests for the new multi-gym fields on PlansService — the
 * validateAccessScope branches + sanitizeBranchOverrides shape, and an
 * end-to-end create() that confirms Prisma receives the right payload.
 */
describe('PlansService — multi-gym access scope', () => {
  const GYM = '00000000-0000-0000-0000-0000000000aa';
  const BRANCH_A = '00000000-0000-0000-0000-0000000000c1';
  const BRANCH_B = '00000000-0000-0000-0000-0000000000c2';

  const inTenant = <T>(fn: () => Promise<T>): Promise<T> =>
    tenantContext.run(
      {
        schemaName: `studio_${GYM.replace(/-/g, '_')}`,
        gymId: GYM,
        activeBranchId: BRANCH_A,
        allowedBranchIds: 'ALL',
        bypassBranchScope: false,
      },
      fn,
    );

  function makeService() {
    const created = jest.fn();
    const prisma: any = {
      membershipPlan: {
        create: created.mockResolvedValue({
          id: 'p1',
          price: 999,
          yearly_price: null,
        }),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    return { prisma, created, service: new PlansService(prisma) };
  }

  // ── single_branch: scope validation is a no-op, fields default safely ──

  it('creates a single_branch plan with safe defaults for new fields', async () => {
    const { created, service } = makeService();
    await inTenant(() =>
      service.create({
        name: 'Monthly Basic',
        plan_type: 'monthly',
        price: 999,
      }),
    );

    const payload = created.mock.calls[0][0].data;
    expect(payload.access_type).toBe('single_branch');
    expect(payload.tier).toBe('standard'); // default when no tier provided
    expect(payload.allowed_branch_ids).toEqual([]);
    expect(payload.allowed_city).toBeNull();
    expect(payload.allowed_hours_json).toBeDefined(); // Prisma.JsonNull is a sentinel
    expect(payload.feature_flags).toEqual({});
    expect(payload.branch_price_overrides).toEqual({});
    expect(payload.multi_branch_access).toBe(false);
  });

  // ── multi_branch ────────────────────────────────────────────────────

  it('persists allowed_branch_ids for a multi_branch plan and sets legacy boolean', async () => {
    const { created, service } = makeService();
    await inTenant(() =>
      service.create({
        name: 'Twin City',
        plan_type: 'monthly',
        price: 1499,
        access_type: 'multi_branch',
        tier: 'pro',
        allowed_branch_ids: [BRANCH_A, BRANCH_B],
        branch_price_overrides: { [BRANCH_B]: 1799 },
      }),
    );

    const payload = created.mock.calls[0][0].data;
    expect(payload.access_type).toBe('multi_branch');
    expect(payload.tier).toBe('pro');
    expect(payload.allowed_branch_ids).toEqual([BRANCH_A, BRANCH_B]);
    expect(payload.branch_price_overrides).toEqual({ [BRANCH_B]: 1799 });
    expect(payload.multi_branch_access).toBe(true);
  });

  it('rejects multi_branch plan without allowed_branch_ids', async () => {
    const { service } = makeService();
    await expect(
      inTenant(() =>
        service.create({
          name: 'Broken',
          plan_type: 'monthly',
          price: 1499,
          access_type: 'multi_branch',
          allowed_branch_ids: [],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ── all_access ──────────────────────────────────────────────────────

  it('persists an all_access plan with empty allowed_branch_ids', async () => {
    const { created, service } = makeService();
    await inTenant(() =>
      service.create({
        name: 'Network Pass',
        plan_type: 'monthly',
        price: 2499,
        access_type: 'all_access',
        tier: 'elite',
      }),
    );
    const payload = created.mock.calls[0][0].data;
    expect(payload.access_type).toBe('all_access');
    expect(payload.tier).toBe('elite');
    expect(payload.allowed_branch_ids).toEqual([]);
    expect(payload.multi_branch_access).toBe(true);
  });

  // ── city_access ─────────────────────────────────────────────────────

  it('persists allowed_city for city_access plans', async () => {
    const { created, service } = makeService();
    await inTenant(() =>
      service.create({
        name: 'Hyderabad Pass',
        plan_type: 'monthly',
        price: 1799,
        access_type: 'city_access',
        allowed_city: 'Hyderabad',
      }),
    );
    const payload = created.mock.calls[0][0].data;
    expect(payload.access_type).toBe('city_access');
    expect(payload.allowed_city).toBe('Hyderabad');
  });

  it('rejects city_access plan without allowed_city', async () => {
    const { service } = makeService();
    await expect(
      inTenant(() =>
        service.create({
          name: 'Missing City',
          plan_type: 'monthly',
          price: 1799,
          access_type: 'city_access',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ── time_based ──────────────────────────────────────────────────────

  it('persists allowed_hours_json for time_based plans', async () => {
    const { created, service } = makeService();
    await inTenant(() =>
      service.create({
        name: 'Off-Peak',
        plan_type: 'monthly',
        price: 799,
        access_type: 'time_based',
        allowed_hours_json: { start: '10:00', end: '17:00' },
      }),
    );
    const payload = created.mock.calls[0][0].data;
    expect(payload.access_type).toBe('time_based');
    expect(payload.allowed_hours_json).toEqual({ start: '10:00', end: '17:00' });
  });

  it('rejects time_based plan without start/end', async () => {
    const { service } = makeService();
    await expect(
      inTenant(() =>
        service.create({
          name: 'Bad Hours',
          plan_type: 'monthly',
          price: 799,
          access_type: 'time_based',
          allowed_hours_json: { start: '10:00' } as any,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ── branch_price_overrides sanitization ─────────────────────────────

  it('drops negative + non-numeric branch_price_overrides', async () => {
    const { created, service } = makeService();
    await inTenant(() =>
      service.create({
        name: 'Twin City',
        plan_type: 'monthly',
        price: 1499,
        access_type: 'multi_branch',
        allowed_branch_ids: [BRANCH_A],
        branch_price_overrides: {
          [BRANCH_A]: '1999',          // stringified — should survive
          [BRANCH_B]: -50,             // negative — should drop
          'garbage-key': 'not-a-num',  // non-numeric — should drop
        } as any,
      }),
    );
    const payload = created.mock.calls[0][0].data;
    expect(payload.branch_price_overrides).toEqual({ [BRANCH_A]: 1999 });
  });

  it('rejects unknown access_type', async () => {
    const { service } = makeService();
    await expect(
      inTenant(() =>
        service.create({
          name: 'Unknown',
          plan_type: 'monthly',
          price: 999,
          access_type: 'voodoo' as any,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
