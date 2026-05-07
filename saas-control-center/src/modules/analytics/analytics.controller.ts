import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('revenue-trend')
  @ApiOperation({ summary: 'Monthly revenue trend' })
  revenueTrend(@Query('months') months?: number) {
    return this.analyticsService.getRevenueTrend(months || 12);
  }

  @Get('plan-distribution')
  @ApiOperation({ summary: 'Tenant distribution across plans' })
  planDistribution() {
    return this.analyticsService.getPlanDistribution();
  }

  @Get('growth')
  @ApiOperation({ summary: 'Monthly tenant growth metrics' })
  growth(@Query('months') months?: number) {
    return this.analyticsService.getGrowthMetrics(months || 12);
  }

  @Get('subscription-breakdown')
  @ApiOperation({ summary: 'Subscription status breakdown' })
  subscriptionBreakdown() {
    return this.analyticsService.getSubscriptionBreakdown();
  }
}
