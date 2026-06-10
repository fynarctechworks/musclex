import { ExpenseMetricsService } from '../expense-metrics.service';
import type { ExpenseEventPayload } from '../expense-events.service';

const GYM_ID = '00000000-0000-0000-0000-0000000000aa';
const BRANCH_ID = '00000000-0000-0000-0000-0000000000bb';
const CATEGORY_ID = '00000000-0000-0000-0000-0000000000dd';

/**
 * In-memory stand-in for the `expenseMetric` Prisma table.
 * Keyed by (gym_id, branch_id, period_type, period_key, category_id).
 * We implement enough of the Prisma API surface for the service to work:
 *   updateMany({ where, data }), create({ data }), findFirst, findMany.
 */
function buildMetricStore() {
  const rows: Record<string, any> = {};
  const keyOf = (w: any) =>
    `${w.gym_id}|${w.branch_id}|${w.period_type}|${w.period_key}|${w.category_id ?? 'null'}`;

  const delta = (val: any, existing: number): number => {
    if (val && typeof val === 'object' && 'increment' in val) {
      return existing + Number(val.increment);
    }
    return Number(val);
  };

  return {
    rows,
    mock: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        const k = keyOf(where);
        const row = rows[k];
        if (!row) return { count: 0 };
        row.total_amount = delta(data.total_amount, Number(row.total_amount));
        row.expense_count = delta(data.expense_count, Number(row.expense_count));
        return { count: 1 };
      }),
      create: jest.fn(async ({ data }: any) => {
        const k = keyOf(data);
        rows[k] = { ...data };
        return rows[k];
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        // Real Prisma findFirst matches *any* row satisfying the where
        // clause — not an exact composite-key lookup. The old impl keyed
        // on (gym_id|branch_id|period_type|period_key|category_id) and
        // failed when callers (e.g. getTodaySummary) omit gym_id from
        // their where.
        return (
          (Object.values(rows) as any[]).find((r) => {
            if ('gym_id' in where && r.gym_id !== where.gym_id) return false;
            if ('branch_id' in where && r.branch_id !== where.branch_id)
              return false;
            if ('period_type' in where && r.period_type !== where.period_type)
              return false;
            if ('period_key' in where && r.period_key !== where.period_key)
              return false;
            if ('category_id' in where && r.category_id !== where.category_id)
              return false;
            return true;
          }) ?? null
        );
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return Object.values(rows).filter((r: any) => {
          if (where.branch_id && r.branch_id !== where.branch_id) return false;
          if (where.period_type && r.period_type !== where.period_type) return false;
          if (where.period_key) {
            if (typeof where.period_key === 'object' && Array.isArray(where.period_key.in)) {
              if (!where.period_key.in.includes(r.period_key)) return false;
            } else if (r.period_key !== where.period_key) return false;
          }
          if (where.category_id) {
            if (where.category_id?.not === null) {
              if (r.category_id === null) return false;
            } else if (r.category_id !== where.category_id) return false;
          } else if ('category_id' in where && where.category_id === null) {
            if (r.category_id !== null) return false;
          }
          return true;
        });
      }),
    },
  };
}

function buildPrismaMock() {
  // NOTE: ExpenseMetricsService accesses `this.prisma.expenseMetric.*` /
  // `this.prisma.expense.*` / `this.prisma.expenseCategory.*` directly
  // — no `.tenant` namespace. The old shape was stale; flatten the mock.
  const store = buildMetricStore();
  const tenantExpense = {
    findMany: jest.fn().mockResolvedValue([]),
  };
  const tenantCategory = {
    findMany: jest.fn().mockResolvedValue([]),
  };
  const prisma: any = {
    expenseMetric: store.mock,
    expense: tenantExpense,
    expenseCategory: tenantCategory,
    $transaction: jest.fn(async (fn: any) =>
      fn({ expenseMetric: store.mock }),
    ),
    __store: store,
  };
  return prisma;
}

function payload(overrides: Partial<ExpenseEventPayload> = {}): ExpenseEventPayload {
  return {
    gym_id: GYM_ID,
    branch_id: BRANCH_ID,
    expense_id: 'exp-1',
    amount: 1000,
    category_id: CATEGORY_ID,
    expense_date: '2026-04-15',
    status: 'confirmed',
    ...overrides,
  };
}

