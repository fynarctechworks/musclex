import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MemberBillingService } from './member-billing.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * Renewal is a thin, tenant-safe wrapper over PaymentsService. These tests lock
 * in the two things that matter: (1) a plan from another gym is rejected BEFORE
 * any order is created, and (2) the order is mapped to the contract shape with
 * amount in paise.
 */
describe('MemberBillingService', () => {
  const member: CurrentMemberContext = {
    appUserId: 'auA',
    memberId: 'mA',
    tenantId: 'tA',
    isGymMember: true,
  };
  let prisma: any;
  let payments: any;
  let audit: any;
  let service: MemberBillingService;

  beforeEach(() => {
    prisma = {
      membershipPlan: { findFirst: jest.fn() },
      member: { findFirst: jest.fn() },
    };
    payments = { createOrder: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new MemberBillingService(prisma, payments, audit);
  });

  it('rejects a plan that does not belong to the member gym (no order created)', async () => {
    prisma.membershipPlan.findFirst.mockResolvedValue(null); // not found within gym_id=tA

    await expect(service.renew(member, 'plan-from-other-gym')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.membershipPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'plan-from-other-gym', gym_id: 'tA' } }),
    );
    expect(payments.createOrder).not.toHaveBeenCalled();
  });

  it('throws when the member has no branch', async () => {
    prisma.membershipPlan.findFirst.mockResolvedValue({ id: 'p1' });
    prisma.member.findFirst.mockResolvedValue({ branch_id: null });

    await expect(service.renew(member, 'p1')).rejects.toBeInstanceOf(NotFoundException);
    expect(payments.createOrder).not.toHaveBeenCalled();
  });

  it('delegates to PaymentsService and maps the order to paise', async () => {
    prisma.membershipPlan.findFirst.mockResolvedValue({ id: 'p1' });
    prisma.member.findFirst.mockResolvedValue({ branch_id: 'b1' });
    payments.createOrder.mockResolvedValue({
      order_id: 'order_abc',
      payment_id: 'pay_1',
      key_id: 'rzp_key',
      receipt_number: 'RCPT-1',
      amount: 1500, // major unit (rupees)
      currency: 'INR',
    });

    const res = await service.renew(member, 'p1');

    expect(payments.createOrder).toHaveBeenCalledWith('tA', {
      member_id: 'mA',
      plan_id: 'p1',
      branch_id: 'b1',
    });
    expect(res).toEqual({
      orderId: 'order_abc',
      amount: 150000, // paise
      currency: 'INR',
      razorpayKeyId: 'rzp_key',
      receipt: 'RCPT-1',
    });
  });
});
