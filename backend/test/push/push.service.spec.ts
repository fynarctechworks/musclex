import { PushService } from '../../src/push/push.service';
import { tenantContext } from '../../src/common/tenant-context';

describe('PushService', () => {
  const GYM = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  function makeService(tokens: Array<{ token: string; prefs?: Record<string, boolean> }>) {
    const client = {
      memberDeviceToken: {
        findMany: jest.fn().mockResolvedValue(tokens.map((t) => ({ token: t.token, prefs: t.prefs ?? {} }))),
      },
    };
    const tasks = {
      runForGym: jest.fn((_g: string, fn: () => Promise<any>) =>
        tenantContext.run(
          { schemaName: 'studio_x', gymId: GYM, activeBranchId: null, allowedBranchIds: 'ALL', bypassBranchScope: true } as any,
          fn,
        ),
      ),
    } as any;
    const service = new PushService({ client } as any, tasks);
    return { service, client, tasks };
  }

  afterEach(() => jest.restoreAllMocks());

  it('sends to Expo tokens only, honoring category opt-outs', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValue({ ok: true, text: async () => '' } as any);
    const { service } = makeService([
      { token: 'ExponentPushToken[aaa]' },
      { token: 'ExponentPushToken[bbb]', prefs: { promos: false } },
      { token: 'fcm-raw-token' }, // not an Expo token — filtered
    ]);

    const count = await service.sendToMember(
      'm-1',
      { title: 'Offer', body: '20% off' },
      { gymId: GYM, category: 'promos' },
    );

    expect(count).toBe(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as any[])[1].body);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ to: 'ExponentPushToken[aaa]', title: 'Offer', body: '20% off' });
  });

  it('returns 0 (never fakes delivery) when the member has no Expo tokens', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any);
    const { service } = makeService([]);
    const count = await service.sendToMember('m-1', { title: 'x', body: 'y' }, { gymId: GYM });
    expect(count).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drops (0) with neither tenant context nor gymId', async () => {
    const { service, tasks } = makeService([{ token: 'ExponentPushToken[aaa]' }]);
    const count = await service.sendToMember('m-1', { title: 'x', body: 'y' });
    expect(count).toBe(0);
    expect(tasks.runForGym).not.toHaveBeenCalled();
  });

  it('throws on Expo API failure so queued jobs can retry', async () => {
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' } as any);
    const { service } = makeService([{ token: 'ExponentPushToken[aaa]' }]);
    await expect(service.sendToMember('m-1', { title: 'x', body: 'y' }, { gymId: GYM })).rejects.toThrow(
      'Expo push API 500',
    );
  });
});
