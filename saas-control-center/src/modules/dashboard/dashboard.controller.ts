import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get SaaS dashboard KPIs' })
  getMetrics() {
    return this.dashboardService.getMetrics();
  }

  @Post('metrics/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear dashboard cache and return fresh metrics' })
  async refreshMetrics() {
    await this.dashboardService.clearCache();
    return this.dashboardService.getMetrics();
  }
}
