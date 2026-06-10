import { readFileSync } from 'fs';
import { join } from 'path';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { RazorpayService } from '../../src/payments/razorpay.service';
import { PaymentsService } from '../../src/payments/payments.service';

/**
 * LIVE Razorpay test-API integration. Gated by RAZORPAY_LIVE_TEST=1 so the
 * normal suite (and CI without network/keys) skips it.
 *
 * Run:  RAZORPAY_LIVE_TEST=1 npx jest test/payments/razorpay.live.spec.ts
 *
 * Proves the WHOLE server side over real REST — no browser, no manual card:
 *   1) createOrder  → a real order on api.razorpay.com (test mode)
 *   2) getOrder     → fetch it back (notes intact)
 *   3) signature    → synthesize the exact Checkout callback Razorpay would send
 *                     (HMAC of `order_id|payment_id` with the KEY SECRET — the same
 *                     value Razorpay's servers compute) and run it through the real
 *                     PaymentsService.verifyPayment, asserting it records the payment
 *                     and creates the membership.
 *
 * The only thing this can't do is move real money — that always happens inside
 * Razorpay's Checkout with a real instrument, in test mode or prod alike.
 */

// Load keys from process.env, falling back to backend/.env (no dotenv dependency).
function loadKeys(): { keyId: string; keySecret: string } {
  let keyId = process.env.RAZORPAY_KEY_ID ?? '';
  let keySecret = process.env.RAZORPAY_KEY_SECRET ?? '';
  if (!keyId || !keySecret) {
    try {
      const env = readFileSync(join(__dirname, '..', '..', '.env'), 'utf8');
      for (const line of env.split('\n')) {
        const m = line.match(/^(RAZORPAY_KEY_ID|RAZORPAY_KEY_SECRET)=(.*)$/);
        if (m) {
          const val = m[2].replace(/^["']|["']$/g, '').trim();
          if (m[1] === 'RAZORPAY_KEY_ID') keyId = val;
          else keySecret = val;
        }
      }
    } catch {
      /* no .env — handled by the gate below */
    }
  }
  return { keyId, keySecret };
}

const { keyId, keySecret } = loadKeys();
const LIVE = process.env.RAZORPAY_LIVE_TEST === '1' && !!keyId && !!keySecret;
const d = LIVE ? describe : describe.skip;

d('Razorpay LIVE test-API integration', () => {
  const config = {
    get: (k: string, def?: string) =>
      k === 'RAZORPAY_KEY_ID' ? keyId : k === 'RAZORPAY_KEY_SECRET' ? keySecret : def ?? '',
  } as unknown as ConfigService;

  const razorpay = new RazorpayService(config);

  jest.setTimeout(30000);

  it('creates and fetches a real order', async () => {
    const order = await razorpay.createOrder({
      amount: 1,
      currency: 'INR',
      receipt: `JEST-${Date.now()}`,
      notes: { kind: 'jest-live', plan_id: 'plan-x' },
    });
    expect(order.id).toMatch(/^order_/);
    expect(order.amount).toBe(100); // ₹1 → 100 paise

    const fetched = await razorpay.getOrder(order.id);
    expect(fetched.id).toBe(order.id);
    expect(fetched.notes?.kind).toBe('jest-live');
  });

  it('accepts a faithfully-synthesized Checkout signature and rejects a tampered one', async () => {
    const order = await razorpay.createOrder({ amount: 1, receipt: `JEST-SIG-${Date.now()}` });
    const paymentId = 'pay_LIVEJESTSYNTH';
    // Exactly what Razorpay Checkout returns as razorpay_signature:
    const signature = createHmac('sha256', keySecret)
      .update(`${order.id}|${paymentId}`)
      .digest('hex');

    expect(razorpay.verifyCheckoutSignature(order.id, paymentId, signature)).toBe(true);
    expect(razorpay.verifyCheckoutSignature(order.id, paymentId, 'deadbeef')).toBe(false);
  });

  it('runs the full verifyPayment flow with a real order + real signature → records payment + creates membership', async () => {
    // 1) Real order
    const order = await razorpay.createOrder({ amount: 1, receipt: `JEST-FLOW-${Date.now()}` });
    const paymentId = 'pay_LIVEJESTFLOW';
    const signature = createHmac('sha256', keySecret)
      .update(`${order.id}|${paymentId}`)
      .digest('hex');

    // 2) Minimal DB doubles for the verify transaction.
    const pending = {
      id: 'local-pay-1',
      gateway_order_id: order.id,
      payment_method: 'razorpay',
      status: 'pending',
      branch_id: 'branch-1',
      amount: 1,
      invoice_id: null,
      receipt_number: 'RCP-TEST',
    };
    const plan = { id: 'plan-x', duration_days: 30, total_classes: null, name: 'Pro' };
    const membership = { id: 'mem-1', plan };
    const tx = {
      payment: {
        findFirst: jest.fn().mockResolvedValue(pending),
        update: jest.fn().mockResolvedValue({ ...pending, status: 'paid' }),
      },
      memberMembership: { create: jest.fn().mockResolvedValue(membership) },
      financialTransaction: { create: jest.fn().mockResolvedValue({}) },
      member: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      payment: { findFirst: jest.fn().mockResolvedValue(pending) },
      membershipPlan: { findUnique: jest.fn().mockResolvedValue(plan) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
    const billing = { recalculateInvoiceStatus: jest.fn() };

    const payments = new PaymentsService(prisma as any, billing as any, razorpay);

    // 3) Replay the exact Checkout callback through the real verify path.
    const result = await payments.verifyPayment({
      gateway_payment_id: paymentId,
      gateway_order_id: order.id,
      signature,
      member_id: 'member-1',
      plan_id: 'plan-x',
      branch_id: 'branch-1',
    });

    expect(tx.memberMembership.create).toHaveBeenCalled();
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'paid', gateway_payment_id: paymentId }) }),
    );
    expect(result.membership).toEqual(membership);
  });

  it('rejects a forged signature in the full flow (no membership created)', async () => {
    const order = await razorpay.createOrder({ amount: 1, receipt: `JEST-BAD-${Date.now()}` });
    const pending = {
      id: 'local-pay-2',
      gateway_order_id: order.id,
      payment_method: 'razorpay',
      status: 'pending',
      branch_id: 'branch-1',
      amount: 1,
      invoice_id: null,
      receipt_number: 'RCP-TEST-2',
    };
    const tx = { memberMembership: { create: jest.fn() } };
    const prisma = {
      payment: { findFirst: jest.fn().mockResolvedValue(pending) },
      membershipPlan: { findUnique: jest.fn() },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
    const payments = new PaymentsService(prisma as any, { recalculateInvoiceStatus: jest.fn() } as any, razorpay);

    await expect(
      payments.verifyPayment({
        gateway_payment_id: 'pay_FORGED',
        gateway_order_id: order.id,
        signature: 'forged-signature',
        member_id: 'member-1',
        plan_id: 'plan-x',
        branch_id: 'branch-1',
      }),
    ).rejects.toThrow(/Invalid payment signature/);
    expect(tx.memberMembership.create).not.toHaveBeenCalled();
  });
});
