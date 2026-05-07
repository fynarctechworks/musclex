import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { DashboardPulseService } from './dashboard-pulse.service';
import { TrainerCockpitService } from './trainer-cockpit.service';
import { PortfolioService } from './portfolio.service';
import { BriefingService } from './briefing.service';
import {
  KpiInspectorService,
  type InspectableMetric,
} from './kpi-inspector.service';
import { KpiSnapshotService } from './kpi-snapshot.service';
import { EventProjectorService } from '../events/event-projector.service';
import { ResourceLimitService } from '../common/services/resource-limit.service';
import {
  JwtAuthGuard,
  PermissionsGuard,
  Permissions,
  CurrentUser,
  JwtPayload,
} from '../common';

/**
 * Core dashboard read-models: Pulse Strip (Wave 1), KPI summary, revenue
 * trend, activity feed, alerts, branch comparison, setup status, AI briefing
 * (Wave 5), KPI Inspector + Restatements (Wave 7), Portfolio (Wave 4),
 * trainer cockpit, plan usage, and the metrics maintenance endpoints.
 *
 * Other route groups have their own controllers (each at the same
 * `/api/v1/dashboard` prefix — NestJS merges them):
 *   - DashboardActionsController        — actions, push/*
 *   - DashboardOpsController            — occupancy, today-classes, heatmap, system-status, inventory
 *   - DashboardIntelligenceController   — revenue-mix, payment-methods, revenue-summary, cohorts, segments, business-metrics
 *   - DashboardLayoutController         — tiles, layout GET/PUT/reset
 */
@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly metricsService: DashboardMetricsService,
    private readonly pulseService: DashboardPulseService,
    private readonly trainerCockpit: TrainerCockpitService,
    private readonly portfolio: PortfolioService,
    private readonly briefing: BriefingService,
    private readonly inspector: KpiInspectorService,
    private readonly snapshots: KpiSnapshotService,
    private readonly projector: EventProjectorService,
    private readonly resourceLimits: ResourceLimitService,
  ) {}

  // ── Hero zone ────────────────────────────────────────────────────

  @Get('kpis')
  @Permissions({ module: 'dashboard', action: 'view' })
  getKpis(@CurrentUser() user: JwtPayload, @Query('branch_id') branch_id?: string) {
    return this.dashboardService.getKpis(user, branch_id);
  }

  /**
   * Pulse Strip — the 6 canonical KPIs with deltas + sparklines + freshness.
   * The dashboard's hero zone (Wave 1).
   */
  @Get('pulse')
  @Permissions({ module: 'dashboard', action: 'view' })
  getPulse(@CurrentUser() user: JwtPayload, @Query('branch_id') branch_id?: string) {
    return this.pulseService.getPulse(user, branch_id);
  }

  @Get('revenue-chart')
  @Permissions({ module: 'dashboard', action: 'view' })
  getRevenueChart(
    @CurrentUser() user: JwtPayload,
    @Query('months') months?: string,
    @Query('branch_id') branch_id?: string,
  ) {
    const monthCount = months ? Math.min(Math.max(parseInt(months, 10) || 12, 1), 24) : 12;
    return this.dashboardService.getRevenueChart(user, monthCount, branch_id);
  }

  @Get('activity-feed')
  @Permissions({ module: 'dashboard', action: 'view' })
  getActivityFeed(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getActivityFeed(
      user,
      branch_id,
      limit ? parseInt(limit) : undefined,
    );
  }

  @Get('alerts')
  @Permissions({ module: 'dashboard', action: 'view' })
  getAlerts(@CurrentUser() user: JwtPayload, @Query('branch_id') branch_id?: string) {
    return this.dashboardService.getAlerts(user, branch_id);
  }

  @Get('branch-comparison')
  @Permissions({ module: 'dashboard', action: 'view' })
  getBranchComparison(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getBranchComparison(user);
  }

  @Get('setup-status')
  @Permissions({ module: 'dashboard', action: 'view' })
  getSetupStatus(@CurrentUser() user: JwtPayload, @Query('branch_id') branch_id?: string) {
    return this.dashboardService.getSetupStatus(user, branch_id);
  }

  // ── Multi-branch + trainer cockpit ───────────────────────────────

  @Get('portfolio')
  @Permissions({ module: 'dashboard', action: 'view' })
  getPortfolio(@CurrentUser() user: JwtPayload) {
    return this.portfolio.getPortfolio(user);
  }

  @Get('trainer-cockpit')
  @Permissions({ module: 'dashboard', action: 'view' })
  getTrainerCockpit(@CurrentUser() user: JwtPayload) {
    return this.trainerCockpit.getCockpit(user);
  }

  // ── Daily AI briefing (Wave 5) ───────────────────────────────────

  @Get('briefing')
  @Permissions({ module: 'dashboard', action: 'view' })
  getBriefing(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
  ) {
    return this.briefing.getOrGenerate(user, branch_id);
  }

  @Post('briefing/regenerate')
  @Permissions({ module: 'dashboard', action: 'edit' })
  regenerateBriefing(
    @CurrentUser() user: JwtPayload,
    @Body() body: { branch_id?: string } = {},
  ) {
    return this.briefing.generate(user, body.branch_id);
  }

  // ── KPI Inspector + Restatements (Wave 7) ────────────────────────

  /**
   * "Show your work" — return formula + sample rows + as-of timestamp
   * for any inspectable metric. The dashboard's audit affordance.
   */
  @Get('inspect/:metric')
  @Permissions({ module: 'dashboard', action: 'view' })
  inspectKpi(
    @CurrentUser() user: JwtPayload,
    @Param('metric') metric: string,
    @Query('branch_id') branch_id?: string,
  ) {
    const allowed: InspectableMetric[] = [
      'active_members',
      'today_revenue',
      'mrr',
      'check_ins_today',
      'renewals_at_risk_7d',
      'outstanding_dues',
    ];
    if (!allowed.includes(metric as InspectableMetric)) {
      throw new BadRequestException(
        `Metric must be one of: ${allowed.join(', ')}`,
      );
    }
    return this.inspector.inspect(user, metric as InspectableMetric, branch_id);
  }

  @Get('restatements')
  @Permissions({ module: 'dashboard', action: 'view' })
  getRestatements(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
  ) {
    return this.snapshots.detectRestatements(user, branch_id);
  }

  @Post('snapshots/capture')
  @Permissions({ module: 'dashboard', action: 'edit' })
  captureSnapshot(
    @CurrentUser() user: JwtPayload,
    @Body() body: { branch_id?: string } = {},
  ) {
    return this.snapshots
      .captureNow(user, body.branch_id)
      .then(() => ({ ok: true }));
  }

  // ── Plan / quota ─────────────────────────────────────────────────

  @Get('plan-usage')
  @Permissions({ module: 'dashboard', action: 'view' })
  getPlanUsage(@CurrentUser() user: JwtPayload) {
    return this.resourceLimits.getUsage(user.studio_id);
  }

  // ── Maintenance (event sourcing — owner only) ────────────────────

  @Post('resync')
  @Permissions({ module: 'dashboard', action: 'edit' })
  async resyncMetrics() {
    await this.metricsService.fullResync();
    return { success: true, message: 'Dashboard metrics resynced from source tables' };
  }

  @Post('catchup')
  @Permissions({ module: 'dashboard', action: 'edit' })
  async catchupEvents() {
    const count = await this.projector.catchup();
    return { success: true, events_processed: count };
  }

  @Post('replay')
  @Permissions({ module: 'dashboard', action: 'edit' })
  async replayEvents() {
    return this.projector.replay();
  }
}
