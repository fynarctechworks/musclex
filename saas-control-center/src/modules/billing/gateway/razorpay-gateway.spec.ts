import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { RazorpayGateway } from './razorpay-gateway';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function configWith(map: Record<string, string | undefined>) {
  return { get: (k: string) => map[k] } as unknown as ConfigService;
}

describe('RazorpayGateway', () => {
  let postMock: jest.Mock;

  beforeEach(() => {
    postMock = jest.fn();
    (mockedAxios.create as jest.Mock).mockReturnValue({ post: postMock });
  });

  afterEach(() => jest.resetAllMocks());

  it('throws at construction when credentials are missing', () => {
    expect(() => new RazorpayGateway(configWith({}))).toThrow(/RAZORPAY_KEY_ID/);
  });

  it('charge without a customer_token returns FAILED with a useful reason (no network)', async () => {
    const gw = new RazorpayGateway(
      configWith({ RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' }),
    );
    const r = await gw.charge({
      amount: 499, currency: 'INR', tenant_id: 't', payment_id: 'p',
    });
    expect(r.status).toBe('FAILED');
    expect(r.failure_reason).toMatch(/saved Razorpay recurring token/);
    expect(postMock).not.toHaveBeenCalled();
  });

  it('charge with token + "captured" response → PAID', async () => {
    postMock.mockResolvedValue({ data: { id: 'pay_xyz', status: 'captured' } });
    const gw = new RazorpayGateway(
      configWith({ RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' }),
    );
    const r = await gw.charge({
      amount: 499, currency: 'INR', tenant_id: 't', payment_id: 'p',
      customer_token: 'token_abc',
    });
    expect(r.status).toBe('PAID');
    expect(r.gateway_payment_id).toBe('pay_xyz');
    // Amount sent in minor units (paise)
    expect(postMock).toHaveBeenCalledWith(
      '/payments/create/recurring',
      expect.objectContaining({ amount: 49900, currency: 'INR', token: 'token_abc' }),
    );
  });

  it('charge with token + non-captured status → PENDING', async () => {
    postMock.mockResolvedValue({ data: { id: 'pay_abc', status: 'authorized' } });
    const gw = new RazorpayGateway(
      configWith({ RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' }),
    );
    const r = await gw.charge({
      amount: 100, currency: 'INR', tenant_id: 't', payment_id: 'p',
      customer_token: 't1',
    });
    expect(r.status).toBe('PENDING');
    expect(r.gateway_payment_id).toBe('pay_abc');
  });

  it('charge AxiosError with API description surfaces the description as failure_reason', async () => {
    const err = new AxiosError('Bad Request');
    (err as any).response = {
      status: 400,
      data: { error: { description: 'Token has expired' } },
    };
    postMock.mockRejectedValue(err);

    const gw = new RazorpayGateway(
      configWith({ RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' }),
    );
    const r = await gw.charge({
      amount: 1, currency: 'INR', tenant_id: 't', payment_id: 'p',
      customer_token: 't1',
    });
    expect(r.status).toBe('FAILED');
    expect(r.failure_reason).toBe('Token has expired');
  });

  it('refund with "processed" → REFUNDED, amount in paise', async () => {
    postMock.mockResolvedValue({ data: { id: 'rfnd_1', status: 'processed' } });
    const gw = new RazorpayGateway(
      configWith({ RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' }),
    );
    const r = await gw.refund({
      gateway_payment_id: 'pay_xyz',
      amount: 250.5,
      currency: 'INR',
      reason: 'admin override',
    });
    expect(r.status).toBe('REFUNDED');
    expect(r.gateway_refund_id).toBe('rfnd_1');
    expect(postMock).toHaveBeenCalledWith(
      '/payments/pay_xyz/refund',
      expect.objectContaining({ amount: 25050 }),
    );
  });

  it('refund "pending" → PENDING', async () => {
    postMock.mockResolvedValue({ data: { id: 'rfnd_2', status: 'pending' } });
    const gw = new RazorpayGateway(
      configWith({ RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' }),
    );
    const r = await gw.refund({
      gateway_payment_id: 'pay_xyz', amount: 1, currency: 'INR',
    });
    expect(r.status).toBe('PENDING');
  });
});
