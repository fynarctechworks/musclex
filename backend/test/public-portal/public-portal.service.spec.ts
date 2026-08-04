import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PublicPortalService } from '../../src/public-portal/public-portal.service';

describe('PublicPortalService', () => {
  const GYM = '66666666-6666-6666-6666-666666666666';
  const studioRow = {
    id: GYM,
    slug: 'phani-gym',
    name: 'Phani Gym',
    tagline: 'Train hard',
    logo_url: null,
    phone: '9999999999',
    email: 'hi@phani.gym',
    website: null,
    address: 'MG Road',
    city: 'Hyderabad',
    state: 'TS',
    suspended_at: null,
  };

  function makeService(opts: {
    studio?: any;
    member?: any;
    pendingPayment?: any;
    orderNotes?: Record<string, string>;
  } = {}) {
    const pub = {
      studio: { findUnique: jest.fn().mockResolvedValue(opts.studio === undefined ? studioRow : opts.studio) },
    } as any;
    const client = {
      branch: {
        findMany: jest.fn().mockResolvedValue([{ id: 'b-1', name: 'Main' }]),
        findFirst: jest.fn().mockResolvedValue({ id: 'b-1' }),
      },
      membershipPlan: {
        findMany: jest.fn().mockResolvedValue([{ id: 'p-1', name: 'Gold', price: 1500 }]),
        findFirst: jest.fn().mockResolvedValue({ id: 'p-1' }),
      },
      member: { findFirst: jest.fn().mockResolvedValue(opts.member ?? null) },
      lead: { update: jest.fn().mockResolvedValue({}) },
      leadActivity: { create: jest.fn().mockResolvedValue({}) },
      payment: { findFirst: jest.fn().mockResolvedValue(opts.pendingPayment ?? null) },
      class: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const tenant = { client } as any;
    const tasks = { runForGym: jest.fn((_g: string, fn: () => Promise<any>) => fn()) } as any;
    const members = { create: jest.fn().mockResolvedValue({ id: 'm-new', full_name: 'P' }) } as any;
    const leads = { create: jest.fn().mockResolvedValue({ id: 'lead-1' }) } as any;
    const payments = {
      createOrder: jest.fn().mockResolvedValue({
        order_id: 'order_1',
        payment_id: 'pay-1',
        key_id: 'rzp_key',
        amount: 1500,
        currency: 'INR',
        plan_name: 'Gold',
      }),
      verifyPayment: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'paid' }),
    } as any;
    const razorpay = {
      getOrder: jest.fn().mockResolvedValue({ id: 'order_1', notes: opts.orderNotes ?? { plan_id: 'p-1' } }),
      getKeyId: jest.fn((creds?: { keyId: string }) => creds?.keyId ?? 'rzp_env_key'),
    } as any;

    const service = new PublicPortalService(pub, tenant, tasks, members, leads, payments, razorpay);
    return { service, client, members, leads, payments, razorpay, tasks };
  }

  it('404s an unknown slug and a suspended gym', async () => {
    const { service } = makeService({ studio: null });
    await expect(service.gymProfile('ghost')).rejects.toThrow(NotFoundException);

    const { service: s2 } = makeService({ studio: { ...studioRow, suspended_at: new Date() } });
    await expect(s2.gymProfile('phani-gym')).rejects.toThrow(NotFoundException);
  });

  it('returns public-safe profile with branches and priced plans', async () => {
    const { service } = makeService();
    const profile = await service.gymProfile('phani-gym');
    expect(profile.gym).toMatchObject({ slug: 'phani-gym', name: 'Phani Gym' });
    expect(profile.gym).not.toHaveProperty('suspended_at');
    expect(profile.plans[0]).toMatchObject({ id: 'p-1', price: 1500 });
  });

  it('trial lead: creates via LeadsService then flips to trial_scheduled with a trial_booking activity', async () => {
    const { service, leads, client } = makeService();
    const result = await service.createLead('phani-gym', {
      full_name: 'Curious Prospect',
      phone: '9876543210',
      intent: 'trial',
      preferred_date: '2026-07-20',
    } as any);
    expect(leads.create).toHaveBeenCalledWith(
      expect.objectContaining({ lead_source: 'website', full_name: 'Curious Prospect' }),
    );
    expect(client.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { status: 'trial_scheduled' },
    });
    expect(client.leadActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ activity_type: 'trial_booking' }),
    });
    expect(result.status).toBe('trial_scheduled');
  });

  it('checkout: reuses an existing member matched by phone', async () => {
    const { service, members, payments } = makeService({ member: { id: 'm-existing' } });
    const result = await service.checkout('phani-gym', {
      plan_id: 'p-1',
      branch_id: 'b-1',
      full_name: 'Repeat Customer',
      phone: '98765 43210',
    } as any);
    expect(members.create).not.toHaveBeenCalled();
    expect(payments.createOrder).toHaveBeenCalledWith(GYM, {
      member_id: 'm-existing',
      plan_id: 'p-1',
      branch_id: 'b-1',
    });
    expect(result).toMatchObject({ order_id: 'order_1', key_id: 'rzp_key', member_id: 'm-existing' });
  });

  it('checkout: creates a lead-status member for a new phone', async () => {
    const { service, members } = makeService();
    await service.checkout('phani-gym', {
      plan_id: 'p-1',
      branch_id: 'b-1',
      full_name: 'New Prospect',
      phone: '9876543210',
    } as any);
    expect(members.create).toHaveBeenCalledWith(
      GYM,
      expect.objectContaining({ status: 'lead', phone: '9876543210' }),
    );
  });

  it('verify: delegates ONLY the 3 signature fields to verifyPayment (no client-trusted member/plan/branch)', async () => {
    const { service, payments } = makeService({});
    await service.verifyCheckout('phani-gym', {
      gateway_order_id: 'order_1',
      gateway_payment_id: 'rzpay_1',
      signature: 'sig',
    });
    // verifyPayment self-derives member/branch (pending row) + plan (order
    // notes) + enforces amount==price. The portal must pass NOTHING else.
    expect(payments.verifyPayment).toHaveBeenCalledWith({
      gateway_payment_id: 'rzpay_1',
      gateway_order_id: 'order_1',
      signature: 'sig',
    });
    expect(payments.verifyPayment).not.toHaveBeenCalledWith(
      expect.objectContaining({ plan_id: expect.anything() }),
    );
  });

  it('verify: propagates verifyPayment failures (bad signature / no pending / amount mismatch)', async () => {
    const { service, payments } = makeService({});
    (payments.verifyPayment as jest.Mock).mockRejectedValue(new NotFoundException('Pending payment not found'));
    await expect(
      service.verifyCheckout('phani-gym', {
        gateway_order_id: 'order_x',
        gateway_payment_id: 'p',
        signature: 's',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  describe('orderContext (hosted checkout)', () => {
    it('rejects malformed order ids without touching the gateway', async () => {
      const { service, razorpay } = makeService({});
      await expect(service.orderContext('../../etc')).rejects.toThrow(NotFoundException);
      await expect(service.orderContext('order_!!')).rejects.toThrow(NotFoundException);
      expect(razorpay.getOrder).not.toHaveBeenCalled();
    });

    it('returns public-safe context for a pending order', async () => {
      const { service, client } = makeService({
        pendingPayment: { member_id: 'm-1', branch_id: 'b-1' },
        orderNotes: { gym_id: GYM, plan_id: 'p-1' },
      });
      (client.payment.findFirst as jest.Mock).mockResolvedValue({ amount: 1500, currency: 'INR' });
      (client.membershipPlan.findFirst as jest.Mock).mockResolvedValue({ name: 'Gold' });
      (client as any).paymentGatewayConfig = { findFirst: jest.fn().mockResolvedValue(null) };

      const ctx = await service.orderContext('order_ABC12345');
      expect(ctx).toMatchObject({
        order_id: 'order_ABC12345',
        slug: 'phani-gym',
        gym_name: 'Phani Gym',
        amount: 1500,
        currency: 'INR',
        plan_name: 'Gold',
      });
      expect(ctx).not.toHaveProperty('member_id');
    });

    it('404s when the payment is no longer pending (paid orders leak nothing)', async () => {
      const { service, client } = makeService({ orderNotes: { gym_id: GYM, plan_id: 'p-1' } });
      (client.payment.findFirst as jest.Mock).mockResolvedValue(null);
      (client as any).paymentGatewayConfig = { findFirst: jest.fn().mockResolvedValue(null) };
      await expect(service.orderContext('order_ABC12345')).rejects.toThrow(NotFoundException);
    });

    it('404s when the gateway order has no gym routing', async () => {
      const { service, razorpay } = makeService({});
      (razorpay.getOrder as jest.Mock).mockResolvedValue({ id: 'order_X', notes: {} });
      await expect(service.orderContext('order_ABC12345')).rejects.toThrow(NotFoundException);
    });
  });

  // (missing-plan-metadata is now verifyPayment's responsibility — covered in
  // test/safety-net/payment-atomic-claim.spec.ts at the unit level.)
});
