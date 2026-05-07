import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TileService } from './tile.service';
import { DashboardLayoutService, type LayoutTile } from './dashboard-layout.service';
import {
  JwtAuthGuard,
  PermissionsGuard,
  Permissions,
  CurrentUser,
  JwtPayload,
} from '../common';

/**
 * Tile registry + Wave 14 dashboard personalization endpoints.
 * Split out from DashboardController per code-review item #4.
 */
@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardLayoutController {
  constructor(
    private readonly tiles: TileService,
    private readonly layouts: DashboardLayoutService,
  ) {}

  @Get('tiles')
  @Permissions({ module: 'dashboard', action: 'view' })
  getTiles(@CurrentUser() user: JwtPayload) {
    return this.tiles.listTiles(user);
  }

  @Get('layout')
  @Permissions({ module: 'dashboard', action: 'view' })
  getLayout(@CurrentUser() user: JwtPayload) {
    return this.layouts.getLayout(user);
  }

  @Post('layout')
  @Permissions({ module: 'dashboard', action: 'edit' })
  saveLayout(
    @CurrentUser() user: JwtPayload,
    @Body() body: { tiles: LayoutTile[] },
  ) {
    if (!body || !Array.isArray(body.tiles)) {
      throw new BadRequestException('Body must be { tiles: LayoutTile[] }');
    }
    return this.layouts.saveLayout(user, body.tiles);
  }

  @Post('layout/reset')
  @Permissions({ module: 'dashboard', action: 'edit' })
  resetLayout(@CurrentUser() user: JwtPayload) {
    return this.layouts.resetLayout(user);
  }
}
