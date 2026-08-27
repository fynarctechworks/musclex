import { MemberWorkoutService } from './member-workout.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * Workout service: the cross-member gate (a member only ever logs against their
 * OWN assigned workout) and PR detection. Mirrors member-data.service.spec's
 * approach — capture the Prisma `where` clauses and assert member_id is applied.
 */
describe('MemberWorkoutService', () => {
  const memberA: CurrentMemberContext = { appUserId: 'auA', memberId: 'mA', tenantId: 'tA', isGymMember: true };
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
    // Publishing to the friends feed is a no-op here: these tests are about
    // tenant scoping, and the publisher is covered by its own suite.
    const friendPublisher = {
      publishSession: jest.fn().mockResolvedValue(undefined),
      publishPrs: jest.fn().mockResolvedValue(undefined),
    } as any;
    const schedule = { getTodayPlan: jest.fn().mockResolvedValue({ routine: null }) } as any;
    service = new MemberWorkoutService({ client: prisma } as any, friendPublisher, schedule);
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

/**
 * THE HOME CARD'S FALL-THROUGH.
 *
 * getTodaySummary used to read ONLY assigned_workouts, so a member without a
 * trainer had no path to a non-null value and the most prominent card on the
 * home screen said "Nothing assigned today" every day, forever.
 */
describe('getTodaySummary falls through to the member\'s own schedule', () => {
  const MEMBER = { memberId: 'm1', tenantId: 'g1', appUserId: 'a1', isGymMember: true } as any;

  const build = (assignment: unknown, plan: unknown) =>
    new MemberWorkoutService(
      { client: { assignedWorkout: { findFirst: jest.fn().mockResolvedValue(assignment) } } } as any,
      {} as any,
      { getTodayPlan: jest.fn().mockResolvedValue(plan) } as any,
    );

  it('prefers a trainer assignment and marks it as such', async () => {
    const svc = build(
      {
        id: 'a1',
        workout_plan: { title: 'Coach leg day', exercises: [{}, {}] },
        assigned_by: { full_name: 'Priya' },
      },
      { routine: { routineId: 'r1', name: 'Push', exerciseCount: 5 } },
    );
    const s = await svc.getTodaySummary(MEMBER);
    expect(s).toMatchObject({ title: 'Coach leg day', assignedBy: 'Priya', source: 'assigned' });
  });

  it("uses the member's scheduled routine when no trainer assigned one", async () => {
    const svc = build(null, { routine: { routineId: 'r1', name: 'Push', exerciseCount: 5 } });
    const s = await svc.getTodaySummary(MEMBER);
    expect(s).toEqual({
      id: 'r1',
      title: 'Push',
      // Nobody assigned it — the member did. Naming anyone here would be a
      // small lie the card would repeat every day.
      assignedBy: null,
      exerciseCount: 5,
      source: 'routine',
      routineId: 'r1',
    });
  });

  it('is null only when there is genuinely nothing planned', async () => {
    const svc = build(null, { routine: null, restDay: true, unscheduled: false });
    await expect(svc.getTodaySummary(MEMBER)).resolves.toBeNull();
  });
});
