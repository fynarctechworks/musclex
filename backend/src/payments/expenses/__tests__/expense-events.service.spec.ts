import { BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { tenantContext } from '../../../common/tenant-context';
import {
  EXPENSE_CREATED_EVENT,
  EXPENSE_REVERSED_EVENT,
  ExpenseEventsService,
} from '../expense-events.service';

// ─── Helpers ─────────────────────────────────────────────────────
const GYM_ID = '00000000-0000-0000-0000-0000000000aa';
const BRANCH_ID = '00000000-0000-0000-0000-0000000000bb';
const STAFF_ID = '00000000-0000-0000-0000-0000000000cc';
const CATEGORY_ID = '00000000-0000-0000-0000-0000000000dd';

function withTenant<T>(fn: () => Promise<T> | T): Promise<T> | T {
  return tenantContext.run({ gymId: GYM_ID, branchId: BRANCH_ID } as any, fn);
}

function makeExpenseRow(overrides: Partial<any> = {}) {
  return {
    id: 'exp-1',
    gym_id: GYM_ID,
    branch_id: BRANCH_ID,
    category: 'rent',
    category_id: CATEGORY_ID,
    description: 'April rent',
    amount: 1000,
    currency: 'INR',
    expense_date: new Date('2026-04-15T00:00:00Z'),
    receipt_url: null,
    vendor: null,
    notes: null,
    payment_method: 'cash',
    status: 'confirmed',
    reference_id: null,
    idempotency_key: null,
    recorded_by_staff_id: STAFF_ID,
    created_at: new Date(),
    ...overrides,
  };
}

// Build a chainable fake prisma client that covers the surfaces used by
// ExpenseEventsService: prisma.expense.*, prisma.expenseCategory.*,
// and prisma.$transaction(async (tx) => ...).
function buildPrismaMock(opts: {
  tenantExpense?: Partial<any>;
  tenantCategory?: Partial<any>;
  txExpense?: Partial<any>;
  txFinancial?: Partial<any>;
} = {}) {
  const tenantExpense = {
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(makeExpenseRow()),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    ...opts.tenantExpense,
  };
  const tenantCategory = {
    findUnique: jest.fn().mockResolvedValue({ id: CATEGORY_ID, slug: 'rent' }),
    ...opts.tenantCategory,
  };
  const txExpense = {
    create: jest.fn().mockResolvedValue(makeExpenseRow()),
    update: jest.fn().mockResolvedValue(makeExpenseRow({ status: 'reversed' })),
    ...opts.txExpense,
  };
  const txFinancial = {
    create: jest.fn().mockResolvedValue({ id: 'ft-1' }),
    ...opts.txFinancial,
  };

  const prisma: any = {
    tenant: {
      expense: tenantExpense,
      expenseCategory: tenantCategory,
    },
    $transaction: jest.fn(async (fn: any) =>
      fn({ expense: txExpense, financialTransaction: txFinancial }),
    ),
    __mocks: { tenantExpense, tenantCategory, txExpense, txFinancial },
  };
  return prisma;
}

function buildCategoriesMock() {
  return {
    findBySlug: jest
      .fn()
      .mockResolvedValue({ id: CATEGORY_ID, slug: 'rent', name: 'Rent' }),
    ensureDefaultsForBranch: jest.fn().mockResolvedValue(undefined),
  } as any;
}

describe('ExpenseEventsService', () => {
  let prisma: any;
  let categories: any;
  let events: EventEmitter2;
  let service: ExpenseEventsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    categories = buildCategoriesMock();
    events = new EventEmitter2();
    service = new ExpenseEventsService(prisma, categories, events);
  });

  // ──────────────────────────────────────────────────────────────
  // createExpense()
  // ──────────────────────────────────────────────────────────────
  describe('createExpense()', () => {
    it('creates an expense, writes a debit ledger row, and emits expense.created', async () => {
      const emitSpy = jest.spyOn(events, 'emit');

      await withTenant(() =>
        service.createExpense(
          {
            branch_id: BRANCH_ID,
            category: 'rent',
            description: 'April rent',
            amount: 1000,
            expense_date: '2026-04-15',
            payment_method: 'cash',
          } as any,
          { staff_id: STAFF_ID },
        ),
      );

      // 1. Prisma.create on expense was invoked with signed-positive amount + status=confirmed
      const createCall = prisma.__mocks.txExpense.create.mock.calls[0][0];
      expect(createCall.data).toMatchObject({
        gym_id: GYM_ID,
        branch_id: BRANCH_ID,
        amount: 1000,
        status: 'confirmed',
        category_id: CATEGORY_ID,
      });

      // 2. Ledger debit row written in same tx
      const ftCall = prisma.__mocks.txFinancial.create.mock.calls[0][0];
      expect(ftCall.data).toMatchObject({
        reference_type: 'expense',
        transaction_type: 'debit',
        amount: 1000,
      });

      // 3. Event emitted
      expect(emitSpy).toHaveBeenCalledWith(
        EXPENSE_CREATED_EVENT,
        expect.objectContaining({
          gym_id: GYM_ID,
          branch_id: BRANCH_ID,
          amount: 1000,
          status: 'confirmed',
        }),
      );
    });

    it('returns the existing row when the same idempotency_key is replayed', async () => {
      const existing = makeExpenseRow({ id: 'exp-already-there' });
      prisma.__mocks.tenantExpense.findFirst.mockResolvedValueOnce(existing);

      const result: any = await withTenant(() =>
        service.createExpense(
          {
            branch_id: BRANCH_ID,
            category: 'rent',
            description: 'dup',
            amount: 1000,
            expense_date: '2026-04-15',
            idempotency_key: 'abc-123',
          } as any,
          { staff_id: STAFF_ID },
        ),
      );

      expect(result.id).toBe('exp-already-there');
      // No transaction occurred because we short-circuited.
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws when amount is not positive', async () => {
      await expect(
        withTenant(() =>
          service.createExpense(
            {
              branch_id: BRANCH_ID,
              category: 'rent',
              description: 'bad',
              amount: 0,
              expense_date: '2026-04-15',
            } as any,
            { staff_id: STAFF_ID },
          ),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when tenant context is missing', async () => {
      // No tenantContext.run wrapper — simulates a bare call.
      await expect(
        service.createExpense(
          {
            branch_id: BRANCH_ID,
            category: 'rent',
            description: 'no tenant',
            amount: 1000,
            expense_date: '2026-04-15',
          } as any,
          { staff_id: STAFF_ID },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // reverseExpense()
  // ──────────────────────────────────────────────────────────────
  describe('reverseExpense()', () => {
    it('creates a negated reversal, flips original status, writes credit ledger row, and emits expense.reversed', async () => {
      const original = makeExpenseRow({
        id: 'exp-original',
        amount: 1000,
        status: 'confirmed',
        reference_id: null,
      });
      prisma.__mocks.tenantExpense.findUnique.mockImplementation(
        async ({ where }: any) => {
          if (where.id === 'exp-original') {
            return { ...original, reversed_by: [] };
          }
          // Second call re-reads the reversal row for the return value.
          return makeExpenseRow({
            id: 'exp-reversal',
            amount: -1000,
            status: 'reversed',
            reference_id: 'exp-original',
          });
        },
      );
      prisma.__mocks.txExpense.create.mockResolvedValue(
        makeExpenseRow({ id: 'exp-reversal', amount: -1000 }),
      );
      const emitSpy = jest.spyOn(events, 'emit');

      await withTenant(() =>
        service.reverseExpense(
          'exp-original',
          { reason: 'duplicate entry' },
          { staff_id: STAFF_ID },
        ),
      );

      const createArgs = prisma.__mocks.txExpense.create.mock.calls[0][0].data;
      expect(createArgs).toMatchObject({
        amount: -1000,
        status: 'reversed',
        reference_id: 'exp-original',
      });

      // Original flipped
      const updateArgs = prisma.__mocks.txExpense.update.mock.calls[0][0];
      expect(updateArgs).toMatchObject({
        where: { id: 'exp-original' },
        data: { status: 'reversed' },
      });

      // Credit ledger
      const ftArgs = prisma.__mocks.txFinancial.create.mock.calls[0][0].data;
      expect(ftArgs).toMatchObject({
        transaction_type: 'credit',
        amount: 1000,
      });

      expect(emitSpy).toHaveBeenCalledWith(
        EXPENSE_REVERSED_EVENT,
        expect.objectContaining({
          expense_id: 'exp-reversal',
          amount: -1000,
          status: 'reversed',
        }),
      );
    });

    it('refuses to reverse an already-reversed expense', async () => {
      const original = makeExpenseRow({ id: 'exp-x', status: 'reversed' });
      prisma.__mocks.tenantExpense.findUnique.mockResolvedValueOnce({
        ...original,
        reversed_by: [],
      });

      await expect(
        withTenant(() =>
          service.reverseExpense('exp-x', {}, { staff_id: STAFF_ID }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses to reverse a reversal entry (no reversal-of-reversal chains)', async () => {
      const reversalRow = makeExpenseRow({
        id: 'exp-rev',
        reference_id: 'exp-source',
        amount: -1000,
        status: 'reversed',
      });
      // The guard checks status first, so return status='confirmed' but with reference_id set
      // to exercise the second branch.
      prisma.__mocks.tenantExpense.findUnique.mockResolvedValueOnce({
        ...reversalRow,
        status: 'confirmed',
        reversed_by: [],
      });

      await expect(
        withTenant(() =>
          service.reverseExpense('exp-rev', {}, { staff_id: STAFF_ID }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // getTimeline()
  // ──────────────────────────────────────────────────────────────
  describe('getTimeline()', () => {
    it('groups expenses by calendar day, newest first', async () => {
      const rows = [
        makeExpenseRow({ id: 'a', expense_date: new Date('2026-04-15'), amount: 100 }),
        makeExpenseRow({ id: 'b', expense_date: new Date('2026-04-15'), amount: 50 }),
        makeExpenseRow({ id: 'c', expense_date: new Date('2026-04-14'), amount: 200 }),
      ];
      prisma.__mocks.tenantExpense.findMany.mockResolvedValueOnce(rows);
      prisma.__mocks.tenantExpense.count.mockResolvedValueOnce(rows.length);

      const out = await withTenant(() =>
        service.getTimeline({ branch_id: BRANCH_ID } as any),
      );

      expect(out.groups).toHaveLength(2);
      // Newest-first ordering
      expect(out.groups[0].date).toBe('2026-04-15');
      expect(out.groups[1].date).toBe('2026-04-14');
      expect(out.groups[0].count).toBe(2);
      expect(out.groups[0].total).toBe(150);
      expect(out.groups[1].total).toBe(200);
    });

    it('excludes pre-reversal frozen originals from the day total', async () => {
      const rows = [
        // Original that has been reversed (reference_id=null but status=reversed) — skipped
        makeExpenseRow({
          id: 'orig',
          amount: 100,
          status: 'reversed',
          reference_id: null,
        }),
        // The reversal row — included (status=reversed AND has reference_id)
        makeExpenseRow({
          id: 'rev',
          amount: -100,
          status: 'reversed',
          reference_id: 'orig',
        }),
      ];
      prisma.__mocks.tenantExpense.findMany.mockResolvedValueOnce(rows);
      prisma.__mocks.tenantExpense.count.mockResolvedValueOnce(rows.length);

      const out = await withTenant(() =>
        service.getTimeline({ branch_id: BRANCH_ID } as any),
      );

      expect(out.groups[0].total).toBe(-100);
      expect(out.groups[0].count).toBe(2);
    });
  });
});
