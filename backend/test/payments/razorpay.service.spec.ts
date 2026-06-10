import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { RazorpayService } from '../../src/payments/razorpay.service';

/**
 * Pure unit tests for the SDK-free Razorpay client. Signature verification is
 * deterministic crypto, so we can assert exact behaviour without network calls.
 */
describe('RazorpayService', () => {
  const KEY_ID = 'rzp_test_abc123';
  const KEY_SECRET = 'secret_xyz';

  const makeService = (env: Record<string, string> = {}) => {
    const config = {
      get: (k: string, d?: string) => env[k] ?? d ?? '',
    } as unknown as ConfigService;
    return new RazorpayService(config);
  };

  describe('configured', () => {
    it('is false when keys are missing', () => {
      expect(makeService().configured).toBe(false);
    });
    it('is true when both keys present', () => {
      const svc = makeService({ RAZORPAY_KEY_ID: KEY_ID, RAZORPAY_KEY_SECRET: KEY_SECRET });
      expect(svc.configured).toBe(true);
      expect(svc.getKeyId()).toBe(KEY_ID);
    });
  });

  describe('verifyCheckoutSignature', () => {
    const svc = makeService({ RAZORPAY_KEY_ID: KEY_ID, RAZORPAY_KEY_SECRET: KEY_SECRET });
    const orderId = 'order_123';
    const paymentId = 'pay_456';
    const validSig = createHmac('sha256', KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    it('accepts a correctly-signed handshake', () => {
      expect(svc.verifyCheckoutSignature(orderId, paymentId, validSig)).toBe(true);
    });

    it('rejects a tampered signature', () => {
      expect(svc.verifyCheckoutSignature(orderId, paymentId, 'deadbeef')).toBe(false);
    });

    it('rejects a signature for a different order', () => {
      expect(svc.verifyCheckoutSignature('order_999', paymentId, validSig)).toBe(false);
    });

    it('rejects when no secret is configured', () => {
      expect(makeService().verifyCheckoutSignature(orderId, paymentId, validSig)).toBe(false);
    });
  });

  describe('createOrder', () => {
    it('throws when not configured (no network call)', async () => {
      await expect(
        makeService().createOrder({ amount: 100, receipt: 'RCP-1' }),
      ).rejects.toThrow(/not configured/i);
    });

    it('throws on a non-positive amount', async () => {
      const svc = makeService({ RAZORPAY_KEY_ID: KEY_ID, RAZORPAY_KEY_SECRET: KEY_SECRET });
      await expect(svc.createOrder({ amount: 0, receipt: 'RCP-1' })).rejects.toThrow(
        /invalid order amount/i,
      );
    });

    it('posts amount in paise and returns the order on success', async () => {
      const svc = makeService({ RAZORPAY_KEY_ID: KEY_ID, RAZORPAY_KEY_SECRET: KEY_SECRET });
      const fetchMock = jest
        .spyOn(global, 'fetch' as any)
        .mockResolvedValue({
          ok: true,
          json: async () => ({ id: 'order_OK', amount: 49900, currency: 'INR', status: 'created' }),
        } as any);

      const order = await svc.createOrder({ amount: 499, receipt: 'RCP-2', currency: 'INR' });

      expect(order.id).toBe('order_OK');
      const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
      expect(body.amount).toBe(49900); // 499 * 100
      expect(body.payment_capture).toBe(1);
      fetchMock.mockRestore();
    });
  });
});
