import { Module, forwardRef } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardActionsController } from './dashboard-actions.controller';
import { DashboardOpsController } from './dashboard-ops.controller';
import { DashboardIntelligenceController } from './dashboard-intelligence.controller';
import { DashboardLayoutController } from './dashboard-layout.controller';
import { DashboardService } from './dashboard.service';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { DashboardPulseService } from './dashboard-pulse.service';
import { ActionQueueService } from './action-queue.service';
import { TrainerCockpitService } from './trainer-cockpit.service';
import { PortfolioService } from './portfolio.service';
import { AnomalyService } from './anomaly.service';
import { BriefingService } from './briefing.service';
import { PushSubscriptionService } from './push-subscription.service';
import { KpiInspectorService } from './kpi-inspector.service';
import { KpiSnapshotService } from './kpi-snapshot.service';
import { DashboardGateway } from './dashboard.gateway';
// Wave 8
import { TileService } from './tile.service';
import { DashboardCacheService } from './dashboard-cache.service';
// Wave 10
import { RevenueIntelligenceService } from './revenue-intelligence.service';
// Wave 9
import { OccupancyService } from './occupancy.service';
import { TodaysClassesService } from './todays-classes.service';
// Wave 11
import { BusinessMetricsService } from './business-metrics.service';
import { CohortService } from './cohort.service';
import { SegmentService } from './segment.service';
// Wave 12
import { ConflictDetectorService } from './conflict-detector.service';
import { FootfallHeatmapService } from './footfall-heatmap.service';
// Wave 13
import { DashboardInventoryService } from './inventory.service';
import { SystemStatusService } from './system-status.service';
// Wave 14
import { DashboardLayoutService } from './dashboard-layout.service';

import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { ResourceLimitService } from '../common/services/resource-limit.service';

@Module({
  imports: [PrismaModule, forwardRef(() => EventsModule)],
  controllers: [
    DashboardController,
    DashboardActionsController,
    DashboardOpsController,
    DashboardIntelligenceController,
    DashboardLayoutController,
  ],
  providers: [
    DashboardService,
    DashboardMetricsService,
    DashboardPulseService,
    ActionQueueService,
    TrainerCockpitService,
    PortfolioService,
    AnomalyService,
    BriefingService,
    PushSubscriptionService,
    KpiInspectorService,
    KpiSnapshotService,
    DashboardGateway,
    ResourceLimitService,
    // Wave 8
    TileService,
    DashboardCacheService,
    // Wave 9
    OccupancyService,
    TodaysClassesService,
    // Wave 10
    RevenueIntelligenceService,
    // Wave 11
    BusinessMetricsService,
    CohortService,
    SegmentService,
    // Wave 12
    ConflictDetectorService,
    FootfallHeatmapService,
    // Wave 13
    DashboardInventoryService,
    SystemStatusService,
    // Wave 14
    DashboardLayoutService,
  ],
  exports: [
    DashboardMetricsService,
    DashboardPulseService,
    ActionQueueService,
    TrainerCockpitService,
    PortfolioService,
    AnomalyService,
    BriefingService,
    PushSubscriptionService,
    KpiInspectorService,
    KpiSnapshotService,
    DashboardGateway,
    TileService,
    OccupancyService,
    TodaysClassesService,
    RevenueIntelligenceService,
    BusinessMetricsService,
    CohortService,
    SegmentService,
    ConflictDetectorService,
    FootfallHeatmapService,
    DashboardInventoryService,
    SystemStatusService,
    DashboardLayoutService,
  ],
})
export class DashboardModule {}