describe('ExpenseMetricsService', () => {
  let prisma: any;
  let service: ExpenseMetricsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new ExpenseMetricsService(prisma);
  });

  // ──────────────────────────────────────────────────────────────
  // rollup()
  // ──────────────────────────────────────────────────────────────
  describe('rollup()', () => {
    it('writes 4 metric rows on a positive create: day/total, day/category, month/total, month/category', async () => {
      await service.rollup(payload({ amount: 1000 }));

      const rowVals = Object.values(prisma.__store.rows) as any[];
      expect(rowVals).toHaveLength(4);

      const byKey = (pt: string, cat: string | null) =>
        rowVals.find(
          (r) =>
            r.period_type === pt && (r.category_id ?? null) === cat,
        );

      expect(byKey('day', null)?.total_amount).toBe(1000);
      expect(byKey('day', CATEGORY_ID)?.total_amount).toBe(1000);
      expect(byKey('month', null)?.total_amount).toBe(1000);
      expect(byKey('month', CATEGORY_ID)?.total_amount).toBe(1000);

      expect(byKey('day', null)?.expense_count).toBe(1);
    });

    it('reversal with negative amount nets the totals back to zero', async () => {
      await service.rollup(payload({ amount: 1000, status: 'confirmed' }));
      await service.rollup(
        payload({
          amount: -1000,
          status: 'reversed',
          expense_id: 'exp-reversal',
        }),
      );

      const rowVals = Object.values(prisma.__store.rows) as any[];
      // All 4 rows should net to 0 on total_amount
      for (const r of rowVals) {
        expect(Number(r.total_amount)).toBe(0);
      }
      // Count should also net to 0 (+1 on create, -1 on reversal)
      for (const r of rowVals) {
        expect(r.expense_count).toBe(0);
      }
    });

    it('keeps per-category totals separated', async () => {
      const otherCat = '00000000-0000-0000-0000-0000000000ee';
      await service.rollup(payload({ amount: 500, category_id: CATEGORY_ID }));
      await service.rollup(payload({ amount: 300, category_id: otherCat, expense_id: 'exp-2' }));

      const rowVals = Object.values(prisma.__store.rows) as any[];
      // 2 total rows (day/total, month/total) sharing both events = 800 each
      const totals = rowVals.filter((r) => r.category_id === null);
      for (const t of totals) expect(Number(t.total_amount)).toBe(800);

      const catA = rowVals.filter((r) => r.category_id === CATEGORY_ID);
      for (const r of catA) expect(Number(r.total_amount)).toBe(500);

      const catB = rowVals.filter((r) => r.category_id === otherCat);
      for (const r of catB) expect(Number(r.total_amount)).toBe(300);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // getTodaySummary / getMonthSummary
  // ──────────────────────────────────────────────────────────────
  describe('summary reads', () => {
    it('getTodaySummary returns total and count from the day/total row', async () => {
      const today = new Date().toISOString().slice(0, 10);
      await service.rollup(payload({ amount: 250, expense_date: today }));
      await service.rollup(
        payload({ amount: 100, expense_date: today, expense_id: 'e2' }),
      );

      const out = await service.getTodaySummary(BRANCH_ID);
      expect(out.total).toBe(350);
      expect(out.count).toBe(2);
      expect(out.date).toBe(today);
    });

    it('getMonthSummary returns the month/total row for the current month when no key given', async () => {
      const month = new Date().toISOString().slice(0, 7);
      const today = `${month}-10`;
      await service.rollup(payload({ amount: 700, expense_date: today }));

      const out = await service.getMonthSummary(BRANCH_ID);
      expect(out.total).toBe(700);
      expect(out.month).toBe(month);
      expect(out.count).toBe(1);
    });

    it('getMonthSummary returns zeroes when no rows exist for the period', async () => {
      const out = await service.getMonthSummary(BRANCH_ID, '2020-01');
      expect(out.total).toBe(0);
      expect(out.count).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // recompute() — recomputes from the event stream
  // ──────────────────────────────────────────────────────────────
  describe('recompute()', () => {
    it('rebuilds metrics from raw expenses, skipping frozen pre-reversal originals', async () => {
      const fresh = buildPrismaMock();
      const svc = new ExpenseMetricsService(fresh);
      fresh.expense.findMany.mockResolvedValueOnce([
        // Original — skipped (status=reversed but no reference_id)
        {
          id: 'orig',
          gym_id: GYM_ID,
          branch_id: BRANCH_ID,
          amount: 1000,
          category_id: CATEGORY_ID,
          status: 'reversed',
          reference_id: null,
          expense_date: new Date('2026-04-15'),
        },
        // The reversal — contributes -1000
        {
          id: 'rev',
          gym_id: GYM_ID,
          branch_id: BRANCH_ID,
          amount: -1000,
          category_id: CATEGORY_ID,
          status: 'reversed',
          reference_id: 'orig',
          expense_date: new Date('2026-04-15'),
        },
        // Fresh confirmed entry — contributes +500
        {
          id: 'e3',
          gym_id: GYM_ID,
          branch_id: BRANCH_ID,
          amount: 500,
          category_id: CATEGORY_ID,
          status: 'confirmed',
          reference_id: null,
          expense_date: new Date('2026-04-15'),
        },
      ]);

      await svc.recompute(BRANCH_ID, 'day', '2026-04-15');

      const rows = Object.values(fresh.__store.rows) as any[];
      // 2 rows for day period: total (null category) + CATEGORY_ID
      expect(rows).toHaveLength(2);
      for (const r of rows) {
        expect(Number(r.total_amount)).toBe(-500); // -1000 + 500
        expect(r.expense_count).toBe(2); // 2 contributing rows
      }
    });
  });
});
