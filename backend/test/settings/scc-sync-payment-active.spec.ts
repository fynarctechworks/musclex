import { Test, TestingModule } from '@nestjs/testing';
import { SccSyncService } from '../../src/common/services/scc-sync.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Direct coverage for the SCC sync methods not exercised by the status-map /
 * recordRenewal specs: upsertPayment (invoice→scc.payments status mapping),
 * touchLastActive (login activity bump), and the non-fatal contract (a sync
 * failure must never throw into the caller's request path).
 */
describe('SccSyncService — payments + last-active + resilience', () => {
  let service: SccSyncService;
  let prisma: { $executeRawUnsafe: jest.Mock };

  beforeEach(async () => {
    prisma = { $executeRawUnsafe: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [SccSyncService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(SccSyncService);
  });

  afterEach(() => jest.clearAllMocks());

  // upsertPayment binds paymentStatus to positional arg $4 → calls[0][4].
  const lastPaymentStatus = () => prisma.$executeRawUnsafe.mock.calls.at(-1)?.[4];

  const upsert = (status: string) =>
    service.upsertPayment({
      id: 'inv-1',
      studio_slug: 'iron-gym',
      amount: 4999,
      currency: 'INR',
      status,
      invoice_number: 'INV-1',
      paid_at: new Date(),
    });

  describe('upsertPayment status mapping', () => {
    it('paid → PAID', async () => { await upsert('paid'); expect(lastPaymentStatus()).toBe('PAID'); });
    it('failed → FAILED', async () => { await upsert('failed'); expect(lastPaymentStatus()).toBe('FAILED'); });
    it('refunded → REFUNDED', async () => { await upsert('refunded'); expect(lastPaymentStatus()).toBe('REFUNDED'); });
    it('unknown → PENDING', async () => { await upsert('whatever'); expect(lastPaymentStatus()).toBe('PENDING'); });

    it('targets the tenant by slug (last positional arg)', async () => {
      await upsert('paid');
      const call = prisma.$executeRawUnsafe.mock.calls.at(-1)!;
      expect(call[1]).toBe('inv-1');          // $1 = invoice id (scc.payments.id)
      expect(call[6]).toBe('iron-gym');       // $6 = studio slug
    });
  });

  describe('touchLastActive', () => {
    it('bumps last_active_at for the given slug', async () => {
      await service.touchLastActive('iron-gym');
      const call = prisma.$executeRawUnsafe.mock.calls.at(-1)!;
      expect(String(call[0])).toMatch(/last_active_at\s*=\s*now\(\)/i);
      expect(call[1]).toBe('iron-gym');
    });
  });

  describe('non-fatal contract', () => {
    it('upsertPayment swallows DB errors (never throws)', async () => {
      prisma.$executeRawUnsafe.mockRejectedValueOnce(new Error('scc unreachable'));
      await expect(upsert('paid')).resolves.toBeUndefined();
    });
    it('touchLastActive swallows DB errors (never throws)', async () => {
      prisma.$executeRawUnsafe.mockRejectedValueOnce(new Error('scc unreachable'));
      await expect(service.touchLastActive('iron-gym')).resolves.toBeUndefined();
    });
  });
});
