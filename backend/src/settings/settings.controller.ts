import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateStudioDto } from './dto';
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
  getBranchSummary() {
    return this.settingsService.getBranchSummary();
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
}
