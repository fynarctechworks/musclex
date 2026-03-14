import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformSettingsService } from '../services/platform-settings.service';
import {
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
  BulkToggleFlagsDto,
  UpdateWhiteLabelDto,
  CreateSsoProviderDto,
  UpdateSsoProviderDto,
  CreateSystemNotificationDto,
} from '../dto';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
  CurrentUser,
  JwtPayload,
} from '../../common';

@Controller('api/v1/platform')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlatformController {
  constructor(private platformSettingsService: PlatformSettingsService) {}

  // ─── Platform Overview ────────────────────────────────────

  @Get('overview')
  @Roles('owner', 'admin')
  getOverview(@CurrentUser() user: JwtPayload) {
    return this.platformSettingsService.getPlatformOverview(user.studio_id);
  }

  // ─── Feature Flags ────────────────────────────────────────

  @Get('feature-flags')
  @Roles('owner', 'admin')
  getFeatureFlags(@CurrentUser() user: JwtPayload) {
    return this.platformSettingsService.getFeatureFlags(user.studio_id);
  }

  @Get('feature-flags/:key')
  @Roles('owner', 'admin')
  getFeatureFlag(@CurrentUser() user: JwtPayload, @Param('key') key: string) {
    return this.platformSettingsService.getFeatureFlag(user.studio_id, key);
  }

  @Get('feature-flags/:key/enabled')
  isFeatureEnabled(@CurrentUser() user: JwtPayload, @Param('key') key: string) {
    return this.platformSettingsService.isFeatureEnabled(user.studio_id, key);
  }

  @Post('feature-flags')
  @Roles('owner')
  createFeatureFlag(@CurrentUser() user: JwtPayload, @Body() dto: CreateFeatureFlagDto) {
    return this.platformSettingsService.createFeatureFlag(user.studio_id, dto);
  }

  @Patch('feature-flags/:key')
  @Roles('owner')
  updateFeatureFlag(
    @CurrentUser() user: JwtPayload,
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
  ) {
    return this.platformSettingsService.updateFeatureFlag(user.studio_id, key, dto);
  }

  @Post('feature-flags/bulk-toggle')
  @Roles('owner')
  bulkToggleFlags(@CurrentUser() user: JwtPayload, @Body() dto: BulkToggleFlagsDto) {
    return this.platformSettingsService.bulkToggleFlags(user.studio_id, dto.flags);
  }

  @Delete('feature-flags/:key')
  @Roles('owner')
  deleteFeatureFlag(@CurrentUser() user: JwtPayload, @Param('key') key: string) {
    return this.platformSettingsService.deleteFeatureFlag(user.studio_id, key);
  }

  // ─── White Label ──────────────────────────────────────────

  @Get('white-label')
  @Roles('owner', 'admin')
  getWhiteLabelConfig(@CurrentUser() user: JwtPayload) {
    return this.platformSettingsService.getWhiteLabelConfig(user.studio_id);
  }

  @Patch('white-label')
  @Roles('owner')
  updateWhiteLabelConfig(@CurrentUser() user: JwtPayload, @Body() dto: UpdateWhiteLabelDto) {
    return this.platformSettingsService.updateWhiteLabelConfig(user.studio_id, dto);
  }

  // ─── SSO Providers ────────────────────────────────────────

  @Get('sso-providers')
  @Roles('owner', 'admin')
  getSsoProviders() {
    return this.platformSettingsService.getSsoProviders();
  }

  @Get('sso-providers/:id')
  @Roles('owner', 'admin')
  getSsoProvider(@Param('id') id: string) {
    return this.platformSettingsService.getSsoProvider(id);
  }

  @Post('sso-providers')
  @Roles('owner')
  createSsoProvider(@CurrentUser() user: JwtPayload, @Body() dto: CreateSsoProviderDto) {
    return this.platformSettingsService.createSsoProvider(dto, user.user_id);
  }

  @Patch('sso-providers/:id')
  @Roles('owner')
  updateSsoProvider(@Param('id') id: string, @Body() dto: UpdateSsoProviderDto) {
    return this.platformSettingsService.updateSsoProvider(id, dto);
  }

  @Delete('sso-providers/:id')
  @Roles('owner')
  deleteSsoProvider(@Param('id') id: string) {
    return this.platformSettingsService.deleteSsoProvider(id);
  }

  // ─── System Notifications ─────────────────────────────────

  @Get('notifications')
  getNotifications(
    @CurrentUser() user: JwtPayload,
    @Query('unread_only') unreadOnly?: string,
  ) {
    return this.platformSettingsService.getNotifications(
      user.studio_id,
      unreadOnly === 'true',
    );
  }

  @Get('notifications/unread-count')
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.platformSettingsService.getUnreadCount(user.studio_id);
  }

  @Post('notifications')
  @Roles('owner', 'admin')
  createNotification(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSystemNotificationDto,
  ) {
    return this.platformSettingsService.createNotification(user.studio_id, dto);
  }

  @Patch('notifications/:id/read')
  markAsRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.platformSettingsService.markAsRead(user.studio_id, id);
  }

  @Post('notifications/mark-all-read')
  markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.platformSettingsService.markAllAsRead(user.studio_id);
  }
}
