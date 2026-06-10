import { ConfigService } from '@nestjs/config';
import { SandboxGateway } from './sandbox-gateway';

function makeConfig(map: Record<string, string | undefined> = {}) {
  return { get: (k: string) => map[k] } as unknown as ConfigService;
}

describe('SandboxGateway', () => {
  it('charges succeed by default and return a stable shape', async () => {
    const gw = new SandboxGateway(makeConfig());
    const r = await gw.charge({
      amount: 499,
      currency: 'INR',
      tenant_id: 't1',
      payment_id: 'p1',
    });
    expect(r.status).toBe('PAID');
    expect(r.gateway_payment_id).toMatch(/^sbox_pay_/);
  });

  it('refunds succeed by default', async () => {
    const gw = new SandboxGateway(makeConfig());
    const r = await gw.refund({
      gateway_payment_id: 'sbox_pay_x',
      amount: 499,
      currency: 'INR',
    });
    expect(r.status).toBe('REFUNDED');
    expect(r.gateway_refund_id).toMatch(/^sbox_ref_/);
  });

  it('env BILLING_SANDBOX_FORCE=fail forces all charges to fail', async () => {
    const gw = new SandboxGateway(makeConfig({ BILLING_SANDBOX_FORCE: 'fail' }));
    const r = await gw.charge({
      amount: 1, currency: 'INR', tenant_id: 't', payment_id: 'p',
    });
    expect(r.status).toBe('FAILED');
    expect(r.failure_reason).toMatch(/forced/);
  });

  it('per-request __force_fail__ marker also fails (no env needed)', async () => {
    const gw = new SandboxGateway(makeConfig());
    const r = await gw.charge({
      amount: 1, currency: 'INR', tenant_id: 't', payment_id: 'p',
      description: 'integration test __force_fail__',
    });
    expect(r.status).toBe('FAILED');
  });

  it('name is "sandbox"', () => {
    expect(new SandboxGateway(makeConfig()).name).toBe('sandbox');
  });
});
