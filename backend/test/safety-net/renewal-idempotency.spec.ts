/**
 * SAFETY NET — subscription renewal idempotency (P1-M9-1 double-bill guard)
 *
 * recordRenewal must be idempotent on payment_reference: a replayed real payment
 * (double-click / gateway retry) returns the prior renewal WITHOUT granting a
 * second billing period, creating a duplicate invoice, or re-mirroring to SCC.
 * These go RED if the dedup guard is removed.
 */

import { SubscriptionPolicyService } from '../../src/common/services/subscription-policy.service';

function makeService(tx: any) {
  const pub: any = { $transaction: (cb: any) => cb(tx) };
  const sccSync: any = { upsertPayment: jest.fn().mockResolvedValue(undefined) };
  const svc = new SubscriptionPolicyService(pub, sccSync);
  return { svc, sccSync };
}

const STUDIO = {
  id: 's1', slug: 'gymx', subscription_plan: 'pro', billing_cycle: 'monthly',
  next_billing_date: new Date('2026-07-01T00:00:00Z'), trial_ends_at: null,
  lifecycle_status: 'active',
};

describe('SAFETY-NET / recordRenewal idempotency', () => {
  it('replayed payment_reference → returns prior renewal, no new period/invoice/SCC', async () => {
    const tx = {
      studio: { findUnique: jest.fn().mockResolvedValue(STUDIO), update: jest.fn() },
      subscriptionEvent: {
        findFirst: jest.fn().mockResolvedValue({
          period_start: new Date('2026-06-01T00:00:00Z'),
          period_end: new Date('2026-07-01T00:00:00Z'),
          plan_name: 'pro', billing_cycle: 'monthly',
          metadata: { invoice_number: 'INV-PRIOR', invoice_id: 'inv-prior', payment_reference: 'pay_123' },
        }),
        create: jest.fn(),
      },
      invoice: { create: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
    };
    const { svc, sccSync } = makeService(tx);

    const res = await svc.recordRenewal({ studio_id: 's1', amount: 100, payment_reference: 'pay_123' });

    expect(res.invoice_number).toBe('INV-PRIOR');
    expect(tx.studio.update).not.toHaveBeenCalled();         // no new period
    expect(tx.invoice.create).not.toHaveBeenCalled();        // no duplicate invoice
    expect(tx.subscriptionEvent.create).not.toHaveBeenCalled();
    expect(sccSync.upsertPayment).not.toHaveBeenCalled();    // no duplicate SCC mirror
  });

  it('first-time payment_reference → renews (new invoice + SCC mirror)', async () => {
    const tx = {
      studio: { findUnique: jest.fn().mockResolvedValue(STUDIO), update: jest.fn().mockResolvedValue({}) },
      subscriptionEvent: {
        findFirst: jest.fn().mockResolvedValue(null), // no prior → not a replay
        create: jest.fn().mockResolvedValue({}),
      },
      invoice: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'inv-new', invoice_number: 'INV-NEW-0001' }),
      },
    };
    const { svc, sccSync } = makeService(tx);

    const res = await svc.recordRenewal({ studio_id: 's1', amount: 100, payment_reference: 'pay_999' });

    expect(res.invoice_id).toBe('inv-new');
    expect(tx.studio.update).toHaveBeenCalledTimes(1);       // new period persisted
    expect(tx.invoice.create).toHaveBeenCalledTimes(1);
    expect(sccSync.upsertPayment).toHaveBeenCalledTimes(1);  // mirrored once
  });
});
