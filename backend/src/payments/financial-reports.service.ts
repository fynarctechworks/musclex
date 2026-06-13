import { Injectable } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';

@Injectable()
export class FinancialReportsService {
  constructor(private tenant: TenantPrisma) {}

  async getDailyRevenue(branchId: string, date: string) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const payments = await this.tenant.client.payment.findMany({
      where: {
        branch_id: branchId,
        status: 'paid',
        paid_at: { gte: dayStart, lte: dayEnd },
      },
      select: { amount: true, payment_method: true },
    });

    const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const byMethod: Record<string, number> = {};
    for (const p of payments) {
      byMethod[p.payment_method] = (byMethod[p.payment_method] || 0) + Number(p.amount);
    }

    return {
      date,
      branch_id: branchId,
      total_revenue: total,
      transaction_count: payments.length,
      by_payment_method: byMethod,
    };
  }

  async getMonthlyRevenue(branchId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const [payments, refunds, expenses] = await Promise.all([
      this.tenant.client.payment.findMany({
        where: {
          branch_id: branchId,
          status: 'paid',
          paid_at: { gte: startDate, lte: endDate },
        },
        select: { amount: true, payment_method: true, paid_at: true },
      }),
      this.tenant.client.refund.findMany({
        where: {
          payment: { branch_id: branchId },
          status: 'processed',
          processed_at: { gte: startDate, lte: endDate },
        },
        select: { refund_amount: true },
      }),
      this.tenant.client.expense.findMany({
        where: {
          branch_id: branchId,
          expense_date: { gte: startDate, lte: endDate },
        },
        select: { amount: true, category: true },
      }),
    ]);

    const grossRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
    const totalRefunds = refunds.reduce((s, r) => s + Number(r.refund_amount), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

    // Revenue by day
    const dailyRevenue: Record<string, number> = {};
    for (const p of payments) {
      const day = p.paid_at!.toISOString().slice(0, 10);
      dailyRevenue[day] = (dailyRevenue[day] || 0) + Number(p.amount);
    }

    // Revenue by payment method
    const byMethod: Record<string, number> = {};
    for (const p of payments) {
      byMethod[p.payment_method] = (byMethod[p.payment_method] || 0) + Number(p.amount);
    }

    // Expenses by category
    const expensesByCategory: Record<string, number> = {};
    for (const e of expenses) {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.amount);
    }

    return {
      period: `${year}-${String(month).padStart(2, '0')}`,
      branch_id: branchId,
      gross_revenue: grossRevenue,
      total_refunds: totalRefunds,
      net_revenue: grossRevenue - totalRefunds,
      total_expenses: totalExpenses,
      profit: grossRevenue - totalRefunds - totalExpenses,
      transaction_count: payments.length,
      by_payment_method: byMethod,
      daily_revenue: dailyRevenue,
      expenses_by_category: expensesByCategory,
    };
  }

  async getDashboardMetrics(branchId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
      currentMonthPayments,
      prevMonthPayments,
      pendingPayments,
      currentMonthRefunds,
      totalMembers,
      activeSubscriptions,
    ] = await Promise.all([
      this.tenant.client.payment.findMany({
        where: { branch_id: branchId, status: 'paid', paid_at: { gte: startOfMonth } },
        select: { amount: true },
      }),
      this.tenant.client.payment.findMany({
        where: { branch_id: branchId, status: 'paid', paid_at: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
        select: { amount: true },
      }),
      this.tenant.client.payment.count({
        where: { branch_id: branchId, status: 'pending' },
      }),
      this.tenant.client.refund.findMany({
        where: { payment: { branch_id: branchId }, status: 'processed', processed_at: { gte: startOfMonth } },
        select: { refund_amount: true },
      }),
      this.tenant.client.member.count({
        where: { branch_id: branchId, status: { in: ['active', 'trial'] } },
      }),
      this.tenant.client.memberMembership.count({
        where: { branch_id: branchId, status: 'active' },
      }),
    ]);

    const currentRevenue = currentMonthPayments.reduce((s, p) => s + Number(p.amount), 0);
    const prevRevenue = prevMonthPayments.reduce((s, p) => s + Number(p.amount), 0);
    const refundTotal = currentMonthRefunds.reduce((s, r) => s + Number(r.refund_amount), 0);

    const revenueGrowth = prevRevenue > 0
      ? Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100)
      : 0;

    return {
      total_revenue_this_month: currentRevenue,
      total_revenue_prev_month: prevRevenue,
      revenue_growth_percent: revenueGrowth,
      pending_payments: pendingPayments,
      refund_total_this_month: refundTotal,
      refund_rate: currentMonthPayments.length > 0
        ? Math.round((currentMonthRefunds.length / currentMonthPayments.length) * 100)
        : 0,
      active_members: totalMembers,
      active_subscriptions: activeSubscriptions,
      average_member_value: totalMembers > 0
        ? Math.round(currentRevenue / totalMembers)
        : 0,
      monthly_recurring_revenue: currentRevenue,
    };
  }

  async getMembershipRevenue(branchId: string, dateFrom?: string, dateTo?: string) {
    const where: any = {
      branch_id: branchId,
      status: 'paid',
      membership_id: { not: null },
    };
    if (dateFrom || dateTo) {
      where.paid_at = {};
      if (dateFrom) where.paid_at.gte = new Date(dateFrom);
      if (dateTo) where.paid_at.lte = new Date(dateTo);
    }

    const payments = await this.tenant.client.payment.findMany({
      where,
      include: {
        membership: {
          include: { plan: { select: { id: true, name: true, plan_type: true } } },
        },
      },
    });

    const byPlan: Record<string, { plan_name: string; count: number; revenue: number }> = {};
    for (const p of payments) {
      const planName = p.membership?.plan?.name || 'Unknown';
      const planId = p.membership?.plan?.id || 'unknown';
      if (!byPlan[planId]) {
        byPlan[planId] = { plan_name: planName, count: 0, revenue: 0 };
      }
      byPlan[planId].count++;
      byPlan[planId].revenue += Number(p.amount);
    }

    return {
      branch_id: branchId,
      total_membership_revenue: payments.reduce((s, p) => s + Number(p.amount), 0),
      total_transactions: payments.length,
      by_plan: Object.values(byPlan),
    };
  }

  async getFinancialLedger(filters?: {
    branch_id?: string;
    reference_type?: string;
    transaction_type?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 50 } = filters || {};
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.branch_id) where.branch_id = filters.branch_id;
    if (filters?.reference_type) where.reference_type = filters.reference_type;
    if (filters?.transaction_type) where.transaction_type = filters.transaction_type;
    if (filters?.date_from || filters?.date_to) {
      where.created_at = {};
      if (filters?.date_from) where.created_at.gte = new Date(filters.date_from);
      if (filters?.date_to) where.created_at.lte = new Date(filters.date_to);
    }

    const [data, total] = await Promise.all([
      this.tenant.client.financialTransaction.findMany({
        where,
        include: { branch: { select: { id: true, name: true } } },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.tenant.client.financialTransaction.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
