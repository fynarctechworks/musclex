import { BadRequestException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

/**
 * Service-level coverage for the plan-change proration engine and the
 * GST-inclusive renewal amounts. All persistence is mocked at the
 * policy/prisma boundary — these tests lock in the ORCHESTRATION rules:
 * mode routing, server-side amounts, payment validation, schedule
 * consumption, and the cancel → free-tier landing.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const PLAN_ROWS: Record<string, any> = {
  free: { is_active: true, display_name: 'Free', monthly_price: 0, annual_price: 0 },
  starter: { is_active: true, display_name: 'Starter', monthly_price: 999, annual_price: 9990 },
  pro: { is_active: true, display_name: 'Pro', monthly_price: 2499, annual_price: 24990 },
};

function buildService(studioOverrides: Record<string, unknown> = {}) {
  const studioRow = {
    id: 'studio-1',
    name: 'Iron Gym',
    slug: 'iron-gym',
    email: 'owner@iron.gym',
    billing_email: null,
    billing_name: null,
    billing_address: null,
    tax_id: null,
    owner_user_id: 'user-1',
    subscription_plan: 'starter',
    billing_cycle: 'monthly',
    next_billing_date: new Date(Date.now() + 15 * DAY_MS),
    lifecycle_status: 'active',
    currency: 'INR',
    ...studioOverrides,
  };

  const pub = {
    studio: {
      findUnique: jest.fn().mockResolvedValue(studioRow),
      update: jest.fn().mockResolvedValue({}),
    },
    subscriptionPlan: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: any) =>
          Promise.resolve(PLAN_ROWS[where.name] ?? null),
        ),
    },
    subscriptionEvent: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    // GST setting read — default: no scc.platform_settings row → 0% GST.
    $queryRaw: jest.fn().mockResolvedValue([]),
  };

  const policy = {
    getScheduledPlanChange: jest.fn().mockResolvedValue(null),
    schedulePlanChange: jest.fn().mockResolvedValue(undefined),
    cancelScheduledPlanChange: jest.fn().mockResolvedValue(null),
    recordPlanChange: jest.fn().mockResolvedValue({
      previous_plan: 'starter',
      plan: 'pro',
      billing_cycle: 'monthly',
      period_start: new Date(),
      period_end: studioRow.next_billing_date,
      previous_status: 'active',
      invoice_number: 'INV-20260708-0001',
      invoice_id: 'inv-1',
      slug: 'iron-gym',
      replayed: false,
    }),
    recordRenewal: jest.fn().mockResolvedValue({
      period_start: new Date(),
      period_end: new Date(Date.now() + 30 * DAY_MS),
      previous_status: 'active',
      invoice_number: 'INV-20260708-0002',
      invoice_id: 'inv-2',
      plan_changed: false,
      plan: 'starter',
      billing_cycle: 'monthly',
      slug: 'iron-gym',
    }),
    getContext: jest.fn().mockResolvedValue({ status: 'active' }),
    computeNextPeriod: jest.fn().mockImplementation((prior: Date | null) => {
      const start = prior ?? new Date();
      return { period_start: start, period_end: new Date(start.getTime() + 30 * DAY_MS) };
    }),
    invalidateCache: jest.fn(),
  };

  const gateway = { pushStatusChange: jest.fn() };
  const queue = { enqueueEmail: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const eventEmitter = { emit: jest.fn() };
  const razorpay = {
    createOrder: jest.fn().mockResolvedValue({
      id: 'order_test_1',
      amount: 75000,
      currency: 'INR',
      status: 'created',
    }),
    getKeyId: jest.fn().mockReturnValue('rzp_test_key'),
    verifyCheckoutSignature: jest.fn(),
    getOrder: jest.fn(),
  };

  const svc = new SubscriptionService(
    pub as any,
    policy as any,
    gateway as any,
    queue as any,
    config as any,
    eventEmitter as any,
    razorpay as any,
    // No coupon in these fixtures: resolve() returns null so pricing is
    // unchanged, and consume() is never reached.
    { resolve: jest.fn().mockResolvedValue(null), consume: jest.fn() } as any,
  );

  return { svc, pub, policy, gateway, queue, razorpay, eventEmitter, studioRow };
}

/** Flush fire-and-forget promises (emails) before asserting on them. */
const flush = () => new Promise((r) => setImmediate(r));

describe('getPlanChangePreview — mode routing + money math', () => {
  it('routes a mid-period upgrade to immediate proration with the right charge', async () => {
    const { svc } = buildService();
    const preview = await svc.getPlanChangePreview('studio-1', { plan: 'pro' });

    expect(preview.mode).toBe('immediate_prorated');
    expect(preview.change_type).toBe('upgrade');
    expect(preview.proration?.remaining_days).toBe(15);
    // (2499 − 999) × 15/30 = 750, no GST configured
    expect(preview.subtotal).toBe(750);
    expect(preview.total).toBe(750);
    expect(preview.target.display_name).toBe('Pro');
  });

  it('adds GST on top of the prorated subtotal when configured', async () => {
    const { svc, pub } = buildService();
    pub.$queryRaw.mockResolvedValue([
      { value: { percent: 18, label: 'GST', enabled: true } },
    ]);
    const preview = await svc.getPlanChangePreview('studio-1', { plan: 'pro' });
    expect(preview.subtotal).toBe(750);
    expect(preview.gst_amount).toBe(135); // 18% of 750
    expect(preview.total).toBe(885);
  });

  it('schedules downgrades at the period boundary with nothing to pay', async () => {
    const { svc, pub, studioRow } = buildService({ subscription_plan: 'pro' });
    pub.studio.findUnique.mockResolvedValue(studioRow);
    const preview = await svc.getPlanChangePreview('studio-1', { plan: 'starter' });

    expect(preview.mode).toBe('scheduled');
    expect(preview.change_type).toBe('downgrade');
    expect(preview.total).toBe(0);
    expect(preview.effective_at).toBe(
      (studioRow.next_billing_date as Date).toISOString(),
    );
  });

  it('schedules cycle switches even when they cost more', async () => {
    const { svc } = buildService();
    const preview = await svc.getPlanChangePreview('studio-1', {
      plan: 'starter',
      billing_cycle: 'annual',
    });
    expect(preview.mode).toBe('scheduled');
    expect(preview.change_type).toBe('cycle_change');
  });

  it('falls back to renewal_due outside an active paid period', async () => {
    const { svc } = buildService({
      next_billing_date: new Date(Date.now() - 2 * DAY_MS),
      lifecycle_status: 'grace_period',
    });
    const preview = await svc.getPlanChangePreview('studio-1', { plan: 'pro' });
    expect(preview.mode).toBe('renewal_due');
  });

  it('rejects a no-op change to the same plan and cycle', async () => {
    const { svc } = buildService();
    await expect(
      svc.getPlanChangePreview('studio-1', { plan: 'starter' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('changePlan — execution paths', () => {
  it('records a scheduled downgrade and sends the confirmation email', async () => {
    const { svc, policy, queue, studioRow, pub } = buildService({
      subscription_plan: 'pro',
    });
    pub.studio.findUnique.mockResolvedValue(studioRow);

    const result = await svc.changePlan({
      studio_id: 'studio-1',
      actor_id: 'user-1',
      plan: 'starter',
    });

    expect(result.mode).toBe('scheduled');
    expect(policy.schedulePlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target_plan: 'starter',
        target_cycle: 'monthly',
        effective_at: studioRow.next_billing_date,
        previous_plan: 'pro',
      }),
    );
    await flush();
    expect(queue.enqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@iron.gym' }),
    );
  });

  it('rejects manual-paid prorated upgrades — paid upgrades are gateway-only', async () => {
    const { svc, policy } = buildService();

    await expect(
      svc.changePlan({
        studio_id: 'studio-1',
        actor_id: 'user-1',
        plan: 'pro',
        payment_method: 'upi',
        payment_reference: 'UTR-123456',
      }),
    ).rejects.toThrow(/create-order/);
    expect(policy.recordPlanChange).not.toHaveBeenCalled();
  });

  it('routes razorpay upgrades to create-order + verify instead', async () => {
    const { svc } = buildService();
    await expect(
      svc.changePlan({
        studio_id: 'studio-1',
        actor_id: 'user-1',
        plan: 'pro',
        payment_method: 'razorpay',
        payment_reference: 'pay_x',
      }),
    ).rejects.toThrow(/create-order/);
  });
});

describe('createPlanChangeOrder', () => {
  it('freezes the proration breakdown into server-set order notes', async () => {
    const { svc, razorpay, studioRow } = buildService();
    const order = await svc.createPlanChangeOrder('studio-1', { plan: 'pro' });

    expect(order.total).toBe(750);
    expect(razorpay.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 750,
        notes: expect.objectContaining({
          kind: 'plan_change',
          plan: 'pro',
          from_plan: 'starter',
          period_end: (studioRow.next_billing_date as Date).toISOString(),
          total: '750',
        }),
      }),
    );
  });

  it('refuses to create a payment order for a scheduled change', async () => {
    const { svc, pub, studioRow } = buildService({ subscription_plan: 'pro' });
    pub.studio.findUnique.mockResolvedValue(studioRow);
    await expect(
      svc.createPlanChangeOrder('studio-1', { plan: 'starter' }),
    ).rejects.toThrow(/end of your current period/);
  });
});

describe('renew — GST-inclusive totals', () => {
  it('records the GST-inclusive total, matching what the gateway charges', async () => {
    const { svc, policy, pub } = buildService();
    pub.$queryRaw.mockResolvedValue([
      { value: { percent: 18, label: 'GST', enabled: true } },
    ]);

    // gateway_verified simulates the verifyAndRenew path — self-service
    // manual renewals are rejected before any recording happens.
    const result = await svc.renew({
      studio_id: 'studio-1',
      actor_id: 'user-1',
      gateway_verified: true,
      payment_method: 'razorpay',
      payment_reference: 'pay_gst_check',
    });

    // 999 + 18% = 1178.82
    expect(policy.recordRenewal).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1178.82 }),
    );
    expect(result.amount).toBe(1178.82);
    expect(result.subtotal).toBe(999);
    expect(result.gst_amount).toBe(179.82);
  });

  it('rejects self-service manual renewals — renewals are gateway-only', async () => {
    const { svc, policy } = buildService();
    await expect(
      svc.renew({
        studio_id: 'studio-1',
        actor_id: 'user-1',
        payment_method: 'upi',
        payment_reference: 'UTR-999999',
      }),
    ).rejects.toThrow(/create-order/);
    expect(policy.recordRenewal).not.toHaveBeenCalled();
  });
});

describe('scheduled-change consumption at renewal', () => {
  it('previews the pending PAID downgrade as the renewal default', async () => {
    const { svc, policy, pub, studioRow } = buildService({
      subscription_plan: 'pro',
    });
    pub.studio.findUnique.mockResolvedValue(studioRow);
    policy.getScheduledPlanChange.mockResolvedValue({
      target_plan: 'starter',
      target_cycle: 'monthly',
      effective_at: studioRow.next_billing_date,
      scheduled_at: new Date(),
      previous_plan: 'pro',
    });

    const preview = await svc.simulateRenewal('studio-1');
    expect(preview.plan).toBe('starter');
    expect(preview.applies_scheduled_change).toBe(true);
  });

  it('ignores a FREE-tier schedule (cancellation) — renewing IS reactivation', async () => {
    const { svc, policy, studioRow } = buildService();
    policy.getScheduledPlanChange.mockResolvedValue({
      target_plan: 'free',
      target_cycle: 'monthly',
      effective_at: studioRow.next_billing_date,
      scheduled_at: new Date(),
      previous_plan: 'starter',
    });

    const preview = await svc.simulateRenewal('studio-1');
    expect(preview.plan).toBe('starter'); // current plan, NOT free
    expect(preview.applies_scheduled_change).toBe(false);
  });

  it('an explicit plan choice supersedes the schedule', async () => {
    const { svc, policy } = buildService();
    const preview = await svc.simulateRenewal('studio-1', { plan: 'pro' });
    expect(preview.plan).toBe('pro');
    expect(policy.getScheduledPlanChange).not.toHaveBeenCalled();
  });
});

describe('cancelPlan — end-of-period landing on the free tier', () => {
  it('schedules the downgrade to free while a paid period is running', async () => {
    const { svc, policy, studioRow } = buildService();

    const result = await svc.cancelPlan({
      studio_id: 'studio-1',
      actor_id: 'user-1',
      reason: 'too expensive',
    });

    expect(result.downgrade_to_free_scheduled).toBe(true);
    expect(policy.schedulePlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target_plan: 'free',
        effective_at: studioRow.next_billing_date,
        metadata: expect.objectContaining({ change_type: 'cancellation' }),
      }),
    );
  });

  it('does not schedule anything for a studio already on the free tier', async () => {
    const { svc, policy, pub, studioRow } = buildService({
      subscription_plan: 'free',
    });
    pub.studio.findUnique.mockResolvedValue(studioRow);

    const result = await svc.cancelPlan({
      studio_id: 'studio-1',
      actor_id: 'user-1',
    });

    expect(result.downgrade_to_free_scheduled).toBe(false);
    expect(policy.schedulePlanChange).not.toHaveBeenCalled();
  });

  it('does not schedule for an already-expired period (they lapse naturally)', async () => {
    const { svc, policy } = buildService({
      next_billing_date: new Date(Date.now() - DAY_MS),
    });

    const result = await svc.cancelPlan({
      studio_id: 'studio-1',
      actor_id: 'user-1',
    });

    expect(result.downgrade_to_free_scheduled).toBe(false);
    expect(policy.schedulePlanChange).not.toHaveBeenCalled();
  });
});
