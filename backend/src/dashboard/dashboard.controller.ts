import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import {
  JwtAuthGuard,
  PermissionsGuard,
  Permissions,
  CurrentUser,
  JwtPayload,
} from '../common';

@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  @Permissions({ module: 'dashboard', action: 'view' })
  getKpis(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getKpis(user);
  }

  @Get('revenue-chart')
  @Permissions({ module: 'dashboard', action: 'view' })
  getRevenueChart(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getRevenueChart(user);
  }

  @Get('activity-feed')
  @Permissions({ module: 'dashboard', action: 'view' })
  getActivityFeed() {
    return this.dashboardService.getActivityFeed();
  }

  @Get('alerts')
  @Permissions({ module: 'dashboard', action: 'view' })
  getAlerts() {
    return this.dashboardService.getAlerts();
  }

  @Get('branch-comparison')
  @Permissions({ module: 'dashboard', action: 'view' })
  getBranchComparison() {
    return this.dashboardService.getBranchComparison();
  }
}
