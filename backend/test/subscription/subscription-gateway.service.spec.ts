import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { SubscriptionService } from '../../src/subscription/subscription.service';

/**
 * Security-critical guards of the Razorpay subscription verify path. We
 * instantiate the service directly with mocks (the rejected branches return
 * before any other dependency is used), so no Nest module is needed.
 */
describe('SubscriptionService.verifyAndRenew (gateway guards)', () => {
  const STUDIO = 'studio-1';

  const make = (razorpay: any) =>
    new SubscriptionService(
      {} as any, // prisma
      {} as any, // policy
      {} as any, // gateway
      {} as any, // queue
      {} as any, // config
      {} as any, // eventEmitter
      razorpay,
    );

  const base = {
    studio_id: STUDIO,
    actor_id: 'user-1',
    gateway_order_id: 'order_1',
    gateway_payment_id: 'pay_1',
    signature: 'sig',
  };

  it('rejects an invalid signature and never fetches the order', async () => {
    const razorpay = {
      verifyCheckoutSignature: jest.fn().mockReturnValue(false),
      getOrder: jest.fn(),
    };
    const svc = make(razorpay);
    await expect(svc.verifyAndRenew(base)).rejects.toBeInstanceOf(ForbiddenException);
    expect(razorpay.getOrder).not.toHaveBeenCalled();
  });

  it('rejects when the order belongs to a different tenant', async () => {
    const razorpay = {
      verifyCheckoutSignature: jest.fn().mockReturnValue(true),
      getOrder: jest.fn().mockResolvedValue({
        status: 'paid',
        currency: 'INR',
        notes: { studio_id: 'someone-else', plan: 'pro', billing_cycle: 'monthly' },
      }),
    };
    const svc = make(razorpay);
    await expect(svc.verifyAndRenew(base)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when the order is not paid', async () => {
    const razorpay = {
      verifyCheckoutSignature: jest.fn().mockReturnValue(true),
      getOrder: jest.fn().mockResolvedValue({
        status: 'created',
        currency: 'INR',
        notes: { studio_id: STUDIO, plan: 'pro', billing_cycle: 'monthly' },
      }),
    };
    const svc = make(razorpay);
    await expect(svc.verifyAndRenew(base)).rejects.toBeInstanceOf(BadRequestException);
  });
});
