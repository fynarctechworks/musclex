import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WorkoutPlansService } from '../../src/plans/workout-plans.service';
import { DietPlansService } from '../../src/plans/diet-plans.service';
import { tenantContext } from '../../src/common/tenant-context';

const GYM = '44444444-4444-4444-4444-444444444444';

const run = <T>(fn: () => Promise<T>) =>
  tenantContext.run(
    { schemaName: 'studio_test', gymId: GYM, activeBranchId: null, allowedBranchIds: 'ALL', bypassBranchScope: true } as any,
    fn,
  );

describe('WorkoutPlansService.assign', () => {
  function makeService(opts: { plan?: any; member?: any; existing?: any[] }) {
    const client = {
      workoutPlan: {
        findUnique: jest.fn().mockResolvedValue(
          opts.plan === undefined
            ? { id: 'wp-1', is_active: true, exercises: [], created_by: null }
            : opts.plan,
        ),
      },
      member: { findFirst: jest.fn().mockResolvedValue(opts.member === undefined ? { id: 'm-1' } : opts.member) },
      assignedWorkout: {
        findMany: jest.fn().mockResolvedValue(opts.existing ?? []),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return { service: new WorkoutPlansService({ client } as any), client };
  }

  it('creates one AssignedWorkout per new date and skips already-scheduled dates', async () => {
    const { service, client } = makeService({
      existing: [{ scheduled_date: new Date('2026-07-20T00:00:00Z') }],
    });
    const result = await run(() =>
      service.assign('wp-1', { member_id: 'm-1', dates: ['2026-07-20', '2026-07-22'] }, 'staff-1'),
    );
    expect(result).toEqual({ assigned: 1, skipped_existing: 1 });
    const rows = (client.assignedWorkout.createMany as jest.Mock).mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      gym_id: GYM,
      member_id: 'm-1',
      workout_plan_id: 'wp-1',
      assigned_by_staff_id: 'staff-1',
    });
  });

  it('rejects assigning an inactive plan', async () => {
    const { service } = makeService({ plan: { id: 'wp-1', is_active: false, exercises: [], created_by: null } });
    await expect(
      run(() => service.assign('wp-1', { member_id: 'm-1', dates: ['2026-07-20'] }, null)),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown member (tenant-scoped lookup)', async () => {
    const { service } = makeService({ member: null });
    await expect(
      run(() => service.assign('wp-1', { member_id: 'ghost', dates: ['2026-07-20'] }, null)),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('DietPlansService.assign', () => {
  function makeService() {
    const tx = {
      assignedDietPlan: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'adp-1' }),
      },
    };
    const client = {
      dietPlan: {
        findUnique: jest.fn().mockResolvedValue({ id: 'dp-1', is_active: true, meals: [], created_by: null }),
      },
      member: { findFirst: jest.fn().mockResolvedValue({ id: 'm-1' }) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    return { service: new DietPlansService({ client } as any), client, tx };
  }

  it('cancels the previous active plan then creates the new assignment (latest wins)', async () => {
    const { service, tx } = makeService();
    await run(() =>
      service.assign('dp-1', { member_id: 'm-1', starts_on: '2026-07-17', notes: 'cut phase' }, 'staff-9'),
    );
    expect(tx.assignedDietPlan.updateMany).toHaveBeenCalledWith({
      where: { member_id: 'm-1', status: 'active' },
      data: { status: 'cancelled' },
    });
    expect(tx.assignedDietPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gym_id: GYM,
          member_id: 'm-1',
          diet_plan_id: 'dp-1',
          assigned_by_staff_id: 'staff-9',
          notes: 'cut phase',
        }),
      }),
    );
  });

  it('rejects ends_on before starts_on', async () => {
    const { service } = makeService();
    await expect(
      run(() =>
        service.assign('dp-1', { member_id: 'm-1', starts_on: '2026-07-17', ends_on: '2026-07-01' }, null),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
