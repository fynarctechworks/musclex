import { createHmac } from 'crypto';
import { StripeService } from '../../src/payments/stripe.service';

describe('StripeService', () => {
  const SECRET = 'sk_test_123';
  const WEBHOOK_SECRET = 'whsec_test';

  function makeService(env: Record<string, string | undefined> = {}) {
    const config = { get: jest.fn((k: string) => env[k]) } as any;
    return new StripeService(config);
  }

  describe('createPaymentIntent', () => {
    afterEach(() => jest.restoreAllMocks());

    it('POSTs form-encoded minor units with metadata and bearer auth', async () => {
      const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'pi_1', client_secret: 'pi_1_secret', amount: 150000, currency: 'inr', status: 'requires_payment_method' }),
      } as any);

      const service = makeService({ STRIPE_SECRET_KEY: SECRET });
      const intent = await service.createPaymentIntent({
        amount: 1500,
        metadata: { gym_id: 'g-1', payment_id: 'p-1' },
      });

      expect(intent.id).toBe('pi_1');
      const [url, init] = fetchMock.mock.calls[0] as any[];
      expect(url).toBe('https://api.stripe.com/v1/payment_intents');
      expect(init.headers.Authorization).toBe(`Bearer ${SECRET}`);
      const body = new URLSearchParams(init.body);
      expect(body.get('amount')).toBe('150000'); // rupees → paise
      expect(body.get('currency')).toBe('inr');
      expect(body.get('metadata[gym_id]')).toBe('g-1');
      expect(body.get('metadata[payment_id]')).toBe('p-1');
    });

    it('throws when Stripe is not configured', async () => {
      const service = makeService({});
      await expect(service.createPaymentIntent({ amount: 100 })).rejects.toThrow('not configured');
    });
  });

  describe('verifyWebhookSignature', () => {
    function signHeader(payload: string, timestamp: number, secret = WEBHOOK_SECRET) {
      const v1 = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
      return `t=${timestamp},v1=${v1}`;
    }

    it('accepts a fresh, correctly-signed payload', () => {
      const service = makeService({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET });
      const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
      const header = signHeader(payload, Math.floor(Date.now() / 1000));
      expect(service.verifyWebhookSignature(payload, header)).toBe(true);
    });

    it('rejects a tampered payload', () => {
      const service = makeService({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET });
      const header = signHeader('{"a":1}', Math.floor(Date.now() / 1000));
      expect(service.verifyWebhookSignature('{"a":2}', header)).toBe(false);
    });

    it('rejects a stale timestamp (replay)', () => {
      const service = makeService({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET });
      const payload = '{}';
      const stale = Math.floor(Date.now() / 1000) - 600;
      expect(service.verifyWebhookSignature(payload, signHeader(payload, stale))).toBe(false);
    });

    it('rejects when the signing secret differs', () => {
      const service = makeService({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET });
      const payload = '{}';
      const header = signHeader(payload, Math.floor(Date.now() / 1000), 'whsec_other');
      expect(service.verifyWebhookSignature(payload, header)).toBe(false);
    });

    it('fails closed with no webhook secret configured', () => {
      const service = makeService({});
      expect(service.verifyWebhookSignature('{}', 't=1,v1=abc')).toBe(false);
    });
  });
});
