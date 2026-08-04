import { WhatsAppService } from '../../src/whatsapp/whatsapp.service';
import { WhatsAppProvider, WhatsAppSendResult } from '../../src/whatsapp/whatsapp-provider.interface';
import { tenantContext } from '../../src/common/tenant-context';

describe('WhatsAppService', () => {
  const GYM = '11111111-1111-1111-1111-111111111111';

  function makeProvider(overrides: Partial<Record<keyof WhatsAppProvider, any>> = {}): WhatsAppProvider {
    return {
      name: 'test',
      sendText: jest.fn().mockResolvedValue({ id: 'wamid.1', delivered: true } satisfies WhatsAppSendResult),
      sendTemplate: jest.fn().mockResolvedValue({ id: 'wamid.2', delivered: true }),
      sendDocument: jest.fn().mockResolvedValue({ id: 'wamid.3', delivered: true }),
      ...overrides,
    } as WhatsAppProvider;
  }

  function makeService(opts: {
    provider?: WhatsAppProvider;
    env?: Record<string, string | undefined>;
    integration?: any;
  }) {
    const provider = opts.provider ?? makeProvider();
    const config = {
      get: jest.fn((key: string) => opts.env?.[key]),
    } as any;
    const notificationLogCreate = jest.fn().mockResolvedValue({});
    const tenant = {
      client: {
        integration: { findFirst: jest.fn().mockResolvedValue(opts.integration ?? null) },
        notificationLog: { create: notificationLogCreate },
      },
    } as any;
    const tasks = {
      runForGym: jest.fn(async (_gymId: string, fn: () => Promise<any>) =>
        tenantContext.run(
          {
            schemaName: 'studio_test',
            gymId: GYM,
            activeBranchId: null,
            allowedBranchIds: 'ALL',
            bypassBranchScope: true,
          } as any,
          fn,
        ),
      ),
    } as any;
    const service = new WhatsAppService(provider, config, tenant, tasks);
    return { service, provider, tenant, tasks, notificationLogCreate };
  }

  const inTenantCtx = <T>(fn: () => Promise<T>): Promise<T> =>
    tenantContext.run(
      {
        schemaName: 'studio_test',
        gymId: GYM,
        activeBranchId: null,
        allowedBranchIds: 'ALL',
        bypassBranchScope: true,
      } as any,
      fn,
    );

  it('skips (delivered:false) when nothing is configured', async () => {
    const { service, provider } = makeService({});
    const result = await service.sendText({ to: '9876543210', text: 'hi' });
    expect(result.delivered).toBe(false);
    expect(provider.sendText).not.toHaveBeenCalled();
  });

  it('uses env credentials as fallback and normalizes a 10-digit phone to +91', async () => {
    const { service, provider } = makeService({
      env: { WHATSAPP_ACCESS_TOKEN: 'tok', WHATSAPP_PHONE_NUMBER_ID: 'pnid' },
    });
    const result = await service.sendText({ to: '98765 43210', text: 'hello' });
    expect(result).toEqual({ id: 'wamid.1', delivered: true });
    expect(provider.sendText).toHaveBeenCalledWith(
      { phoneNumberId: 'pnid', accessToken: 'tok' },
      { to: '919876543210', text: 'hello' },
    );
  });

  it('prefers the gym Integration credentials over env inside a tenant context', async () => {
    const { service, provider } = makeService({
      env: { WHATSAPP_ACCESS_TOKEN: 'env-tok', WHATSAPP_PHONE_NUMBER_ID: 'env-pnid' },
      integration: {
        config: { phone_number_id: 'gym-pnid', access_token: 'gym-tok' },
      },
    });
    await inTenantCtx(() => service.sendText({ to: '+91 90000 00001', text: 'yo' }));
    expect(provider.sendText).toHaveBeenCalledWith(
      { phoneNumberId: 'gym-pnid', accessToken: 'gym-tok' },
      { to: '919000000001', text: 'yo' },
    );
  });

  it('writes a NotificationLog audit row when sending inside a tenant context', async () => {
    const { service, notificationLogCreate } = makeService({
      env: { WHATSAPP_ACCESS_TOKEN: 'tok', WHATSAPP_PHONE_NUMBER_ID: 'pnid' },
    });
    await inTenantCtx(() =>
      service.sendText({ to: '9876543210', text: 'renewal reminder', memberId: 'm-1', triggerType: 'automation:birthday' }),
    );
    expect(notificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gym_id: GYM,
        member_id: 'm-1',
        channel: 'whatsapp',
        trigger_type: 'automation:birthday',
        status: 'sent',
        external_message_id: 'wamid.1',
      }),
    });
  });

  it('establishes the gym context via runForGym when given a gymId outside a request', async () => {
    const { service, tasks, provider } = makeService({
      integration: { config: { phone_number_id: 'gym-pnid', access_token: 'gym-tok' } },
    });
    await service.sendText({ to: '9876543210', text: 'queued send', gymId: GYM });
    expect(tasks.runForGym).toHaveBeenCalledWith(GYM, expect.any(Function));
    expect(provider.sendText).toHaveBeenCalledWith(
      { phoneNumberId: 'gym-pnid', accessToken: 'gym-tok' },
      expect.anything(),
    );
  });

  it('propagates provider failures (so BullMQ can retry)', async () => {
    const provider = makeProvider({
      sendText: jest.fn().mockRejectedValue(new Error('WhatsApp API error: 500')),
    });
    const { service } = makeService({
      provider,
      env: { WHATSAPP_ACCESS_TOKEN: 'tok', WHATSAPP_PHONE_NUMBER_ID: 'pnid' },
    });
    await expect(service.sendText({ to: '9876543210', text: 'x' })).rejects.toThrow('WhatsApp API error');
  });

  it('sends documents through the same credential resolution', async () => {
    const { service, provider } = makeService({
      env: { WHATSAPP_ACCESS_TOKEN: 'tok', WHATSAPP_PHONE_NUMBER_ID: 'pnid' },
    });
    await service.sendDocument({
      to: '9876543210',
      documentUrl: 'https://signed.example/invoice.pdf',
      filename: 'INV-1.pdf',
      caption: 'Invoice INV-1',
    });
    expect(provider.sendDocument).toHaveBeenCalledWith(
      { phoneNumberId: 'pnid', accessToken: 'tok' },
      {
        to: '919876543210',
        documentUrl: 'https://signed.example/invoice.pdf',
        filename: 'INV-1.pdf',
        caption: 'Invoice INV-1',
      },
    );
  });
});
