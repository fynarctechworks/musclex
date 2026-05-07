import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateStudioDto, ChangePlanDto } from './dto';
import {
  JwtAuthGuard,
  Roles,
  RolesGuard,
  CurrentUser,
  JwtPayload,
} from '../common';

@Controller('api/v1/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get('studio')
  getStudio(@CurrentUser() user: JwtPayload) {
    return this.settingsService.getStudio(user.studio_id);
  }

  @Get('account')
  getAccountOverview(@CurrentUser() user: JwtPayload) {
    return this.settingsService.getAccountOverview(user.studio_id);
  }

  @Get('invoices')
  @Roles('owner')
  getInvoices(@CurrentUser() user: JwtPayload) {
    return this.settingsService.getInvoices(user.studio_id);
  }

  @Get('branches-summary')
  getBranchSummary(@CurrentUser() user: JwtPayload) {
    return this.settingsService.getBranchSummary(user.studio_id);
  }

  @Get('plans')
  getAvailablePlans() {
    return this.settingsService.getAvailablePlans();
  }

  @Patch('studio')
  @Roles('owner')
  updateStudio(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateStudioDto,
  ) {
    const { studio_name, ...rest } = dto;
    return this.settingsService.updateStudio(user.studio_id, {
      ...(studio_name ? { name: studio_name } : {}),
      ...rest,
    });
  }

  @Get('referral')
  getReferralSettings(@CurrentUser() user: JwtPayload) {
    return this.settingsService.getReferralSettings(user.studio_id);
  }

  @Patch('referral')
  @Roles('owner')
  updateReferralSettings(
    @CurrentUser() user: JwtPayload,
    @Body() body: { referral_free_days?: number; referral_reward_days?: number },
  ) {
    return this.settingsService.updateReferralSettings(user.studio_id, {
      referral_free_days: body.referral_free_days !== undefined ? Number(body.referral_free_days) : undefined,
      referral_reward_days: body.referral_reward_days !== undefined ? Number(body.referral_reward_days) : undefined,
    });
  }

  @Patch('subscription')
  @Roles('owner')
  changePlan(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePlanDto,
  ) {
    return this.settingsService.changePlan(user.studio_id, dto.plan, dto.billing_cycle);
  }

  @Delete('clear-data')
  @Roles('owner')
  clearTenantData(
    @CurrentUser() user: JwtPayload,
    @Query('target') target: string,
  ) {
    const options = {
      members: target === 'members' || target === 'all',
      branches: target === 'branches' || target === 'all',
      all: target === 'all',
    };
    return this.settingsService.clearTenantData(user.studio_id, options);
  }
}
