import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RevenueIntelligenceService } from './revenue-intelligence.service';
import { CohortService } from './cohort.service';
import { SegmentService } from './segment.service';
import { BusinessMetricsService } from './business-metrics.service';
import {
  JwtAuthGuard,
  PermissionsGuard,
  Permissions,
  CurrentUser,
  JwtPayload,
} from '../common';

/**
 * Analytical / intelligence read-models: revenue mix, payment methods,
 * refunds + discounts summary, cohort retention, member segments, and
 * business KPIs (growth/retention/churn/LTV/CAC). Split out from
 * DashboardController per code-review item #4.
 */
@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardIntelligenceController {
  constructor(
    private readonly revenueIntel: RevenueIntelligenceService,
    private readonly cohorts: CohortService,
    private readonly segments: SegmentService,
    private readonly businessMetrics: BusinessMetricsService,
  ) {}

  @Get('revenue-mix')
  @Permissions({ module: 'dashboard', action: 'view' })
  getRevenueMix(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
    @Query('group_by') group_by: 'plan' | 'trainer' = 'plan',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
    return group_by === 'trainer'
      ? this.revenueIntel.getRevenueMixByTrainer(user, branch_id, range)
      : this.revenueIntel.getRevenueMixByPlan(user, branch_id, range);
  }

  @Get('payment-methods')
  @Permissions({ module: 'dashboard', action: 'view' })
  getPaymentMethods(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
    return this.revenueIntel.getPaymentMethodBreakdown(user, branch_id, range);
  }

  @Get('revenue-summary')
  @Permissions({ module: 'dashboard', action: 'view' })
  getRevenueSummary(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
    return this.revenueIntel.getRefundsDiscountsSummary(user, branch_id, range);
  }

  @Get('cohorts')
  @Permissions({ module: 'dashboard', action: 'view' })
  getCohorts(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
    @Query('months') months?: string,
  ) {
    const m = months ? Math.min(Math.max(parseInt(months, 10) || 12, 1), 12) : 12;
    return this.cohorts.getCohorts(user, branch_id, m);
  }

  @Get('segments')
  @Permissions({ module: 'dashboard', action: 'view' })
  getSegments(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
  ) {
    return this.segments.getSegments(user, branch_id);
  }

  @Get('business-metrics')
  @Permissions({ module: 'dashboard', action: 'view' })
  getBusinessMetrics(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
  ) {
    return this.businessMetrics.getBusinessMetrics(user, branch_id);
  }
}
