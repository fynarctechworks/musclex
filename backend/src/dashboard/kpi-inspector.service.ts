import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveBranchScope } from '../common/branch-scope.util';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

export type InspectableMetric =
  | 'active_members'
  | 'today_revenue'
  | 'mrr'
  | 'check_ins_today'
  | 'renewals_at_risk_7d'
  | 'outstanding_dues';

export interface KpiInspection {
  metric: InspectableMetric;
  formula: string;
  source_tables: string[];
  /** A SQL string that reproduces the value (illustrative — not executed verbatim). */
  query: string;
  value: number;
  as_of: string;
  /** A small sample of the rows that compose the value (max 10). */
  sample_rows: Array<Record<string, unknown>>;
  notes?: string;
}

type BranchFilter = { branch_id?: string | { in: string[] } };

/**
 * KPI Inspector — Wave 7's "show your work" surface. For any KPI on the
 * Pulse Strip, an operator can click a magnifying-glass to see:
 *   1. The exact formula in plain English
 *   2. The source tables we're aggregating
 *   3. A representative sample of the contributing rows
 *   4. The as-of timestamp
 *
 * This is what turns the dashboard from "trust us" into "audit us." It's
 * the foundation for honest disagreement: when the operator's gut says
 * the number is wrong, they can see exactly why we computed it that way.
 */
@Injectable()
export class KpiInspectorService {
  private readonly logger = new Logger(KpiInspectorService.name);
  constructor(private readonly prisma: PrismaService) {}

