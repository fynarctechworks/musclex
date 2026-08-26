import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { CurrentUser, JwtAuthGuard, JwtPayload } from '../common';
import { StaffPushService } from './staff-push.service';

export class RegisterStaffDeviceDto {
  @IsString()
  @MaxLength(255)
  token!: string;

  @IsString()
  @IsIn(['ios', 'android'])
  platform!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  device_name?: string;
}

export class UnregisterStaffDeviceDto {
  @IsString()
  @MaxLength(255)
  token!: string;
}

/**
 * Staff push registration.
 *
 * Both routes are authenticated: a device is only ever registered for the
 * person holding the token, never for an id supplied by the caller. That
 * matters because the id decides whose phone gets a gym's notifications.
 */
@Controller('api/v1/staff-push')
@UseGuards(JwtAuthGuard)
export class StaffPushController {
  constructor(private readonly staffPush: StaffPushService) {}

  /** Register this device for the signed-in user's CURRENT gym. */
  @Post('register')
  register(@CurrentUser() user: JwtPayload, @Body() dto: RegisterStaffDeviceDto) {
    return this.staffPush.register({
      userId: user.user_id,
      gymId: user.studio_id,
      token: dto.token,
      platform: dto.platform,
      deviceName: dto.device_name,
    });
  }

  /**
   * Forget this device — EVERYWHERE.
   *
   * Deletes the token across every gym the user belongs to, not just the one
   * they happen to be viewing. A staffer who signs out has stopped being
   * reachable, and a token left behind in another studio keeps pushing that
   * gym's notifications to a phone whose owner has signed out.
   */
  @Post('unregister')
  unregister(@CurrentUser() user: JwtPayload, @Body() dto: UnregisterStaffDeviceDto) {
    return this.staffPush.unregister(user.user_id, dto.token);
  }
}
