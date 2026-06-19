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

const PENDING = {
  id: 'p1', status: 'pending', amount: 100, receipt_number: 'R1',
  payment_method: 'razorpay', invoice_id: null, branch_id: 'b1',
};

function build(tx: any, extraClient: any = {}, deps: any = {}) {
  const client = {
    payment: { findFirst: jest.fn().mockResolvedValue({ ...PENDING }) },
    membershipPlan: { findUnique: jest.fn().mockResolvedValue({ id: 'pl1', duration_days: 30, total_classes: null }) },
    $transaction: (cb: any) => cb(tx),
    ...extraClient,
  };
  const tenant: any = { client };
  const razorpay: any = { verifyCheckoutSignature: jest.fn().mockReturnValue(true), getOrder: jest.fn() };
  const tasks: any = { runForGym: (_g: string, fn: any) => fn() };
  const billing: any = { recalculateInvoiceStatus: jest.fn() };
  return new PaymentsService({} as any, tenant, tasks, billing, { ...razorpay, ...deps });
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