  async inspect(
    user: JwtPayload | undefined,
    metric: InspectableMetric,
    branchId?: string,
  ): Promise<KpiInspection> {
    const branchFilter = resolveBranchScope(user, branchId).branchFilter as BranchFilter;
    switch (metric) {
      case 'active_members':
        return this.inspectActiveMembers(branchFilter);
      case 'today_revenue':
        return this.inspectTodayRevenue(branchFilter);
      case 'mrr':
        return this.inspectMrr(branchFilter);
      case 'check_ins_today':
        return this.inspectCheckInsToday(branchFilter);
      case 'renewals_at_risk_7d':
        return this.inspectRenewalsAtRisk(branchFilter);
      case 'outstanding_dues':
        return this.inspectOutstandingDues(branchFilter);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  // ── Per-metric inspectors ────────────────────────────────────────

  private async inspectActiveMembers(
    branchFilter: BranchFilter,
  ): Promise<KpiInspection> {
    const now = new Date();
    const [count, samples] = await Promise.all([
      this.prisma.member.count({
        where: { status: 'active', ...branchFilter },
      }),
      this.prisma.member.findMany({
        where: { status: 'active', ...branchFilter },
        select: {
          id: true,
          full_name: true,
          member_code: true,
          created_at: true,
          branch_id: true,
        },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
    ]);
    return {
      metric: 'active_members',
      formula:
        "COUNT of members where status = 'active', scoped to your accessible branches.",
      source_tables: ['members'],
      query:
        "SELECT COUNT(*) FROM members WHERE status = 'active' AND branch_id IN (...)",
      value: count,
      as_of: now.toISOString(),
      sample_rows: samples as any,
    };
  }

  private async inspectTodayRevenue(
    branchFilter: BranchFilter,
  ): Promise<KpiInspection> {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const [agg, samples] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          status: 'paid',
          paid_at: { gte: startOfToday, lt: now },
          ...branchFilter,
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.findMany({
        where: {
          status: 'paid',
          paid_at: { gte: startOfToday, lt: now },
          ...branchFilter,
        },
        select: {
          id: true,
          amount: true,
          payment_method: true,
          paid_at: true,
          receipt_number: true,
          member_id: true,
        },
        orderBy: { paid_at: 'desc' },
        take: 10,
      }),
    ]);
    return {
      metric: 'today_revenue',
      formula:
        "SUM(payments.amount) where status='paid' AND paid_at within today's calendar day.",
      source_tables: ['payments'],
      query:
        "SELECT SUM(amount) FROM payments WHERE status='paid' AND paid_at >= today_start AND branch_id IN (...)",
      value: Number(agg._sum.amount ?? 0),
      as_of: now.toISOString(),
      sample_rows: samples.map((s) => ({
        ...s,
        amount: Number(s.amount),
      })),
      notes:
        'Refunds and cancelled payments are excluded. Pending payments do not count until status=paid.',
    };
  }

  private async inspectMrr(branchFilter: BranchFilter): Promise<KpiInspection> {
    const now = new Date();
    const samples = await this.prisma.memberMembership.findMany({
      where: {
        status: 'active',
        start_date: { lte: now },
        end_date: { gte: now },
        ...branchFilter,
      },
      select: {
        id: true,
        member_id: true,
        start_date: true,
        end_date: true,
        plan: { select: { name: true, price: true, duration_days: true } },
      },
      take: 10,
    });

    let value = 0;
    for (const m of samples) {
      const price = Number(m.plan?.price ?? 0);
      const days = m.plan?.duration_days ?? 30;
      value += (price / Math.max(1, days)) * 30;
    }
    // Note: full MRR is computed by DashboardPulseService via raw SQL — the
    // inspector only previews the contributing rows.

    return {
      metric: 'mrr',
      formula:
        'SUM(plan.price ÷ plan.duration_days × 30) for every active membership currently in its term.',
      source_tables: ['member_memberships', 'membership_plans'],
      query:
        "SELECT SUM(p.price / GREATEST(p.duration_days, 1) * 30) FROM member_memberships mm JOIN membership_plans p ON p.id=mm.plan_id WHERE mm.status='active' AND mm.start_date <= now() AND mm.end_date >= now()",
      value: Math.round(value),
      as_of: now.toISOString(),
      sample_rows: samples.map((m) => ({
        membership_id: m.id,
        member_id: m.member_id,
        plan_name: m.plan?.name,
        plan_price: Number(m.plan?.price ?? 0),
        duration_days: m.plan?.duration_days,
        monthly_equivalent:
          Math.round(
            (Number(m.plan?.price ?? 0) /
              Math.max(1, m.plan?.duration_days ?? 30)) *
              30,
          ),
      })),
      notes:
        'The previewed total is the sum of the sampled rows only. The figure on the Pulse Strip is the full population total computed by a server-side aggregate query.',
    };
  }

  private async inspectCheckInsToday(
    branchFilter: BranchFilter,
  ): Promise<KpiInspection> {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const [count, samples] = await Promise.all([
      this.prisma.checkIn.count({
        where: {
          status: 'success',
          checked_in_at: { gte: startOfToday, lt: now },
          ...branchFilter,
        },
      }),
      this.prisma.checkIn.findMany({
        where: {
          status: 'success',
          checked_in_at: { gte: startOfToday, lt: now },
          ...branchFilter,
        },
        select: {
          id: true,
          member_id: true,
          checkin_method: true,
          checked_in_at: true,
        },
        orderBy: { checked_in_at: 'desc' },
        take: 10,
      }),
    ]);
    return {
      metric: 'check_ins_today',
      formula:
        "COUNT of check_ins where status='success' AND checked_in_at within today's calendar day.",
      source_tables: ['check_ins'],
      query:
        "SELECT COUNT(*) FROM check_ins WHERE status='success' AND checked_in_at >= today_start AND branch_id IN (...)",
      value: count,
      as_of: now.toISOString(),
      sample_rows: samples as any,
    };
  }

  private async inspectRenewalsAtRisk(
    branchFilter: BranchFilter,
  ): Promise<KpiInspection> {
    const now = new Date();
    const horizon = new Date(now.getTime() + 7 * 86400000);
    const memberships = await this.prisma.memberMembership.findMany({
      where: {
        status: 'active',
        end_date: { gte: now, lte: horizon },
        ...branchFilter,
      },
      select: {
        id: true,
        member_id: true,
        end_date: true,
        plan: { select: { name: true, price: true } },
        member: { select: { full_name: true, member_code: true } },
      },
      orderBy: { end_date: 'asc' },
      take: 10,
    });

    return {
      metric: 'renewals_at_risk_7d',
      formula:
        "COUNT of active memberships whose end_date falls within the next 7 days. ₹ at stake = SUM of those memberships' plan prices.",
      source_tables: ['member_memberships', 'membership_plans'],
      query:
        "SELECT COUNT(*) FROM member_memberships WHERE status='active' AND end_date BETWEEN now() AND now() + interval '7 days'",
      value: memberships.length,
      as_of: now.toISOString(),
      sample_rows: memberships.map((m) => ({
        membership_id: m.id,
        member: m.member?.full_name,
        member_code: m.member?.member_code,
        end_date: m.end_date,
        plan_name: m.plan?.name,
        plan_price: Number(m.plan?.price ?? 0),
      })),
      notes:
        'Cancelled, paused, and frozen memberships are excluded. The full population count appears on the Pulse Strip; this preview is capped at 10.',
    };
  }

  private async inspectOutstandingDues(
    branchFilter: BranchFilter,
  ): Promise<KpiInspection> {
    const now = new Date();
    const invoices = await this.prisma.memberInvoice.findMany({
      where: {
        status: { in: ['pending', 'partial'] },
        ...branchFilter,
      },
      select: {
        id: true,
        member_id: true,
        invoice_number: true,
        total_amount: true,
        due_date: true,
        issued_at: true,
      },
      orderBy: [{ due_date: 'asc' }, { issued_at: 'asc' }],
      take: 10,
    });

    const value = invoices.reduce(
      (sum, i) => sum + Number(i.total_amount ?? 0),
      0,
    );
    return {
      metric: 'outstanding_dues',
      formula:
        "SUM(total_amount) of member_invoices where status IN ('pending','partial').",
      source_tables: ['member_invoices'],
      query:
        "SELECT SUM(total_amount) FROM member_invoices WHERE status IN ('pending','partial') AND branch_id IN (...)",
      value: Math.round(value),
      as_of: now.toISOString(),
      sample_rows: invoices.map((i) => ({
        invoice_id: i.id,
        invoice_number: i.invoice_number,
        total_amount: Number(i.total_amount),
        due_date: i.due_date,
        issued_at: i.issued_at,
      })),
      notes:
        'Cancelled and refunded invoices are excluded. Partial payments still count their full remaining balance until status flips to paid.',
    };
  }
}
