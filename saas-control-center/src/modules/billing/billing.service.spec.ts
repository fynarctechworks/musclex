import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { BillingService } from './billing.service';
import { IdempotencyService } from './idempotency.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  BILLING_GATEWAY,
  BillingGateway,
  ChargeInput,
  ChargeResult,
  RefundInput,
  RefundResult,
} from './gateway/billing-gateway.interface';

type Payment = {
  id: string;
  status: PaymentStatus;
  retry_count: number;
  amount: number;
  currency: string;
  tenant_id: string;
  gateway?: string | null;
  gateway_payment_id?: string | null;
  failure_reason?: string | null;
  metadata?: unknown;
};

function makePrismaStub() {
  const payments = new Map<string, Payment>();
  return {
    payments,
    payment: {
      findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) =>
        payments.get(id) ?? null,
      ),
      update: jest.fn(async ({ where: { id }, data }: { where: { id: string }; data: any }) => {
        const p = payments.get(id);
        if (!p) throw new Error('not found');
        const next: Payment = {
          ...p,
          ...data,
          retry_count:
            data.retry_count?.increment !== undefined
              ? p.retry_count + data.retry_count.increment
              : data.retry_count ?? p.retry_count,
        };
        payments.set(id, next);
        return next;
      }),
    },
  };
}

class StubGateway implements BillingGateway {
  readonly name = 'stub';
  charge = jest.fn<Promise<ChargeResult>, [ChargeInput]>();
  refund = jest.fn<Promise<RefundResult>, [RefundInput]>();
}

