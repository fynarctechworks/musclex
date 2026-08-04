import { AutomationDispatcherService } from '../../src/marketing/automation-dispatcher.service';
import { tenantContext } from '../../src/common/tenant-context';

describe('AutomationDispatcherService', () => {
  const GYM = '33333333-3333-3333-3333-333333333333';

  function daysFromToday(days: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d;
  }

  function makeService(opts: {
    workflows?: any[];
    memberships?: any[];
    members?: any[];
    redis?: boolean;
  }) {
    const client = {
      automationWorkflow: { findMany: jest.fn().mockResolvedValue(opts.workflows ?? []) },
      memberMembership: { findMany: jest.fn().mockResolvedValue(opts.memberships ?? []) },
      member: { findMany: jest.fn().mockResolvedValue(opts.members ?? []) },
    };
    const tenant = { client } as any;
    const tasks = {
      runForGym: jest.fn(async (_gym: string, fn: () => Promise<any>) =>
        tenantContext.run(
          { schemaName: 'studio_test', gymId: GYM, activeBranchId: null, allowedBranchIds: 'ALL', bypassBranchScope: true } as any,
          fn,
        ),
      ),
      forEachTenant: jest.fn(),
    } as any;
    const pub = { studio: { findUnique: jest.fn().mockResolvedValue({ name: 'Phani Gym' }) } } as any;
    const cronLock = { withLock: jest.fn((_n: string, fn: () => Promise<void>) => fn()) } as any;
    const queue = {
      isRedisEnabled: opts.redis ?? false,
      enqueueNotification: jest.fn().mockResolvedValue({ id: 'job', queued: true }),
    } as any;
    const whatsapp = { sendText: jest.fn().mockResolvedValue({ id: 'wamid.y', delivered: true }) } as any;
    const email = { sendRaw: jest.fn().mockResolvedValue({ id: 'em.y', delivered: true }) } as any;
    const push = { sendToMember: jest.fn().mockResolvedValue(1) } as any;
    // Only used by the scheduled-campaign cron, which these tests don't drive.
    const marketing = {
      dispatchDueCampaigns: jest.fn().mockResolvedValue({ due: 0, sent: 0, failed: 0 }),
    } as any;

    const service = new AutomationDispatcherService(
      tenant,
      tasks,
      pub,
      cronLock,
      queue,
      whatsapp,
      email,
      push,
      marketing,
    );
    return { service, client, whatsapp, email, queue, tasks, push, marketing };
  }

  const run = <T>(fn: () => Promise<T>) =>
    tenantContext.run(
      { schemaName: 'studio_test', gymId: GYM, activeBranchId: null, allowedBranchIds: 'ALL', bypassBranchScope: true } as any,
      fn,
    );

  const expiryWorkflow = {
    id: 'wf-1',
    workflow_name: 'Expiry reminder',
    trigger_event: 'membership_expiring',
    trigger_config: { days_before_expiry: 3 },
    actions: [
      { id: 'a-1', action_type: 'send_whatsapp', delay_minutes: 0, action_config: null, template: null },
    ],
  };

  it('sends a WhatsApp reminder for memberships expiring in exactly N days (direct send without Redis)', async () => {
    const { service, whatsapp, client } = makeService({
      workflows: [expiryWorkflow],
      memberships: [
        {
          end_date: daysFromToday(3),
          member: { id: 'm-1', full_name: 'Asha Rao', phone: '9876543210', email: null, status: 'active' },
          plan: { name: 'Gold Quarterly' },
        },
        {
          end_date: daysFromToday(3),
          member: { id: 'm-2', full_name: 'Inactive Ivan', phone: '9876500000', email: null, status: 'inactive' },
          plan: { name: 'Gold Quarterly' },
        },
      ],
    });

    await run(() => (service as any).fireMembershipExpiring());

    // Query used the exact-day window
    const where = (client.memberMembership.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.status).toBe('active');
    expect(where.end_date.gte).toEqual(daysFromToday(3));
    expect(where.end_date.lt).toEqual(daysFromToday(4));

    // Only the active member got a message; default template rendered
    expect(whatsapp.sendText).toHaveBeenCalledTimes(1);
    const call = (whatsapp.sendText as jest.Mock).mock.calls[0][0];
    expect(call.to).toBe('9876543210');
    expect(call.text).toContain('Asha Rao');
    expect(call.text).toContain('Gold Quarterly');
    expect(call.text).toContain('Phani Gym');
    expect(call.triggerType).toBe('automation:membership_expiring');
  });

  it('queues instead of direct-sending when Redis is enabled (honoring delay_minutes)', async () => {
    const delayed = {
      ...expiryWorkflow,
      actions: [{ id: 'a-2', action_type: 'send_whatsapp', delay_minutes: 30, action_config: null, template: null }],
    };
    const { service, whatsapp, queue } = makeService({
      workflows: [delayed],
      memberships: [
        {
          end_date: daysFromToday(3),
          member: { id: 'm-1', full_name: 'Asha', phone: '9876543210', email: null, status: 'active' },
          plan: { name: 'Gold' },
        },
      ],
      redis: true,
    });

    await run(() => (service as any).fireMembershipExpiring());

    expect(whatsapp.sendText).not.toHaveBeenCalled();
    expect(queue.enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'whatsapp', to: '9876543210', gymId: GYM }),
      { delay: 30 * 60_000 },
    );
  });

  it('fires birthday wishes only for members whose DOB is today', async () => {
    const today = new Date();
    const dobToday = new Date(Date.UTC(1990, today.getUTCMonth(), today.getUTCDate()));
    const dobOther = new Date(Date.UTC(1990, (today.getUTCMonth() + 1) % 12, 15));
    const { service, whatsapp } = makeService({
      workflows: [
        {
          id: 'wf-b',
          workflow_name: 'Birthday',
          trigger_event: 'birthday',
          trigger_config: null,
          actions: [{ id: 'a-3', action_type: 'send_whatsapp', delay_minutes: 0, action_config: null, template: null }],
        },
      ],
      members: [
        { id: 'm-1', full_name: 'Birthday Bee', phone: '9876543210', email: null, date_of_birth: dobToday },
        { id: 'm-2', full_name: 'Not Today', phone: '9876500000', email: null, date_of_birth: dobOther },
      ],
    });

    await run(() => (service as any).fireBirthdays());

    expect(whatsapp.sendText).toHaveBeenCalledTimes(1);
    expect((whatsapp.sendText as jest.Mock).mock.calls[0][0].to).toBe('9876543210');
    expect((whatsapp.sendText as jest.Mock).mock.calls[0][0].text).toContain('Birthday Bee');
  });

  it('runs lead_created workflows through runForGym on the event payload', async () => {
    const { service, whatsapp, tasks } = makeService({
      workflows: [
        {
          id: 'wf-l',
          workflow_name: 'Lead welcome',
          trigger_event: 'lead_created',
          trigger_config: null,
          actions: [{ id: 'a-4', action_type: 'send_whatsapp', delay_minutes: 0, action_config: null, template: null }],
        },
      ],
    });

    await service.onLeadCreated({
      gymId: GYM,
      leadId: 'lead-1',
      fullName: 'Curious Prospect',
      phone: '9998887776',
      email: null,
    });

    expect(tasks.runForGym).toHaveBeenCalledWith(GYM, expect.any(Function));
    expect(whatsapp.sendText).toHaveBeenCalledTimes(1);
    expect((whatsapp.sendText as jest.Mock).mock.calls[0][0].text).toContain('Curious Prospect');
  });
});
