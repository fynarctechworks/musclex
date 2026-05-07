import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OccupancyService } from './occupancy.service';
import { TodaysClassesService } from './todays-classes.service';
import { FootfallHeatmapService } from './footfall-heatmap.service';
import { DashboardInventoryService } from './inventory.service';
import { SystemStatusService } from './system-status.service';
import {
  JwtAuthGuard,
  PermissionsGuard,
  Permissions,
  CurrentUser,
  JwtPayload,
} from '../common';

/**
 * Live operational tiles: occupancy, today's classes, footfall heatmap,
 * inventory, system status. All read-only. Split out from DashboardController
 * per code-review item #4.
 */
@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardOpsController {
  constructor(
    private readonly occupancy: OccupancyService,
    private readonly todaysClasses: TodaysClassesService,
    private readonly heatmap: FootfallHeatmapService,
    private readonly inventory: DashboardInventoryService,
    private readonly systemStatus: SystemStatusService,
  ) {}

  @Get('occupancy')
  @Permissions({ module: 'dashboard', action: 'view' })
  getOccupancy(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
  ) {
    return this.occupancy.getOccupancy(user, branch_id);
  }

  @Get('today-classes')
  @Permissions({ module: 'dashboard', action: 'view' })
  getTodayClasses(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
  ) {
    return this.todaysClasses.getTodaysClasses(user, branch_id);
  }

  @Get('heatmap')
  @Permissions({ module: 'dashboard', action: 'view' })
  getHeatmap(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
    @Query('days') days?: string,
  ) {
    const d = days ? Math.min(Math.max(parseInt(days, 10) || 30, 7), 90) : 30;
    return this.heatmap.getHeatmap(user, branch_id, d);
  }

  @Get('system-status')
  @Permissions({ module: 'dashboard', action: 'view' })
  getSystemStatus(@CurrentUser() user: JwtPayload) {
    return this.systemStatus.getStatus(user);
  }

  @Get('inventory')
  @Permissions({ module: 'dashboard', action: 'view' })
  getInventory(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
  ) {
    return this.inventory.getInventory(user, branch_id);
  }
}
