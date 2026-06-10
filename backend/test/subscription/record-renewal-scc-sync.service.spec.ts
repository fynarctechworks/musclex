import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionPolicyService } from '../../src/common/services/subscription-policy.service';
import { SccSyncService } from '../../src/common/services/scc-sync.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Regression test for the SCC /billing data gap.
 *
 * recordRenewal() is the SINGLE place a SaaS billing invoice is created
 * (tx.invoice.create). Previously the invoice→scc.payments mirror lived only in
 * the onboarding path, so renewals and plan-change payments never showed up on
 * the Control Center /billing page. The sync was moved INTO recordRenewal so
 * every paid invoice is mirrored exactly once, after the transaction commits.
 *
 * These tests lock that in: a successful renewal must call
 * SccSyncService.upsertPayment with the committed invoice's id/number and the
 * studio slug, mapped to a PAID payment.
 */
describe('SubscriptionPolicyService.recordRenewal → SCC payment sync', () => {
  let service: SubscriptionPolicyService;
  let prisma: any;
  let sccSync: { upsertPayment: jest.Mock };

  const studioRow = {
    id: 'studio-1',
    slug: 'iron-gym',
    subscription_plan: 'pro',
    billing_cycle: 'monthly',
    next_billing_date: new Date('2026-05-01T00:00:00Z'),
    trial_ends_at: null,
    lifecycle_status: 'grace_period',
  };

  beforeEach(async () => {
    // Self-referencing $transaction: tx === prisma. The tx surface used by
    // recordRenewal + generateInvoiceNumber is mocked below.
    prisma = {
      studio: {
        findUnique: jest.fn().mockResolvedValue(studioRow),
        update: jest.fn().mockResolvedValue({}),
      },
      subscriptionEvent: { create: jest.fn().mockResolvedValue({}) },
      invoice: {
        create: jest.fn().mockResolvedValue({
          id: 'inv-uuid-1',
          invoice_number: 'INV-20260520-0007',
        }),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockImplementation((fn: any) =>
        typeof fn === 'function' ? fn(prisma) : Promise.all(fn),
      ),
    };
    sccSync = { upsertPayment: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionPolicyService,
        { provide: PrismaService, useValue: prisma },
        { provide: SccSyncService, useValue: sccSync },
      ],
    }).compile();

    service = module.get(SubscriptionPolicyService);
  });

  afterEach(() => jest.clearAllMocks());

  it('mirrors a paid renewal into scc.payments with the committed invoice + slug', async () => {
    const result = await service.recordRenewal({
      studio_id: 'studio-1',
      actor_type: 'user',
      amount: 4999,
      currency: 'INR',
    });

    // The invoice the customer actually got…
    expect(result.invoice_id).toBe('inv-uuid-1');
    expect(result.invoice_number).toBe('INV-20260520-0007');

    // …is the exact one mirrored to SCC, as a PAID payment for this tenant.
    expect(sccSync.upsertPayment).toHaveBeenCalledTimes(1);
    expect(sccSync.upsertPayment).toHaveBeenCalledWith({
      id: 'inv-uuid-1',
      studio_slug: 'iron-gym',
      amount: 4999,
      currency: 'INR',
      status: 'paid',
      invoice_number: 'INV-20260520-0007',
      paid_at: expect.any(Date),
    });
  });

  it('syncs plan-change renewals too (amount/currency defaults applied)', async () => {
    await service.recordRenewal({
      studio_id: 'studio-1',
      new_plan: 'enterprise',
      // amount/currency omitted → default to 0 / INR
    });

    expect(sccSync.upsertPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'inv-uuid-1',
        studio_slug: 'iron-gym',
        amount: 0,
        currency: 'INR',
        status: 'paid',
      }),
    );
  });

  it('mirrors AFTER the transaction commits (not from inside the tx)', async () => {
    // If the sync fired before commit, upsertPayment would run before
    // $transaction resolved. Assert the ordering: tx resolved first.
    const order: string[] = [];
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const r = await fn(prisma);
      order.push('tx-committed');
      return r;
    });
    sccSync.upsertPayment.mockImplementation(async () => {
      order.push('sync');
    });

    await service.recordRenewal({ studio_id: 'studio-1', amount: 100 });

    expect(order).toEqual(['tx-committed', 'sync']);
  });
});
