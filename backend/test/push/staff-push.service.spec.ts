import { StaffPushService } from '../../src/push/staff-push.service';

/**
 * Staff push tokens live in `public`, outside the Prisma gym_id injection, so
 * every property that keeps one gym's alerts away from another gym's staff has
 * to be asserted here rather than assumed from the middleware.
 */
describe('StaffPushService', () => {
  const GYM_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const GYM_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const USER = '11111111-1111-1111-1111-111111111111';

  function makeService(rows: Array<{ token: string }> = []) {
    const staffDeviceToken = {
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: rows.length }),
      findMany: jest.fn().mockResolvedValue(rows),
    };
    const service = new StaffPushService({ staffDeviceToken } as any);
    return { service, staffDeviceToken };
  }

  afterEach(() => jest.restoreAllMocks());

  describe('register', () => {
    it('upserts on (token, gym) so one handset is one row per gym', async () => {
      const { service, staffDeviceToken } = makeService();
      await service.register({ userId: USER, gymId: GYM_A, token: 'ExponentPushToken[a]', platform: 'ios' });

      expect(staffDeviceToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { token_gym_id: { token: 'ExponentPushToken[a]', gym_id: GYM_A } },
        }),
      );
    });

    it('takes the handset away from any previous owner, in every gym', async () => {
      const { service, staffDeviceToken } = makeService();
      await service.register({ userId: USER, gymId: GYM_A, token: 'ExponentPushToken[a]', platform: 'ios' });

      expect(staffDeviceToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'ExponentPushToken[a]', user_id: { not: USER } },
      });
    });

    it('refuses to register without a studio context', async () => {
      const { service, staffDeviceToken } = makeService();
      await expect(
        service.register({ userId: USER, gymId: '', token: 'ExponentPushToken[a]', platform: 'ios' }),
      ).resolves.toEqual({ registered: false });
      expect(staffDeviceToken.upsert).not.toHaveBeenCalled();
    });
  });

  describe('unregister', () => {
    it('clears the token across every gym, scoped to the owning user', async () => {
      const { service, staffDeviceToken } = makeService([{ token: 'x' }]);
      await service.unregister(USER, 'ExponentPushToken[a]');

      expect(staffDeviceToken.deleteMany).toHaveBeenCalledWith({
        where: { user_id: USER, token: 'ExponentPushToken[a]' },
      });
    });

    it('cannot be used to unregister someone else’s device', async () => {
      const { service, staffDeviceToken } = makeService();
      await service.unregister(USER, 'ExponentPushToken[someone-else]');
      const where = staffDeviceToken.deleteMany.mock.calls[0][0].where;
      expect(where.user_id).toBe(USER);
    });
  });

  describe('sendToStaff', () => {
    it('always filters by gym — this table is outside the gym_id injection', async () => {
      const { service, staffDeviceToken } = makeService([{ token: 'ExponentPushToken[a]' }]);
      jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ status: 'ok' }] }),
      } as any);

      await service.sendToStaff(GYM_A, [USER], { title: 'Overdue', body: '3 dues' });

      expect(staffDeviceToken.findMany).toHaveBeenCalledWith({
        where: { gym_id: GYM_A, user_id: { in: [USER] } },
        select: { token: true },
      });
    });

    it('sends nothing when no gym is supplied', async () => {
      const { service, staffDeviceToken } = makeService([{ token: 'ExponentPushToken[a]' }]);
      await expect(service.sendToStaff('', [USER], { title: 'x', body: 'y' })).resolves.toBe(0);
      expect(staffDeviceToken.findMany).not.toHaveBeenCalled();
    });

    it('reports 0 rather than faking delivery when nobody has a device', async () => {
      const { service } = makeService([]);
      const fetchMock = jest.spyOn(global, 'fetch' as any);
      await expect(service.sendToStaff(GYM_A, [USER], { title: 'x', body: 'y' })).resolves.toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('prunes tokens Expo reports as DeviceNotRegistered, scoped to the gym', async () => {
      const { service, staffDeviceToken } = makeService([
        { token: 'ExponentPushToken[live]' },
        { token: 'ExponentPushToken[dead]' },
      ]);
      jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }],
        }),
      } as any);

      const sent = await service.sendToStaff(GYM_A, [USER], { title: 'x', body: 'y' });

      expect(sent).toBe(1);
      expect(staffDeviceToken.deleteMany).toHaveBeenCalledWith({
        where: { gym_id: GYM_A, token: { in: ['ExponentPushToken[dead]'] } },
      });
    });

    it('keeps a token when the error is transient, not DeviceNotRegistered', async () => {
      const { service, staffDeviceToken } = makeService([{ token: 'ExponentPushToken[a]' }]);
      jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ status: 'error', details: { error: 'MessageRateExceeded' } }] }),
      } as any);

      await service.sendToStaff(GYM_A, [USER], { title: 'x', body: 'y' });
      expect(staffDeviceToken.deleteMany).not.toHaveBeenCalled();
    });

    it('does not reach another gym’s staff', async () => {
      const { service, staffDeviceToken } = makeService([]);
      await service.sendToStaff(GYM_B, [USER], { title: 'x', body: 'y' });
      expect(staffDeviceToken.findMany.mock.calls[0][0].where.gym_id).toBe(GYM_B);
    });
  });
});
