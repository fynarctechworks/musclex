import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PaymentsController } from './payments.controller';

/**
 * Security tests for the Razorpay webhook intake (payments.controller.ts).
 * This endpoint is UNAUTHENTICATED (called by Razorpay), so its only defense is
 * the HMAC-SHA256 signature check + the 5-minute replay window. These tests lock
 * that gate so a regression can never silently let a forged webhook mutate money.
 */
describe('PaymentsController — Razorpay webhook signature gate', () => {
  const SECRET = 'whsec_test_secret';
  let paymentsService: { handleRazorpayWebhook: jest.Mock };
  let controller: PaymentsController;

  const config = {
    get: (key: string, def?: string) =>
      key === 'RAZORPAY_WEBHOOK_SECRET' ? SECRET : def,
  };

  const now = () => Math.floor(Date.now() / 1000);

  function makeReq(bodyObj: unknown) {
    const rawBody = Buffer.from(JSON.stringify(bodyObj), 'utf8');
    return { rawBody, body: bodyObj } as any;
  }

  function sign(bodyObj: unknown, secret = SECRET) {
    return createHmac('sha256', secret)
      .update(Buffer.from(JSON.stringify(bodyObj), 'utf8').toString('utf8'))
      .digest('hex');
  }

  const capturedEvent = () => ({
    event: 'payment.captured',
    created_at: now(),
    payload: { payment: { entity: { id: 'pay_123', order_id: 'order_123' } } },
  });

  const stripeService = { verifyWebhookSignature: jest.fn().mockReturnValue(false) };

  beforeEach(() => {
    paymentsService = { handleRazorpayWebhook: jest.fn().mockResolvedValue(undefined) };
    // Payment links are unused by the webhook path — stub keeps this focused.
    const paymentLinks = { create: jest.fn() };
    controller = new PaymentsController(
      paymentsService as any,
      config as any,
      stripeService as any,
      paymentLinks as any,
    );
  });

  it('accepts a correctly-signed, fresh payment.captured event and processes it', async () => {
    const body = capturedEvent();
    const res = await controller.razorpayWebhook(sign(body), 'evt_1', makeReq(body));
    expect(res).toEqual({ received: true });
    expect(paymentsService.handleRazorpayWebhook).toHaveBeenCalledWith('order_123', 'pay_123');
  });

  it('rejects a forged signature and never touches the service', async () => {
    const body = capturedEvent();
    await expect(
      controller.razorpayWebhook('deadbeef', 'evt_1', makeReq(body)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(paymentsService.handleRazorpayWebhook).not.toHaveBeenCalled();
  });

  it('rejects a tampered body (signature no longer matches the raw bytes)', async () => {
    const signed = capturedEvent();
    const goodSig = sign(signed);
    // Attacker swaps in a different order/payment id after signing.
    const tampered = capturedEvent();
    tampered.payload.payment.entity.order_id = 'order_ATTACKER';
    await expect(
      controller.razorpayWebhook(goodSig, 'evt_1', makeReq(tampered)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(paymentsService.handleRazorpayWebhook).not.toHaveBeenCalled();
  });

  it('rejects a signature made with the wrong secret', async () => {
    const body = capturedEvent();
    await expect(
      controller.razorpayWebhook(sign(body, 'wrong_secret'), 'evt_1', makeReq(body)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(paymentsService.handleRazorpayWebhook).not.toHaveBeenCalled();
  });

  it('rejects a replayed (stale) event outside the 5-minute window', async () => {
    const body = { ...capturedEvent(), created_at: now() - 301 };
    await expect(
      controller.razorpayWebhook(sign(body), 'evt_1', makeReq(body)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(paymentsService.handleRazorpayWebhook).not.toHaveBeenCalled();
  });

  it('fails closed when the webhook secret is not configured', async () => {
    const noSecret = new PaymentsController(
      paymentsService as any,
      { get: (_k: string, def?: string) => def } as any,
      stripeService as any,
      { create: jest.fn() } as any,
    );
    const body = capturedEvent();
    await expect(
      noSecret.razorpayWebhook(sign(body), 'evt_1', makeReq(body)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(paymentsService.handleRazorpayWebhook).not.toHaveBeenCalled();
  });

  it('ignores non-payment.captured events without calling the money path', async () => {
    const body = { event: 'payment.failed', created_at: now(), payload: {} };
    const res = await controller.razorpayWebhook(sign(body), 'evt_1', makeReq(body));
    expect(res).toEqual({ received: true });
    expect(paymentsService.handleRazorpayWebhook).not.toHaveBeenCalled();
  });
});
