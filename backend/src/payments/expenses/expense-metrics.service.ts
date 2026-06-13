import { Injectable, Logger } from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import type { ExpenseEventPayload } from './expense-events.service';

/**
 * Pre-computed rollups for fast dashboard reads.
 *
 * Schema: (gym_id, branch_id, period_type, period_key, category_id)
 *   period_type = 'day'    → period_key = '2026-04-15'
 *   period_type = 'month'  → period_key = '2026-04'
 *   category_id = null     → "total across all categories" row
 *
 * Every expense event produces FOUR metric deltas:
 *   day/total, day/category, month/total, month/category
 *
 * Amounts are signed — reversals (negative) naturally decrement the totals.
 */
@Injectable()
export class ExpenseMetricsService {
  private readonly logger = new Logger(ExpenseMetricsService.name);

  constructor(private readonly tenant: TenantPrisma) {}

  // ───────────────────────────────────────────────────────────────
  // Incremental rollup from event payload
  // ───────────────────────────────────────────────────────────────
  async rollup(evt: ExpenseEventPayload): Promise<void> {
    const dayKey = evt.expense_date; // yyyy-mm-dd
    const monthKey = evt.expense_date.slice(0, 7); // yyyy-mm

    // 4 upserts — wrap in transaction for atomicity
    try {
      await this.tenant.client.$transaction(async (tx) => {
        await this.upsert(tx, evt, 'day', dayKey, null);
        await this.upsert(tx, evt, 'day', dayKey, evt.category_id);
        await this.upsert(tx, evt, 'month', monthKey, null);
        await this.upsert(tx, evt, 'month', monthKey, evt.category_id);
      });
    } catch (err) {
      // Metrics are recomputable from the event stream — log and continue.
      this.logger.error(
        `rollup failed for expense=${evt.expense_id}: ${(err as Error).message}`,
      );
    }
  }

