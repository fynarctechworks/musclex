import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Headers,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthSessionService } from './auth-session.service';
import { AuthDeviceService } from './auth-device.service';
import { AuthLoginHistoryService } from './auth-login-history.service';
import { AuthIdentityService } from './auth-identity.service';
import { RevokeSessionDto, RevokeAllSessionsDto } from './dto';
import { JwtAuthGuard, CurrentUser, JwtPayload, RolesGuard, Roles } from '../common';

@Controller('api/v1/auth/sessions')
@UseGuards(JwtAuthGuard)
export class AuthSessionController {
  constructor(
    private sessionService: AuthSessionService,
    private deviceService: AuthDeviceService,
    private loginHistoryService: AuthLoginHistoryService,
    private identityService: AuthIdentityService,
  ) {}

  // ── Session Management ──

  @Get()
  getActiveSessions(@CurrentUser() user: JwtPayload) {
    return this.sessionService.getUserSessions(user.user_id);
  }

  @Post('revoke')
  revokeSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RevokeSessionDto,
  ) {
    return this.sessionService.revokeSession(user.user_id, dto.session_id, dto.reason);
  }

  @Post('revoke-all')
  revokeAllSessions(
    @CurrentUser() user: JwtPayload,
    @Headers('authorization') auth: string,
    @Body() dto: RevokeAllSessionsDto,
  ) {
    const currentToken = auth?.replace('Bearer ', '') || undefined;
    return this.sessionService.revokeAllSessions(user.user_id, currentToken, dto.reason);
  }

  // ── Device Management ──

  @Get('devices')
  getDevices(@CurrentUser() user: JwtPayload) {
    return this.deviceService.getUserDevices(user.user_id);
  }

  @Post('devices/:deviceId/trust')
  trustDevice(
    @CurrentUser() user: JwtPayload,
    @Param('deviceId') deviceId: string,
  ) {
    return this.deviceService.setDeviceTrust(user.user_id, deviceId, true);
  }

  @Post('devices/:deviceId/untrust')
  untrustDevice(
    @CurrentUser() user: JwtPayload,
    @Param('deviceId') deviceId: string,
  ) {
    return this.deviceService.setDeviceTrust(user.user_id, deviceId, false);
  }

  @Delete('devices/:deviceId')
  removeDevice(
    @CurrentUser() user: JwtPayload,
    @Param('deviceId') deviceId: string,
  ) {
    return this.deviceService.removeDevice(user.user_id, deviceId);
  }

  // ── Login History ──

  @Get('history')
  getLoginHistory(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    return this.loginHistoryService.getUserHistory(
      user.user_id,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  // ── Identity ──

  @Get('identity')
  getIdentity(@CurrentUser() user: JwtPayload) {
    return this.identityService.getIdentity(user.user_id);
  }
}

// ── Admin-only login history controller ──
@Controller('api/v1/auth/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner')
export class AuthAdminController {
  constructor(
    private loginHistoryService: AuthLoginHistoryService,
    private identityService: AuthIdentityService,
    private sessionService: AuthSessionService,
  ) {}

  @Get('login-history')
  getLoginHistory(
    @Query('email') email?: string,
    @Query('ip_address') ipAddress?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.loginHistoryService.getFilteredHistory({
      email,
      ip_address: ipAddress,
      status,
      from_date: from ? new Date(from) : undefined,
      to_date: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Post('users/:userId/suspend')
  suspendUser(@Param('userId') userId: string) {
    return this.identityService.suspendUser(userId);
  }

  @Post('users/:userId/reactivate')
  reactivateUser(@Param('userId') userId: string) {
    return this.identityService.reactivateUser(userId);
  }

  @Post('users/:userId/revoke-sessions')
  revokeUserSessions(
    @Param('userId') userId: string,
    @Body() dto: RevokeAllSessionsDto,
  ) {
    return this.sessionService.revokeAllSessions(userId, undefined, dto.reason || 'admin_revoked');
  }
}
