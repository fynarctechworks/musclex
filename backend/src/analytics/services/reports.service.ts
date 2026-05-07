import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportExportDto } from '../dto';
import { resolveBranchScope } from '../../common/branch-scope.util';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

export interface ReportUserScope {
  role: string;
  branch_ids?: string[];
  /** Optional role rows from JWT — a row with branch_id=null grants gym-wide access. */
  roles?: JwtPayload['roles'];
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Enforces branch scope: owners/brand_owners can pick any branch or "all";
   * everyone else is clamped to their assigned branch_ids.
   * Returns { branchFilter, allowedIds } or throws if request is out of scope.
   */
  private resolveBranchScope(
    dto: ReportExportDto,
    user?: ReportUserScope,
  ): { branchFilter: any; allowedIds: string[] | 'ALL' } {
    const scope = resolveBranchScope(user as JwtPayload | undefined, dto.branch_id);

    // An explicit branch_id the caller cannot access → hard-fail for reports
    // (vs. silent no-match used elsewhere). Preserves the existing API contract.
    if (dto.branch_id && !scope.hasGlobalAccess && scope.allowedIds.length === 0) {
      throw new ForbiddenException('BRANCH_NOT_ACCESSIBLE');
    }

    return { branchFilter: scope.branchFilter, allowedIds: scope.allowedIds };
  }

  async generateReport(dto: ReportExportDto, user?: ReportUserScope) {
    const data = await this.fetchReportData(dto, user);

    if (dto.format === 'csv') {
      return this.generateCsv(data, dto.report_type);
    }

    // PDF — return structured data for frontend rendering
    return { format: 'pdf', report_type: dto.report_type, data, generated_at: new Date() };
  }

  private async fetchReportData(
    dto: ReportExportDto,
    user?: ReportUserScope,
  ): Promise<Record<string, unknown>[]> {
    const startDate = dto.start_date ? new Date(dto.start_date) : this.defaultStartDate();
    const endDate = dto.end_date ? new Date(dto.end_date) : new Date();
    const scope = this.resolveBranchScope(dto, user);

    switch (dto.report_type) {
      case 'revenue':
        return this.fetchRevenueReport(dto, startDate, endDate, scope);
      case 'membership':
        return this.fetchMembershipReport(dto, startDate, endDate, scope);
      case 'attendance':
        return this.fetchAttendanceReport(dto, startDate, endDate, scope);
      case 'trainer':
        return this.fetchTrainerReport(dto, startDate, endDate, scope);
      case 'inventory':
        return this.fetchInventoryReport(dto, startDate, endDate, scope);
      case 'daily_metrics':
        return this.fetchDailyMetricsReport(dto, startDate, endDate, scope);
      default:
        return [];
    }
  }

  private async fetchRevenueReport(
    dto: ReportExportDto,
    startDate: Date,
    endDate: Date,
    scope: { branchFilter: any },
  ): Promise<Record<string, unknown>[]> {
    const where: any = {
      period_start: { gte: startDate },
      period_end: { lte: endDate },
      ...scope.branchFilter,
    };

    const records = await this.prisma.revenueAnalytics.findMany({
      where,
      orderBy: { period_start: 'desc' },
    });

    return records.map((r: any) => ({
      revenue_type: r.revenue_type,
      amount: Number(r.amount),
      transaction_count: r.transaction_count,
      period_start: r.period_start.toISOString().split('T')[0],
      period_end: r.period_end.toISOString().split('T')[0],
    }));
  }

  private async fetchMembershipReport(
    dto: ReportExportDto,
    startDate: Date,
    endDate: Date,
    scope: { branchFilter: any },
  ): Promise<Record<string, unknown>[]> {
    const where: any = {
      period_start: { gte: startDate },
      period_end: { lte: endDate },
      ...scope.branchFilter,
    };

    const records = await this.prisma.membershipAnalytics.findMany({
      where,
      include: { plan: { select: { name: true } } },
      orderBy: { period_start: 'desc' },
    });

    return records.map((r: any) => ({
      plan: (r.plan as { name: string } | null)?.name ?? 'All Plans',
      total_active: r.total_active,
      renewals: r.renewals,
      cancellations: r.cancellations,
      new_signups: r.new_signups,
      churn_rate: Number(r.churn_rate),
      period_start: r.period_start.toISOString().split('T')[0],
      period_end: r.period_end.toISOString().split('T')[0],
    }));
  }