  private async upsert(
    tx: any,
    evt: ExpenseEventPayload,
    periodType: 'day' | 'month',
    periodKey: string,
    categoryId: string | null,
  ) {
    // Try update first (fast path); insert only when row missing.
    const updated = await tx.expenseMetric.updateMany({
      where: {
        gym_id: evt.gym_id,
        branch_id: evt.branch_id,
        period_type: periodType,
        period_key: periodKey,
        category_id: categoryId,
      },
      data: {
        total_amount: { increment: evt.amount },
        expense_count: { increment: evt.amount >= 0 ? 1 : -1 },
      },
    });

    if (updated.count === 0) {
      await tx.expenseMetric.create({
        data: {
          gym_id: evt.gym_id,
          branch_id: evt.branch_id,
          period_type: periodType,
          period_key: periodKey,
          category_id: categoryId,
          total_amount: evt.amount,
          expense_count: evt.amount >= 0 ? 1 : 0,
        },
      });
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Read APIs (used by summary + intelligence endpoints)
  // ───────────────────────────────────────────────────────────────
  async getTodaySummary(branchId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const row = await this.tenant.client.expenseMetric.findFirst({
      where: { branch_id: branchId, period_type: 'day', period_key: today, category_id: null },
    });
    return {
      date: today,
      total: Number(row?.total_amount ?? 0),
      count: row?.expense_count ?? 0,
    };
  }

  async getMonthSummary(branchId: string, yyyyMm?: string) {
    const key = yyyyMm ?? new Date().toISOString().slice(0, 7);
    const row = await this.tenant.client.expenseMetric.findFirst({
      where: { branch_id: branchId, period_type: 'month', period_key: key, category_id: null },
    });
    return {
      month: key,
      total: Number(row?.total_amount ?? 0),
      count: row?.expense_count ?? 0,
    };
  }

  async getCategoryDistribution(branchId: string, yyyyMm?: string) {
    const key = yyyyMm ?? new Date().toISOString().slice(0, 7);
    const rows = await this.tenant.client.expenseMetric.findMany({
      where: {
        branch_id: branchId,
        period_type: 'month',
        period_key: key,
        category_id: { not: null },
      },
    });
    // Attach category labels
    const ids = rows.map((r) => r.category_id!).filter(Boolean);
    const cats = await this.tenant.client.expenseCategory.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, slug: true, color: true },
    });
    const catMap = new Map(cats.map((c) => [c.id, c]));
    return rows
      .map((r) => ({
        category_id: r.category_id,
        name: catMap.get(r.category_id!)?.name ?? 'Unknown',
        slug: catMap.get(r.category_id!)?.slug ?? null,
        color: catMap.get(r.category_id!)?.color ?? null,
        total: Number(r.total_amount),
        count: r.expense_count,
      }))
      .sort((a, b) => b.total - a.total);
  }

  async getMonthlyTrend(branchId: string, months: number = 6) {
    // Build list of yyyy-mm keys for the last N months (inclusive)
    const now = new Date();
    const keys: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(d.toISOString().slice(0, 7));
    }
    const rows = await this.tenant.client.expenseMetric.findMany({
      where: {
        branch_id: branchId,
        period_type: 'month',
        period_key: { in: keys },
        category_id: null,
      },
    });
    const byKey = new Map(rows.map((r) => [r.period_key, r]));
    return keys.map((k) => ({
      month: k,
      total: Number(byKey.get(k)?.total_amount ?? 0),
      count: byKey.get(k)?.expense_count ?? 0,
    }));
  }

  // ───────────────────────────────────────────────────────────────
  // Full recompute — fallback / admin tool
  // ───────────────────────────────────────────────────────────────
  async recompute(
    branchId: string,
    periodType: 'day' | 'month',
    periodKey: string,
  ): Promise<void> {
    const dateFilter =
      periodType === 'day'
        ? { gte: new Date(periodKey), lt: addDays(new Date(periodKey), 1) }
        : monthRange(periodKey);
    const expenses = await this.tenant.client.expense.findMany({
      where: { branch_id: branchId, expense_date: dateFilter },
    });

    // Compute total + per-category
    let total = 0;
    let count = 0;
    const byCategory = new Map<string | null, { total: number; count: number }>();
    for (const e of expenses) {
      // skip the pre-reversal "original" row that has been flipped (reference_id is null but status='reversed')
      const contributes = !(e.status === 'reversed' && !e.reference_id);
      if (!contributes) continue;
      const amount = Number(e.amount);
      total += amount;
      count += 1;
      const catKey = e.category_id ?? null;
      const agg = byCategory.get(catKey) ?? { total: 0, count: 0 };
      agg.total += amount;
      agg.count += 1;
      byCategory.set(catKey, agg);
    }

    await this.tenant.client.$transaction(async (tx) => {
      const gymId = expenses[0]?.gym_id;
      if (!gymId) return;
      // Total row
      await this.upsertExact(tx, {
        gym_id: gymId,
        branch_id: branchId,
        period_type: periodType,
        period_key: periodKey,
        category_id: null,
        total_amount: total,
        expense_count: count,
      });
      for (const [catKey, agg] of byCategory) {
        await this.upsertExact(tx, {
          gym_id: gymId,
          branch_id: branchId,
          period_type: periodType,
          period_key: periodKey,
          category_id: catKey,
          total_amount: agg.total,
          expense_count: agg.count,
        });
      }
    });
  }

  private async upsertExact(
    tx: any,
    data: {
      gym_id: string;
      branch_id: string;
      period_type: string;
      period_key: string;
      category_id: string | null;
      total_amount: number;
      expense_count: number;
    },
  ) {
    const updated = await tx.expenseMetric.updateMany({
      where: {
        gym_id: data.gym_id,
        branch_id: data.branch_id,
        period_type: data.period_type,
        period_key: data.period_key,
        category_id: data.category_id,
      },
      data: { total_amount: data.total_amount, expense_count: data.expense_count },
    });
    if (updated.count === 0) {
      await tx.expenseMetric.create({ data });
    }
  }
}

// Local helpers — kept inside the file to avoid pulling extra deps
function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function monthRange(yyyyMm: string): { gte: Date; lt: Date } {
  const [y, m] = yyyyMm.split('-').map(Number);
  return {
    gte: new Date(y, m - 1, 1),
    lt: new Date(y, m, 1),
  };
}
