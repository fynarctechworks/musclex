import { MemberPersonalService } from './member-personal.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * These tables have NO gym_id, so the tenant injection cannot help here — the
 * only thing standing between two members' routines is that every query filters
 * on the appUserId from the TOKEN. That makes these the isolation tests for the
 * whole gym-less surface.
 */
describe('MemberPersonalService', () => {
  const me: CurrentMemberContext = {
    appUserId: 'au-me', memberId: '', tenantId: '', isGymMember: false,
  };

  let pub: any;
  let service: MemberPersonalService;

  beforeEach(() => {
    pub = {
      appUserExercise: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'e1', ...data })),
      },
      appUserRoutine: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      appUserRoutineExercise: { deleteMany: jest.fn(), createMany: jest.fn() },
      appUserMealLog: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'm1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(async (fn: any) => fn(pub)),
    };
    service = new MemberPersonalService(pub as any);
  });

  describe('works without a gym at all', () => {
    it('needs no memberId or tenantId', async () => {
      await expect(service.routines(me)).resolves.toBeDefined();
      await expect(service.exercises(me)).resolves.toBeDefined();
      await expect(service.meals(me)).resolves.toBeDefined();
    });
  });

  describe('the cross-user gate', () => {
    it('lists only the token holder\'s routines', async () => {
      await service.routines(me);
      expect(pub.appUserRoutine.findMany.mock.calls[0][0].where).toEqual({ app_user_id: 'au-me' });
    });

    it('reads one routine by id AND owner, never id alone', async () => {
      await expect(service.routine(me, 'r-someone-else')).rejects.toThrow();
      expect(pub.appUserRoutine.findFirst.mock.calls[0][0].where).toEqual({
        id: 'r-someone-else', app_user_id: 'au-me',
      });
    });

    it('answers not-found for a routine that is not yours', async () => {
      // Same answer as genuinely missing, so a 403 cannot confirm an id exists.
      await expect(service.routine(me, 'r-x')).rejects.toMatchObject({ status: 404 });
    });

    it('scopes deletes by owner, so a stolen id deletes nothing', async () => {
      await expect(service.deleteRoutine(me, 'r-x')).rejects.toThrow();
      expect(pub.appUserRoutine.deleteMany.mock.calls[0][0].where).toEqual({
        id: 'r-x', app_user_id: 'au-me',
      });
    });

    it('proves ownership before writing an update', async () => {
      await expect(service.updateRoutine(me, 'r-x', { name: 'Mine now' })).rejects.toThrow();
      expect(pub.appUserRoutine.update).not.toHaveBeenCalled();
    });

    it('shows global exercises plus only your own', async () => {
      await service.exercises(me);
      expect(pub.appUserExercise.findMany.mock.calls[0][0].where.OR).toEqual([
        { app_user_id: null }, { app_user_id: 'au-me' },
      ]);
    });

    it('never lets a personal exercise be created for someone else', async () => {
      const made = await service.createExercise({ ...me, appUserId: 'au-me' }, { name: 'Mine' });
      expect((made as any).app_user_id).toBe('au-me');
    });

    it('refuses an exercise id the member may not reference', async () => {
      // The subtle attack: put another member's private exercise in YOUR
      // routine, then read its name back out of your own data.
      pub.appUserExercise.findMany.mockResolvedValue([]);
      await expect(
        service.createRoutine(me, { name: 'Probe', exercises: [{ exerciseId: 'someone-elses' }] }),
      ).rejects.toThrow();
      expect(pub.appUserRoutine.create).not.toHaveBeenCalled();
    });

    it('scopes meal reads and deletes to the token holder', async () => {
      await service.meals(me);
      expect(pub.appUserMealLog.findMany.mock.calls[0][0].where.app_user_id).toBe('au-me');
      await expect(service.deleteMeal(me, 'm-x')).rejects.toThrow();
      expect(pub.appUserMealLog.deleteMany.mock.calls[0][0].where).toEqual({
        id: 'm-x', app_user_id: 'au-me',
      });
    });
  });

  describe('meals', () => {
    it('refuses a meal with no items', async () => {
      await expect(service.logMeal(me, { items: [] })).rejects.toThrow();
    });

    it('treats a repeated outbox key as the same meal, per person', async () => {
      pub.appUserMealLog.findFirst.mockResolvedValue({ id: 'm-existing', items: [] });
      const res = await service.logMeal(me, { clientKey: 'k1', items: [{ name: 'Banana' }] });
      expect(res).toEqual({ id: 'm-existing', duplicate: true });
      expect(pub.appUserMealLog.create).not.toHaveBeenCalled();
      // Scoped to the person, so two members cannot collide on one key.
      expect(pub.appUserMealLog.findFirst.mock.calls[0][0].where.app_user_id).toBe('au-me');
    });

    it('caps how many items one meal may carry', async () => {
      const many = Array.from({ length: 200 }, (_, i) => ({ name: `Item ${i}` }));
      await service.logMeal(me, { items: many });
      expect(pub.appUserMealLog.create.mock.calls[0][0].data.items.create.length).toBeLessThanOrEqual(50);
    });

    it('does not let a negative quantity subtract calories', async () => {
      await service.logMeal(me, { items: [{ name: 'X', kcal: -500, quantity: -3 }] });
      const item = pub.appUserMealLog.create.mock.calls[0][0].data.items.create[0];
      expect(item.kcal).toBe(0);
      expect(item.quantity).toBe(1);
    });
  });

  describe('routines', () => {
    it('refuses a routine with no name', async () => {
      await expect(service.createRoutine(me, { name: '   ' })).rejects.toThrow();
    });

    it('caps how many exercises a routine may hold', async () => {
      pub.appUserExercise.findMany.mockResolvedValue(
        Array.from({ length: 200 }, (_, i) => ({ id: `e${i}` })),
      );
      pub.appUserRoutine.create.mockResolvedValue({
        id: 'r1', name: 'Big', notes: null, updated_at: new Date(), exercises: [],
      });
      await service.createRoutine(me, {
        name: 'Big',
        exercises: Array.from({ length: 200 }, (_, i) => ({ exerciseId: `e${i}` })),
      });
      expect(pub.appUserRoutine.create.mock.calls[0][0].data.exercises.create.length)
        .toBeLessThanOrEqual(60);
    });

    it('numbers positions from the order given', async () => {
      pub.appUserExercise.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      pub.appUserRoutine.create.mockResolvedValue({
        id: 'r1', name: 'X', notes: null, updated_at: new Date(), exercises: [],
      });
      await service.createRoutine(me, {
        name: 'X', exercises: [{ exerciseId: 'b' }, { exerciseId: 'a' }],
      });
      const created = pub.appUserRoutine.create.mock.calls[0][0].data.exercises.create;
      expect(created.map((c: any) => [c.exercise_id, c.position])).toEqual([['b', 0], ['a', 1]]);
    });
  });
});