  private async fetchAttendanceReport(
    dto: ReportExportDto,
    startDate: Date,
    endDate: Date,
    scope: { branchFilter: any },
  ): Promise<Record<string, unknown>[]> {
    const where: any = {
      date: { gte: startDate, lte: endDate },
      ...scope.branchFilter,
    };

    const records = await this.prisma.dailyGymMetrics.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return records.map((r: any) => ({
      date: r.date.toISOString().split('T')[0],
      total_visits: r.total_visits,
      active_members: r.active_members,
      classes_held: r.classes_held,
      new_members: r.new_members,
    }));
  }

  private async fetchTrainerReport(
    dto: ReportExportDto,
    startDate: Date,
    endDate: Date,
    scope: { branchFilter: any },
  ): Promise<Record<string, unknown>[]> {
    const where: any = {
      period_start: { gte: startDate },
      period_end: { lte: endDate },
      ...scope.branchFilter,
    };

    const records = await this.prisma.trainerAnalytics.findMany({
      where,
      include: { trainer: { select: { full_name: true } } },
      orderBy: { revenue_generated: 'desc' },
    });

    return records.map((r: any) => ({
      trainer: r.trainer.full_name,
      sessions_conducted: r.sessions_conducted,
      members_trained: r.members_trained,
      average_rating: Number(r.average_rating),
      revenue_generated: Number(r.revenue_generated),
      period_start: r.period_start.toISOString().split('T')[0],
      period_end: r.period_end.toISOString().split('T')[0],
    }));
  }

  private async fetchInventoryReport(
    dto: ReportExportDto,
    startDate: Date,
    endDate: Date,
    scope: { branchFilter: any },
  ): Promise<Record<string, unknown>[]> {
    const where: any = {
      sale_date: { gte: startDate, lte: endDate },
      ...scope.branchFilter,
    };

    const records = await this.prisma.posSale.findMany({
      where,
      include: {
        items: { include: { product: { select: { product_name: true } } } },
      },
      orderBy: { created_at: 'desc' },
      take: 500,
    });

    return records.map((r: any) => ({
      sale_id: r.id,
      sale_date: r.created_at.toISOString().split('T')[0],
      total_amount: Number(r.total_amount),
      payment_method: r.payment_method,
      items: (r.items as Array<{ product?: { product_name: string }; quantity: number }>).map(
        (i) => `${i.product?.product_name ?? 'Unknown'} x${i.quantity}`,
      ).join(', '),
    }));
  }

  private async fetchDailyMetricsReport(
    dto: ReportExportDto,
    startDate: Date,
    endDate: Date,
    scope: { branchFilter: any },
  ): Promise<Record<string, unknown>[]> {
    const where: any = {
      date: { gte: startDate, lte: endDate },
      ...scope.branchFilter,
    };

    const records = await this.prisma.dailyGymMetrics.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return records.map((r: any) => ({
      date: r.date.toISOString().split('T')[0],
      total_revenue: Number(r.total_revenue),
      new_members: r.new_members,
      active_members: r.active_members,
      total_visits: r.total_visits,
      classes_held: r.classes_held,
      products_sold: r.products_sold,
    }));
  }

  // ─── CSV Generation ──────────────────────────────────────────

  private generateCsv(data: Record<string, unknown>[], reportType: string): {
    format: string;
    report_type: string;
    content: string;
    filename: string;
    mime_type: string;
    generated_at: Date;
  } {
    if (data.length === 0) {
      return {
        format: 'csv',
        report_type: reportType,
        content: '',
        filename: `${reportType}_report_${Date.now()}.csv`,
        mime_type: 'text/csv',
        generated_at: new Date(),
      };
    }

    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        const str = String(val ?? '');
        // Escape CSV values containing commas or quotes
        return str.includes(',') || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(','),
    );

    const content = [headers.join(','), ...rows].join('\n');

    return {
      format: 'csv',
      report_type: reportType,
      content,
      filename: `${reportType}_report_${Date.now()}.csv`,
      mime_type: 'text/csv',
      generated_at: new Date(),
    };
  }

  private defaultStartDate(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d;
  }
}
