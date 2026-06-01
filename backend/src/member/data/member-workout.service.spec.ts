import { MemberWorkoutService } from './member-workout.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * Workout service: the cross-member gate (a member only ever logs against their
 * OWN assigned workout) and PR detection. Mirrors member-data.service.spec's
 * approach — capture the Prisma `where` clauses and assert member_id is applied.
 */
describe('MemberWorkoutService', () => {
  const memberA: CurrentMemberContext = { memberId: 'mA', tenantId: 'tA' };
  let prisma: any;
  let service: MemberWorkoutService;

  beforeEach(() => {
    prisma = {
      assignedWorkout: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      workoutLog: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'log1' }),
      },
      workoutSetLog: { findFirst: jest.fn().mockResolvedValue(null) },
      personalRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    service = new MemberWorkoutService(prisma);
  });

  it('getTodayWorkout filters the assignment by the authenticated member_id', async () => {
    prisma.assignedWorkout.findFirst.mockResolvedValue(null);
    const result = await service.getTodayWorkout(memberA);
    expect(result).toBeNull();
    expect(prisma.assignedWorkout.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ member_id: 'mA' }),
      }),
    );
  });

  it('logWorkout rejects a workout the member does not own (404, not cross-member)', async () => {
    prisma.assignedWorkout.findFirst.mockResolvedValue(null); // not found for mA
    await expect(
      service.logWorkout(memberA, 'someoneElsesWorkout', [
        { exerciseId: 'e1', reps: 10, weight: 50, unit: 'kg' },
      ]),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect(prisma.assignedWorkout.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'someoneElsesWorkout', member_id: 'mA' },
      }),
    );
  });

  it('logWorkout writes the log with member_id + gym_id and detects a new PR', async () => {
    prisma.assignedWorkout.findFirst.mockResolvedValue({
      id: 'aw1',
      workout_plan_id: 'wp1',
    });

    const result = await service.logWorkout(
      memberA,
      'aw1',
      [{ exerciseId: 'e1', setNumber: 1, reps: 8, weight: 80, unit: 'kg' }],
      'idem-123',
    );

    const createArg = prisma.workoutLog.create.mock.calls[0][0];
    expect(createArg.data.member_id).toBe('mA');
    expect(createArg.data.gym_id).toBe('tA');
    expect(createArg.data.client_key).toBe('idem-123');
    // No prior PR → this becomes a new record.
    expect(prisma.personalRecord.create).toHaveBeenCalled();
    expect(result.newPersonalRecords).toEqual([{ exerciseId: 'e1', weight: 80 }]);
    expect(result.logId).toBe('log1');
  });

  it('logWorkout does NOT report a PR when the new weight is not heavier', async () => {
    prisma.assignedWorkout.findFirst.mockResolvedValue({
      id: 'aw1',
      workout_plan_id: 'wp1',
    });
    prisma.personalRecord.findFirst.mockResolvedValue({ id: 'pr1', weight: '100' });

    const result = await service.logWorkout(memberA, 'aw1', [
      { exerciseId: 'e1', reps: 8, weight: 80, unit: 'kg' },
    ]);

    expect(prisma.personalRecord.create).not.toHaveBeenCalled();
    expect(prisma.personalRecord.update).not.toHaveBeenCalled();
    expect(result.newPersonalRecords).toEqual([]);
  });

  it('logWorkout replays an existing log for a duplicate idempotency key', async () => {
    prisma.assignedWorkout.findFirst.mockResolvedValue({
      id: 'aw1',
      workout_plan_id: 'wp1',
    });
    prisma.workoutLog.findFirst.mockResolvedValue({ id: 'existing-log' });

    const result = await service.logWorkout(
      memberA,
      'aw1',
      [{ exerciseId: 'e1', reps: 8, weight: 80, unit: 'kg' }],
      'dup-key',
    );

    expect(result).toEqual({ logId: 'existing-log', newPersonalRecords: [] });
    expect(prisma.workoutLog.create).not.toHaveBeenCalled();
  });
});
