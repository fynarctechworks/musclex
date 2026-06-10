import { AlertService } from './alert.service';
import { ErrorSeverity } from '@prisma/client';

function makeDeps(emailTo = '') {
  const created: any[] = [];
  const prisma = {
    systemAlert: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `alert-${created.length + 1}`, created_at: new Date(), ...data };
        created.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
      findUnique: jest.fn(async ({ where }: any) => ({ id: where.id, acknowledged: false })),
    },
  } as any;
  const gateway = { emitAlertCritical: jest.fn() } as any;
  const config = { get: jest.fn(() => emailTo) } as any;
  const email = { send: jest.fn(async () => undefined) } as any;
  return { svc: new AlertService(prisma, gateway, config, email), prisma, gateway, email, created };
}

const input = {
  error_id: 'err-1',
  severity: ErrorSeverity.CRITICAL,
  title: 'Payment failed',
  body: 'PAYMENT/pos',
};

describe('AlertService.dispatchCritical', () => {
  it('persists a DASHBOARD alert and pushes it to the realtime gateway', async () => {
    const { svc, prisma, gateway } = makeDeps('');
    await svc.dispatchCritical(input);

    expect(prisma.systemAlert.create).toHaveBeenCalledTimes(1);
    expect(prisma.systemAlert.create.mock.calls[0][0].data.channel).toBe('DASHBOARD');
    expect(prisma.systemAlert.create.mock.calls[0][0].data.delivered).toBe(true);
    expect(gateway.emitAlertCritical).toHaveBeenCalledTimes(1);
  });

  it('skips email when no recipients are configured', async () => {
    const { svc, prisma, email } = makeDeps('');
    await svc.dispatchCritical(input);
    expect(email.send).not.toHaveBeenCalled();
    expect(prisma.systemAlert.create).toHaveBeenCalledTimes(1); // dashboard only
  });

  it('sends email + marks it delivered when recipients are configured', async () => {
    const { svc, prisma, email } = makeDeps('ops@gym.com, oncall@gym.com');
    await svc.dispatchCritical(input);

    expect(email.send).toHaveBeenCalledTimes(1);
    expect(email.send.mock.calls[0][0].to).toEqual(['ops@gym.com', 'oncall@gym.com']);
    expect(prisma.systemAlert.create).toHaveBeenCalledTimes(2); // dashboard + email
    expect(prisma.systemAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ delivered: true }) }),
    );
  });

  it('does not throw when the email transport fails', async () => {
    const { svc, email } = makeDeps('ops@gym.com');
    email.send.mockRejectedValueOnce(new Error('SMTP down'));
    await expect(svc.dispatchCritical(input)).resolves.toBeUndefined();
  });
});

describe('AlertService.acknowledge', () => {
  it('marks the alert acknowledged by the admin', async () => {
    const { svc, prisma } = makeDeps();
    const out = await svc.acknowledge('alert-9', 'admin-1');
    expect(prisma.systemAlert.update).toHaveBeenCalledWith({
      where: { id: 'alert-9' },
      data: { acknowledged: true, acknowledged_by: 'admin-1' },
    });
    expect(out.acknowledged).toBe(true);
  });
});