describe('BillingService — idempotency + gateway', () => {
  let svc: BillingService;
  let prisma: ReturnType<typeof makePrismaStub>;
  let gateway: StubGateway;
  const ctx = { admin_id: 'admin-1', ip_address: '127.0.0.1', user_agent: 'jest' };

  beforeEach(async () => {
    prisma = makePrismaStub();
    gateway = new StubGateway();
    // Default: every charge / refund succeeds; individual tests override.
    gateway.charge.mockResolvedValue({ status: 'PAID', gateway_payment_id: 'gw_pay_1' });
    gateway.refund.mockResolvedValue({ status: 'REFUNDED', gateway_refund_id: 'gw_ref_1' });

    const audit = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogsService;

    // In-memory idempotency stub (carries over from M5 tests)
    const store = new Map<string, { endpoint: string; hash: string; response: any }>();
    const idemStub: Partial<IdempotencyService> = {
      hashRequest: (endpoint, params) => `${endpoint}:${JSON.stringify(params)}`,
      checkOrReserve: jest.fn(async (key, endpoint, hash) => {
        const row = store.get(key);
        if (row) {
          if (row.endpoint !== endpoint) throw new ConflictException('endpoint mismatch');
          if (row.hash !== hash) throw new UnprocessableEntityException('hash mismatch');
          if (row.response !== undefined) {
            return { replayed: true, response: row.response, status_code: 200 };
          }
          throw new ConflictException('in flight');
        }
        store.set(key, { endpoint, hash, response: undefined });
        return { replayed: false };
      }),
      saveResponse: jest.fn(async (key, response) => {
        const row = store.get(key);
        if (row) row.response = response;
      }),
      release: jest.fn(async (key) => { store.delete(key); }),
    };

    const mod = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: audit },
        { provide: IdempotencyService, useValue: idemStub },
        { provide: BILLING_GATEWAY, useValue: gateway },
      ],
    }).compile();

    svc = mod.get(BillingService);
  });

  // ── Idempotency (M5) ─────────────────────────────────────────────────────

  it('replays the original response on retry with the same Idempotency-Key', async () => {
    prisma.payments.set('pay-1', {
      id: 'pay-1', status: PaymentStatus.FAILED, retry_count: 0,
      amount: 499, currency: 'INR', tenant_id: 't-1',
    });
    const key = 'idem-key-aaaaaaaaaaaaaaa';
    const first = await svc.retryPayment('pay-1', key, ctx);
    const second = await svc.retryPayment('pay-1', key, ctx);
    expect(first).toEqual(second);
    expect(prisma.payment.update).toHaveBeenCalledTimes(1);
    expect(gateway.charge).toHaveBeenCalledTimes(1);
  });

  it('failure inside the wrapped op releases the key and a retry can succeed later', async () => {
    const key = 'idem-key-bbbbbbbbbbbbbbb';
    await expect(svc.retryPayment('missing', key, ctx)).rejects.toBeInstanceOf(NotFoundException);
    prisma.payments.set('missing', {
      id: 'missing', status: PaymentStatus.FAILED, retry_count: 0,
      amount: 1, currency: 'INR', tenant_id: 't-1',
    });
    const ok = await svc.retryPayment('missing', key, ctx);
    expect(ok.status).toBe(PaymentStatus.PAID);
  });

  it('refund replays on duplicate key', async () => {
    prisma.payments.set('pay-2', {
      id: 'pay-2', status: PaymentStatus.PAID, retry_count: 0,
      amount: 1000, currency: 'INR', tenant_id: 't-1',
      gateway: 'razorpay', gateway_payment_id: 'pay_xyz',
    });
    const key = 'idem-key-ccccccccccccccc';
    const first = await svc.refund('pay-2', key, ctx);
    const second = await svc.refund('pay-2', key, ctx);
    expect(first).toEqual(second);
    expect(prisma.payment.update).toHaveBeenCalledTimes(1);
    expect(gateway.refund).toHaveBeenCalledTimes(1);
  });

  it('mark-paid replays on duplicate key (gateway not called)', async () => {
    prisma.payments.set('pay-3', {
      id: 'pay-3', status: PaymentStatus.PENDING, retry_count: 0,
      amount: 500, currency: 'INR', tenant_id: 't-1',
    });
    const key = 'idem-key-ddddddddddddddd';
    const first = await svc.markAsPaid('pay-3', key, ctx);
    const second = await svc.markAsPaid('pay-3', key, ctx);
    expect(first).toEqual(second);
    expect(gateway.charge).not.toHaveBeenCalled();
  });

  it('rejects retry on a non-FAILED payment with a BadRequest', async () => {
    prisma.payments.set('pay-4', {
      id: 'pay-4', status: PaymentStatus.PAID, retry_count: 0,
      amount: 1, currency: 'INR', tenant_id: 't-1',
    });
    await expect(
      svc.retryPayment('pay-4', 'idem-key-eeeeeeeeeeeeeee', ctx),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ── Gateway integration (H6) ─────────────────────────────────────────────

  it('retryPayment on PAID gateway result marks PAID + writes gateway_payment_id', async () => {
    prisma.payments.set('pay-5', {
      id: 'pay-5', status: PaymentStatus.FAILED, retry_count: 0,
      amount: 499, currency: 'INR', tenant_id: 't-5',
      gateway: 'razorpay', gateway_payment_id: 'pay_prev',
      metadata: { customer_token: 'token_xyz' },
    });
    gateway.charge.mockResolvedValueOnce({
      status: 'PAID', gateway_payment_id: 'pay_new_99',
    });
    const result = await svc.retryPayment('pay-5', 'idem-key-fffffffffffffff', ctx);
    expect(result.status).toBe(PaymentStatus.PAID);
    expect(result.gateway).toBe('stub');
    expect(result.gateway_payment_id).toBe('pay_new_99');
    expect(result.retry_count).toBe(1);
    // customer_token from metadata was forwarded
    expect(gateway.charge).toHaveBeenCalledWith(
      expect.objectContaining({ customer_token: 'token_xyz' }),
    );
  });

  it('retryPayment on FAILED gateway result keeps FAILED + records failure_reason + increments retry', async () => {
    prisma.payments.set('pay-6', {
      id: 'pay-6', status: PaymentStatus.FAILED, retry_count: 1,
      amount: 100, currency: 'INR', tenant_id: 't-6',
    });
    gateway.charge.mockResolvedValueOnce({
      status: 'FAILED', failure_reason: 'card declined',
    });
    const result = await svc.retryPayment('pay-6', 'idem-key-ggggggggggggggg', ctx);
    expect(result.status).toBe(PaymentStatus.FAILED);
    expect(result.failure_reason).toBe('card declined');
    expect(result.retry_count).toBe(2);
  });

  it('retryPayment on PENDING gateway result transitions to PENDING + increments retry', async () => {
    prisma.payments.set('pay-7', {
      id: 'pay-7', status: PaymentStatus.FAILED, retry_count: 0,
      amount: 100, currency: 'INR', tenant_id: 't-7',
    });
    gateway.charge.mockResolvedValueOnce({
      status: 'PENDING', gateway_payment_id: 'pay_pending',
    });
    const result = await svc.retryPayment('pay-7', 'idem-key-hhhhhhhhhhhhhhh', ctx);
    expect(result.status).toBe(PaymentStatus.PENDING);
    expect(result.gateway_payment_id).toBe('pay_pending');
  });

  it('refund of a gateway-backed payment calls gateway.refund', async () => {
    prisma.payments.set('pay-8', {
      id: 'pay-8', status: PaymentStatus.PAID, retry_count: 0,
      amount: 1000, currency: 'INR', tenant_id: 't-8',
      gateway: 'razorpay', gateway_payment_id: 'pay_real',
    });
    await svc.refund('pay-8', 'idem-key-iiiiiiiiiiiiiii', ctx);
    expect(gateway.refund).toHaveBeenCalledWith(
      expect.objectContaining({ gateway_payment_id: 'pay_real', amount: 1000 }),
    );
  });

  it('refund of a manually-recorded payment (no gateway_payment_id) skips gateway call', async () => {
    prisma.payments.set('pay-9', {
      id: 'pay-9', status: PaymentStatus.PAID, retry_count: 0,
      amount: 1, currency: 'INR', tenant_id: 't-9',
      gateway: 'manual', gateway_payment_id: null,
    });
    const result = await svc.refund('pay-9', 'idem-key-jjjjjjjjjjjjjjj', ctx);
    expect(result.status).toBe(PaymentStatus.REFUNDED);
    expect(gateway.refund).not.toHaveBeenCalled();
  });

  it('refund surfaces gateway failure as BadRequest (idempotency key released)', async () => {
    prisma.payments.set('pay-10', {
      id: 'pay-10', status: PaymentStatus.PAID, retry_count: 0,
      amount: 1, currency: 'INR', tenant_id: 't-10',
      gateway: 'razorpay', gateway_payment_id: 'pay_x',
    });
    gateway.refund.mockResolvedValueOnce({
      status: 'FAILED', failure_reason: 'refund window expired',
    });
    await expect(
      svc.refund('pay-10', 'idem-key-kkkkkkkkkkkkkkk', ctx),
    ).rejects.toBeInstanceOf(BadRequestException);
    // After failure, key released → retrying with a successful gateway result works
    gateway.refund.mockResolvedValueOnce({ status: 'REFUNDED', gateway_refund_id: 'rfnd_ok' });
    const ok = await svc.refund('pay-10', 'idem-key-kkkkkkkkkkkkkkk', ctx);
    expect(ok.status).toBe(PaymentStatus.REFUNDED);
  });
});
