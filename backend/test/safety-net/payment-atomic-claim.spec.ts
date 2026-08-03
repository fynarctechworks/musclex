/**
 * SAFETY NET — payment confirmation atomic claim (P1-M5-1 double-credit guard)
 *
 * verifyPayment + handleRazorpayWebhook must transition pending→paid via a
 * GUARDED atomic updateMany and only create the membership/ledger credit when
 * they win the claim (count === 1). These go RED if a refactor reverts to a
 * non-locking findFirst check-then-act that could double-credit on concurrent
 * confirmations (webhook×webhook, verify×verify, verify×webhook).
 */

import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from '../../src/payments/payments.service';

// Pending payment now carries the server-set member_id/branch_id that
// verifyPayment derives the grant from (client input is ignored).
const PENDING = {
  id: 'p1', status: 'pending', amount: 100, receipt_number: 'R1',
  payment_method: 'razorpay', invoice_id: null, branch_id: 'b1', member_id: 'm1',
};

function build(tx: any, extraClient: any = {}, deps: any = {}) {
  const client = {
    payment: { findFirst: jest.fn().mockResolvedValue({ ...PENDING }) },
    // plan_id comes from the order notes; price must equal the pending amount.
    membershipPlan: {
      findFirst: jest.fn().mockResolvedValue({ id: 'pl1', price: 100, duration_days: 30, total_classes: null }),
      findUnique: jest.fn().mockResolvedValue({ id: 'pl1', price: 100, duration_days: 30, total_classes: null }),
    },
    paymentGatewayConfig: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: (cb: any) => cb(tx),
    ...extraClient,
  };
  const tenant: any = { client };
  const razorpay: any = {
    verifyCheckoutSignature: jest.fn().mockReturnValue(true),
    getOrder: jest.fn().mockResolvedValue({ id: 'ord1', notes: { plan_id: 'pl1' } }),
  };
  const tasks: any = { runForGym: (_g: string, fn: any) => fn() };
  const billing: any = { recalculateInvoiceStatus: jest.fn() };
  const stripe: any = { configured: false };
  // The payment.paid receipt event is fire-and-forget and must never affect
  // the claim semantics under test — a no-op bus keeps this suite focused.
  const events: any = { emit: jest.fn() };
  return new PaymentsService(
    {} as any,
    tenant,
    tasks,
    billing,
    { ...razorpay, ...deps },
    stripe,
    events,
  );
}

const VERIFY_INPUT: any = {
  gateway_payment_id: 'pay1', gateway_order_id: 'ord1', signature: 'sig',
  member_id: 'm1', plan_id: 'pl1', branch_id: 'b1',
};

describe('SAFETY-NET / PaymentsService.verifyPayment atomic claim', () => {
  it('lost race (claim count 0) → throws, no membership, no ledger credit', async () => {
    const tx = {
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), update: jest.fn() },
      memberMembership: { create: jest.fn() },
      financialTransaction: { create: jest.fn() },
      member: { update: jest.fn() },
    };
    const svc = build(tx);

    await expect(svc.verifyPayment(VERIFY_INPUT)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.memberMembership.create).not.toHaveBeenCalled();
    expect(tx.financialTransaction.create).not.toHaveBeenCalled();
  });

  it('won race (claim count 1) → creates membership + exactly one ledger credit', async () => {
    const tx = {
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: 'p1', amount: 100, receipt_number: 'R1', invoice_id: null }),
      },
      memberMembership: { create: jest.fn().mockResolvedValue({ id: 'mem1', plan: {} }) },
      financialTransaction: { create: jest.fn().mockResolvedValue({}) },
      member: { update: jest.fn().mockResolvedValue({}) },
    };
    const svc = build(tx);

    const res: any = await svc.verifyPayment(VERIFY_INPUT);
    expect(res.membership.id).toBe('mem1');
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'p1', status: 'pending' }) }),
    );
    expect(tx.financialTransaction.create).toHaveBeenCalledTimes(1);
    // The GRANT uses SERVER-derived ids (pending row + order notes), NOT the
    // client's VERIFY_INPUT plan_id — proving the plan-swap vector is closed.
    expect(tx.memberMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ member_id: 'm1', plan_id: 'pl1', branch_id: 'b1' }) }),
    );
  });

  it('SECURITY: a client-swapped plan_id is ignored — grant follows the order notes, not the request', async () => {
    const tx = {
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: 'p1', amount: 100, receipt_number: 'R1', invoice_id: null }),
      },
      memberMembership: { create: jest.fn().mockResolvedValue({ id: 'mem1', plan: {} }) },
      financialTransaction: { create: jest.fn().mockResolvedValue({}) },
      member: { update: jest.fn().mockResolvedValue({}) },
    };
    const svc = build(tx);
    // Attacker paid the cheap order (notes.plan_id='pl1', price 100) but claims
    // an expensive plan in the request body.
    await svc.verifyPayment({ ...VERIFY_INPUT, plan_id: 'EXPENSIVE', member_id: 'ATTACKER', branch_id: 'X' });
    expect(tx.memberMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan_id: 'pl1', member_id: 'm1', branch_id: 'b1' }) }),
    );
  });

  it('SECURITY: rejects when the paid amount does not match the granted plan price', async () => {
    const tx = {
      payment: { updateMany: jest.fn(), update: jest.fn() },
      memberMembership: { create: jest.fn() },
      financialTransaction: { create: jest.fn() },
      member: { update: jest.fn() },
    };
    // Pending amount 100, but the order's plan is priced 5000 → mismatch.
    const svc = build(tx, {
      membershipPlan: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pl1', price: 5000, duration_days: 30, total_classes: null }),
      },
    });
    await expect(svc.verifyPayment(VERIFY_INPUT)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.memberMembership.create).not.toHaveBeenCalled();
  });
});

describe('SAFETY-NET / PaymentsService.handleRazorpayWebhook atomic claim', () => {
  it('lost race (claim count 0) → no ledger credit', async () => {
    const tx = {
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      financialTransaction: { create: jest.fn() },
    };
    const svc = build(tx, {}, { getOrder: jest.fn().mockResolvedValue({ notes: { gym_id: 'g1' } }) });

    await svc.handleRazorpayWebhook('ord1', 'pay1');
    expect(tx.financialTransaction.create).not.toHaveBeenCalled();
  });

  it('won race (claim count 1) → exactly one ledger credit', async () => {
    const tx = {
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      financialTransaction: { create: jest.fn().mockResolvedValue({}) },
    };
    const svc = build(tx, {}, { getOrder: jest.fn().mockResolvedValue({ notes: { gym_id: 'g1' } }) });

    await svc.handleRazorpayWebhook('ord1', 'pay1');
    expect(tx.financialTransaction.create).toHaveBeenCalledTimes(1);
  });
});
