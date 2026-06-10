import { Body, Delete, HttpCode, Post } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberNotificationService } from './member-notification.service';
import { DeviceTokenDto, DeviceTokenDeleteDto } from './dto';

/**
 * Push device-token registration (Phase 3). Register on enable, unregister on
 * disable / sign-out. Tokens are member-owned + gym-scoped.
 */
@MemberDataController()
export class MemberNotificationController {
  constructor(private readonly notifications: MemberNotificationService) {}

  @Post('notifications/device-tokens')
  @HttpCode(204)
  async register(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: DeviceTokenDto,
  ): Promise<void> {
    await this.notifications.registerToken(member, dto.token, dto.platform, dto.prefs);
  }

  @Delete('notifications/device-tokens')
  @HttpCode(204)
  async unregister(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: DeviceTokenDeleteDto,
  ): Promise<void> {
    await this.notifications.removeToken(member, dto.token);
  }
}
