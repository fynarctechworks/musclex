import { CampaignSenderService } from '../../src/marketing/campaign-sender.service';
import { tenantContext } from '../../src/common/tenant-context';

describe('CampaignSenderService', () => {
  const GYM = '22222222-2222-2222-2222-222222222222';

  const members = [
    { id: 'm-1', full_name: 'Asha Rao', phone: '9876543210', email: 'asha@example.com', member_code: 'MB-001' },
    { id: 'm-2', full_name: 'Vikram Singh', phone: null, email: 'vik@example.com', member_code: 'MB-002' },
    { id: 'm-3', full_name: 'No Contact', phone: null, email: null, member_code: 'MB-003' },
  ];

  function makeService(campaign: any, consents: any[] = []) {
    const audience = members.map((m, i) => ({ id: `aud-${i}`, member: m }));
    const client = {
      campaign: {
        findUnique: jest.fn().mockResolvedValue(campaign),
        update: jest.fn().mockResolvedValue({}),
      },
      campaignAudience: {
        findMany: jest.fn().mockResolvedValue(audience),
        update: jest.fn().mockResolvedValue({}),
      },
      // Marketing-consent gate. Rows are returned newest-first, matching the
      // service's orderBy — the first row per (member, type) is current.
      consentLog: { findMany: jest.fn().mockResolvedValue(consents) },
    };
    const whatsapp = { sendText: jest.fn().mockResolvedValue({ id: 'wamid.x', delivered: true }) } as any;
    const email = { sendRaw: jest.fn().mockResolvedValue({ id: 'em.x', delivered: true }) } as any;
    const queue = { enqueueNotification: jest.fn().mockResolvedValue({ id: 'job', queued: true }) } as any;
    const push = { sendToMember: jest.fn().mockResolvedValue(1) } as any;
    const service = new CampaignSenderService({ client } as any, whatsapp, email, queue, push);
    return { service, client, whatsapp, email, queue, push };
  }

  const run = <T>(fn: () => Promise<T>) =>
    tenantContext.run(
      { schemaName: 'studio_test', gymId: GYM, activeBranchId: null, allowedBranchIds: 'ALL', bypassBranchScope: true } as any,
      fn,
    );

  it('renders {{name}} variables and delivers per channel, marking audience rows', async () => {
    const { service, client, whatsapp, email } = makeService({
      id: 'c-1',
      name: 'Diwali Offer',
      channels: ['whatsapp', 'email'],
      message_template: 'Hi {{first_name}}, 20% off this week!',
    });

    const result = await run(() => service.dispatch('c-1'));

    // m-1: whatsapp + email; m-2: email only; m-3: nothing deliverable
    expect(whatsapp.sendText).toHaveBeenCalledTimes(1);
    expect(whatsapp.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ to: '9876543210', text: 'Hi Asha, 20% off this week!', memberId: 'm-1' }),
    );
    expect(email.sendRaw).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ sent: 2, failed: 0, skipped: 1 });

    // Audience bookkeeping: 2 sent, 1 bounced
    const statuses = (client.campaignAudience.update as jest.Mock).mock.calls.map(
      (c) => c[0].data.status,
    );
    expect(statuses.filter((s) => s === 'sent')).toHaveLength(2);
    expect(statuses.filter((s) => s === 'bounced')).toHaveLength(1);

    // Campaign closed out with the real delivered count
    expect(client.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c-1' },
      data: { status: 'sent', delivered_count: 2 },
    });
  });

  it('returns zeros when the campaign does not exist', async () => {
    const { service } = makeService(null);
    const result = await run(() => service.dispatch('missing'));
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 0 });
  });

  // ── Marketing consent ────────────────────────────────────────────────
  // ConsentLog was written by the compliance module and read by nobody, so a
  // member who revoked marketing WhatsApp kept receiving bulk campaigns.

  it('does not message a member who revoked that channel', async () => {
    const { service, whatsapp } = makeService(
      {
        id: 'c-1',
        name: 'Diwali Offer',
        channels: ['whatsapp'],
        message_template: 'Hi {{first_name}}!',
      },
      [{ member_id: 'm-1', consent_type: 'marketing_whatsapp', granted: false }],
    );

    await run(() => service.dispatch('c-1'));

    // m-1 revoked; m-2/m-3 have no phone, so nothing should go out at all.
    expect(whatsapp.sendText).not.toHaveBeenCalled();
  });

  it('records an opted-out member distinctly from a delivery failure', async () => {
    const { service, client } = makeService(
      {
        id: 'c-1',
        name: 'Diwali Offer',
        channels: ['whatsapp'],
        message_template: 'Hi!',
      },
      [{ member_id: 'm-1', consent_type: 'marketing_whatsapp', granted: false }],
    );

    await run(() => service.dispatch('c-1'));

    const byId = (client.campaignAudience.update as jest.Mock).mock.calls.reduce<
      Record<string, string>
    >((acc, c) => {
      acc[c[0].where.id] = c[0].data.status;
      return acc;
    }, {});
    expect(byId['aud-0']).toBe('opted_out');
    // m-2 has no phone — that's a delivery problem, not a consent one.
    expect(byId['aud-1']).toBe('bounced');
  });

  it('honours the newest consent row, so a re-grant restores delivery', async () => {
    const { service, whatsapp } = makeService(
      {
        id: 'c-1',
        name: 'Diwali Offer',
        channels: ['whatsapp'],
        message_template: 'Hi {{first_name}}!',
      },
      // Newest first, as the service's orderBy returns them.
      [
        { member_id: 'm-1', consent_type: 'marketing_whatsapp', granted: true },
        { member_id: 'm-1', consent_type: 'marketing_whatsapp', granted: false },
      ],
    );

    await run(() => service.dispatch('c-1'));

    expect(whatsapp.sendText).toHaveBeenCalledTimes(1);
  });

  it('still sends on a channel the member did NOT revoke', async () => {
    const { service, whatsapp, email } = makeService(
      {
        id: 'c-1',
        name: 'Diwali Offer',
        channels: ['whatsapp', 'email'],
        message_template: 'Hi!',
      },
      [{ member_id: 'm-1', consent_type: 'marketing_whatsapp', granted: false }],
    );

    await run(() => service.dispatch('c-1'));

    expect(whatsapp.sendText).not.toHaveBeenCalled();
    // m-1 (email still consented) + m-2 (no consent record at all)
    expect(email.sendRaw).toHaveBeenCalledTimes(2);
  });

  it('sends when no consent record exists (opt-out model, not opt-in)', async () => {
    const { service, whatsapp } = makeService(
      {
        id: 'c-1',
        name: 'Diwali Offer',
        channels: ['whatsapp'],
        message_template: 'Hi!',
      },
      [],
    );

    await run(() => service.dispatch('c-1'));

    expect(whatsapp.sendText).toHaveBeenCalledTimes(1);
  });
});
