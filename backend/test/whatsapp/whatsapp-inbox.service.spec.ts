import { WhatsAppInboxService } from '../../src/whatsapp/whatsapp-inbox.service';
import { tenantContext } from '../../src/common/tenant-context';

describe('WhatsAppInboxService', () => {
  const GYM = '99999999-9999-9999-9999-999999999999';
  const PNID = 'pnid-routed';

  function makeService(opts: {
    indexed?: boolean;
    existingByWamid?: boolean;
    member?: { id: string } | null;
    integrationConfig?: Record<string, unknown> | null;
    env?: Record<string, string | undefined>;
    recentAutoReply?: boolean;
  } = {}) {
    const pub = {
      whatsAppNumberIndex: {
        findUnique: jest.fn().mockResolvedValue(
          opts.indexed === false ? null : { phone_number_id: PNID, gym_id: GYM, schema_name: 'studio_x' },
        ),
      },
    } as any;
    const client = {
      whatsAppMessage: {
        findFirst: jest.fn().mockResolvedValue(opts.existingByWamid ? { id: 'wm-1' } : null),
        create: jest.fn().mockResolvedValue({ id: 'wm-new' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      notificationLog: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(opts.recentAutoReply ? { id: 'nl-1' } : null),
      },
      member: {
        findFirst: jest.fn().mockResolvedValue(opts.member === undefined ? { id: 'm-1' } : opts.member),
        findMany: jest.fn().mockResolvedValue([]),
      },
      integration: {
        findFirst: jest.fn().mockResolvedValue(
          opts.integrationConfig === null ? null : { config: opts.integrationConfig ?? {} },
        ),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const tasks = {
      runForGym: jest.fn((_g: string, fn: () => Promise<any>) =>
        tenantContext.run(
          { schemaName: 'studio_x', gymId: GYM, activeBranchId: null, allowedBranchIds: 'ALL', bypassBranchScope: true } as any,
          fn,
        ),
      ),
    } as any;
    const config = { get: jest.fn((k: string) => opts.env?.[k]) } as any;
    const whatsapp = { sendText: jest.fn().mockResolvedValue({ id: 'wamid.reply', delivered: true }) } as any;
    const service = new WhatsAppInboxService(pub, { client } as any, tasks, config, whatsapp);
    return { service, client, whatsapp, tasks, pub };
  }

  const inbound = { from: '919876543210', id: 'wamid.in1', type: 'text', text: { body: 'Hi, timings?' } };

  it('stores an inbound message with the member matched by phone', async () => {
    const { service, client } = makeService({ integrationConfig: {} });
    await service.handleInbound(PNID, inbound);
    expect(client.whatsAppMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gym_id: GYM,
        member_id: 'm-1',
        phone: '919876543210',
        direction: 'inbound',
        body: 'Hi, timings?',
        wa_message_id: 'wamid.in1',
        status: 'received',
      }),
    });
  });

  it('is idempotent on the Meta message id (webhook retries)', async () => {
    const { service, client } = makeService({ existingByWamid: true });
    await service.handleInbound(PNID, inbound);
    expect(client.whatsAppMessage.create).not.toHaveBeenCalled();
  });

  it('drops messages for unrouted numbers without writing anything', async () => {
    const { service, client } = makeService({ indexed: false });
    await service.handleInbound('pnid-unknown', inbound);
    expect(client.whatsAppMessage.create).not.toHaveBeenCalled();
  });

  it('auto-replies using the per-gym Integration text', async () => {
    const { service, whatsapp } = makeService({
      integrationConfig: { auto_reply_message: 'We open 6am-10pm!' },
    });
    await service.handleInbound(PNID, inbound);
    expect(whatsapp.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ to: '919876543210', text: 'We open 6am-10pm!', triggerType: 'auto_reply' }),
    );
  });

  it('suppresses auto-reply when one went out within the hour', async () => {
    const { service, whatsapp } = makeService({
      integrationConfig: { auto_reply_message: 'We open 6am-10pm!' },
      recentAutoReply: true,
    });
    await service.handleInbound(PNID, inbound);
    expect(whatsapp.sendText).not.toHaveBeenCalled();
  });

  it('applies delivery-status updates to inbox rows and NotificationLog', async () => {
    const { service, client } = makeService({});
    await service.handleStatus(PNID, { id: 'wamid.out1', status: 'read' });
    expect(client.whatsAppMessage.updateMany).toHaveBeenCalledWith({
      where: { wa_message_id: 'wamid.out1' },
      data: { status: 'read' },
    });
    expect(client.notificationLog.updateMany).toHaveBeenCalledWith({
      where: { external_message_id: 'wamid.out1' },
      data: { status: 'read' },
    });
  });

  it('resolves the env-global fallback gym when the phone_number_id matches env', async () => {
    const { service } = makeService({
      indexed: false,
      env: { WHATSAPP_PHONE_NUMBER_ID: 'pnid-env', WHATSAPP_INBOX_GYM_ID: GYM },
    });
    expect(await service.resolveGymForNumber('pnid-env')).toBe(GYM);
    expect(await service.resolveGymForNumber('pnid-other')).toBeNull();
  });

  it('reply() sends via the gym sender and reports failure when unconfigured', async () => {
    const { service, whatsapp } = makeService({});
    const run = <T>(fn: () => Promise<T>) =>
      tenantContext.run(
        { schemaName: 'studio_x', gymId: GYM, activeBranchId: null, allowedBranchIds: 'ALL', bypassBranchScope: true } as any,
        fn,
      );
    const ok = await run(() => service.reply('+91 98765 43210', 'We open at 6!'));
    expect(ok).toEqual({ delivered: true, message_id: 'wamid.reply' });
    expect(whatsapp.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ to: '919876543210', memberId: 'm-1', triggerType: 'inbox_reply' }),
    );

    (whatsapp.sendText as jest.Mock).mockResolvedValue({ delivered: false });
    await expect(run(() => service.reply('9876543210', 'x'))).rejects.toThrow('not configured');
  });
});
