import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { PaymentStatus, SubscriptionStatus, TenantStatus } from '@prisma/client';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { REDIS_CLIENT } from '../../config/redis.module';
import {
  BILLING_GATEWAY,
  BillingGateway,
  ChargeInput,
  ChargeResult,
  RefundInput,
  RefundResult,
} from '../billing/gateway/billing-gateway.interface';

type Sub = {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  start_date: Date;
  end_date: Date;
  auto_renew: boolean;
  tenant: { id: string; name: string; slug: string; status: TenantStatus; metadata: unknown };
  plan: { id: string; name: string; price_monthly: number };
};

type Payment = {
  id: string;
  tenant_id: string;
  subscription_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gateway: string;
  gateway_payment_id?: string | null;
  failure_reason?: string | null;
  metadata?: unknown;
};

class StubGateway implements BillingGateway {
  readonly name = 'stub';
  charge = jest.fn<Promise<ChargeResult>, [ChargeInput]>();
  refund = jest.fn<Promise<RefundResult>, [RefundInput]>();
}

function makePrismaStub() {
  const subs = new Map<string, Sub>();
  const payments = new Map<string, Payment>();
  const tenants = new Map<string, { id: string; status: TenantStatus }>();

  // $transaction: execute the array of pre-built promises sequentially.
  const $transaction = jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops));

  return {
    subs, payments, tenants, $transaction,
    subscription: {
      findMany: jest.fn(async ({ where }: any) => {
        let list = Array.from(subs.values());
        if (where?.status) list = list.filter(s => s.status === where.status);
        if (where?.end_date?.lt) list = list.filter(s => s.end_date < where.end_date.lt);
        return list;
      }),
      update: jest.fn(({ where: { id }, data }: any) => {
        return Promise.resolve().then(() => {
          const s = subs.get(id);
          if (!s) throw new Error('sub not found');
          const next: Sub = { ...s, ...data };
          subs.set(id, next);
          return next;
        });
      }),
    },
    payment: {
      create: jest.fn(async ({ data }: any) => {
        const id = `pay-${payments.size + 1}`;
        const row: Payment = {
          id,
          tenant_id: data.tenant_id,
          subscription_id: data.subscription_id ?? null,
          amount: Number(data.amount),
          currency: data.currency,
          status: data.status,
          gateway: data.gateway,
          metadata: data.metadata,
        };
        payments.set(id, row);
        return row;
      }),
      update: jest.fn(({ where: { id }, data }: any) => {
        return Promise.resolve().then(() => {
          const p = payments.get(id);
          if (!p) throw new Error('pay not found');
          const next: Payment = { ...p, ...data };
          payments.set(id, next);
          return next;
        });
      }),
    },
    tenant: {
      update: jest.fn(({ where: { id }, data }: any) => {
        return Promise.resolve().then(() => {
          const t = tenants.get(id) ?? { id, status: TenantStatus.ACTIVE };
          const next = { ...t, ...data };
          tenants.set(id, next);
          return next;
        });
      }),
    },
  };
}

