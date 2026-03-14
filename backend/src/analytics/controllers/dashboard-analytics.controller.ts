import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from '../services/analytics.service';
import {
  JwtAuthGuard,
  PermissionsGuard,
  Permissions,
  CurrentUser,
  JwtPayload,
} from '../../common';
import {
  AnalyticsQueryDto,
  RevenueQueryDto,
  MembershipQueryDto,
  ClassQueryDto,
  TrainerQueryDto,
  MemberBehaviorQueryDto,
  CampaignAnalyticsQueryDto,
} from '../dto';

@Controller('api/v1/analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardAnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Permissions({ module: 'analytics', action: 'view' })
  getDashboardSummary(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getDashboardSummary(query);
  }

  @Get('daily-metrics')
  @Permissions({ module: 'analytics', action: 'view' })
  getDailyMetrics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getDailyMetrics(query);
  }

  @Get('daily-metrics/trend')
  @Permissions({ module: 'analytics', action: 'view' })
  getDailyMetricsTrend(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getDailyMetricsTrend(query);
  }

  @Get('revenue')
  @Permissions({ module: 'analytics', action: 'view' })
  getRevenueAnalytics(@Query() query: RevenueQueryDto) {
    return this.analyticsService.getRevenueAnalytics(query);
  }

  @Get('memberships')
  @Permissions({ module: 'analytics', action: 'view' })
  getMembershipAnalytics(@Query() query: MembershipQueryDto) {
    return this.analyticsService.getMembershipAnalytics(query);
  }

  @Get('classes')
  @Permissions({ module: 'analytics', action: 'view' })
  getClassAnalytics(@Query() query: ClassQueryDto) {
    return this.analyticsService.getClassAnalytics(query);
  }

  @Get('members/behavior')
  @Permissions({ module: 'analytics', action: 'view' })
  getMemberBehavior(@Query() query: MemberBehaviorQueryDto) {
    return this.analyticsService.getMemberBehavior(query);
  }

  @Get('members/churn-risk')
  @Permissions({ module: 'analytics', action: 'view' })
  getChurnRiskSummary(@Query('branch_id') branchId?: string) {
    return this.analyticsService.getChurnRiskSummary(branchId);
  }

  @Get('trainers')
  @Permissions({ module: 'analytics', action: 'view' })
  getTrainerAnalytics(@Query() query: TrainerQueryDto) {
    return this.analyticsService.getTrainerAnalytics(query);
  }

  @Get('trainers/leaderboard')
  @Permissions({ module: 'analytics', action: 'view' })
  getTrainerLeaderboard(@Query('branch_id') branchId?: string) {
    return this.analyticsService.getTrainerLeaderboard(branchId);
  }

  @Get('campaigns')
  @Permissions({ module: 'analytics', action: 'view' })
  getCampaignAnalytics(@Query() query: CampaignAnalyticsQueryDto) {
    return this.analyticsService.getCampaignAnalytics(query);
  }

  @Get('branch-comparison')
  @Permissions({ module: 'analytics', action: 'view' })
  getBranchComparison(
    @Query('organization_id') organizationId: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.analyticsService.getBranchComparison(organizationId, startDate, endDate);
  }
}