describe('SubscriptionService.runExpirationsAndRenewals', () => {
  let svc: SubscriptionService;
  let prisma: ReturnType<typeof makePrismaStub>;
  let gateway: StubGateway;

  beforeEach(async () => {
    prisma = makePrismaStub();
    gateway = new StubGateway();
    const audit = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogsService;
    const redis = { set: jest.fn(async () => 'OK'), del: jest.fn() };

    const mod = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: audit },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: BILLING_GATEWAY, useValue: gateway },
      ],
    }).compile();
    svc = mod.get(SubscriptionService);
    // Silence the structured event logs
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  function seedDueAutoRenewSub(tenantMetadata: unknown = null): Sub {
    const sub: Sub = {
      id: 'sub-1',
      tenant_id: 't-1',
      plan_id: 'p-1',
      status: SubscriptionStatus.ACTIVE,
      start_date: new Date('2026-04-01'),
      end_date: new Date('2026-05-01'),
      auto_renew: true,
      tenant: { id: 't-1', name: 'Iron Paradise', slug: 'iron-paradise', status: TenantStatus.ACTIVE, metadata: tenantMetadata },
      plan: { id: 'p-1', name: 'Pro', price_monthly: 1499 },
    };
    prisma.subs.set(sub.id, sub);
    return sub;
  }

  it('on PAID: marks payment PAID, extends sub dates ~30 days, keeps ACTIVE', async () => {
    const sub = seedDueAutoRenewSub({ gateway_customer_token: 'token_abc' });
    gateway.charge.mockResolvedValue({ status: 'PAID', gateway_payment_id: 'pay_real_1' });

    await svc.runExpirationsAndRenewals();

    expect(gateway.charge).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1499, currency: 'INR', tenant_id: 't-1', customer_token: 'token_abc',
      }),
    );

    const updatedSub = prisma.subs.get(sub.id)!;
    expect(updatedSub.status).toBe(SubscriptionStatus.ACTIVE);
    const daysExtended = (updatedSub.end_date.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysExtended).toBeGreaterThan(29.9);
    expect(daysExtended).toBeLessThan(30.1);

    const paid = Array.from(prisma.payments.values())[0];
    expect(paid.status).toBe(PaymentStatus.PAID);
    expect(paid.gateway_payment_id).toBe('pay_real_1');
    expect(paid.subscription_id).toBe(sub.id);
  });

  it('on FAILED: marks payment FAILED, flips sub to PAST_DUE, does NOT extend dates, does NOT touch Tenant', async () => {
    const sub = seedDueAutoRenewSub(null);
    const originalEnd = sub.end_date.getTime();
    gateway.charge.mockResolvedValue({ status: 'FAILED', failure_reason: 'no saved token' });

    await svc.runExpirationsAndRenewals();

    const updatedSub = prisma.subs.get(sub.id)!;
    expect(updatedSub.status).toBe(SubscriptionStatus.PAST_DUE);
    expect(updatedSub.end_date.getTime()).toBe(originalEnd);

    const pay = Array.from(prisma.payments.values())[0];
    expect(pay.status).toBe(PaymentStatus.FAILED);
    expect(pay.failure_reason).toBe('no saved token');

    // Tenant.status must not change on auto-renew failure
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('on PENDING: marks payment PENDING, flips sub to PAST_DUE, does NOT extend dates', async () => {
    const sub = seedDueAutoRenewSub({ gateway_customer_token: 't' });
    gateway.charge.mockResolvedValue({ status: 'PENDING', gateway_payment_id: 'pay_pending' });

    await svc.runExpirationsAndRenewals();

    const updatedSub = prisma.subs.get(sub.id)!;
    expect(updatedSub.status).toBe(SubscriptionStatus.PAST_DUE);
    const pay = Array.from(prisma.payments.values())[0];
    expect(pay.status).toBe(PaymentStatus.PENDING);
    expect(pay.gateway_payment_id).toBe('pay_pending');
  });

  it('non-auto-renew due subs are expired and tenant flipped to EXPIRED (legacy path)', async () => {
    const sub: Sub = {
      id: 'sub-2',
      tenant_id: 't-2',
      plan_id: 'p-1',
      status: SubscriptionStatus.ACTIVE,
      start_date: new Date('2026-04-01'),
      end_date: new Date('2026-05-01'),
      auto_renew: false,
      tenant: { id: 't-2', name: 'FitZone', slug: 'fitzone', status: TenantStatus.ACTIVE, metadata: null },
      plan: { id: 'p-1', name: 'Pro', price_monthly: 1499 },
    };
    prisma.subs.set(sub.id, sub);

    await svc.runExpirationsAndRenewals();

    expect(prisma.subs.get(sub.id)!.status).toBe(SubscriptionStatus.EXPIRED);
    expect(prisma.tenants.get('t-2')!.status).toBe(TenantStatus.EXPIRED);
    // No gateway call on the non-renewing path
    expect(gateway.charge).not.toHaveBeenCalled();
  });
});
