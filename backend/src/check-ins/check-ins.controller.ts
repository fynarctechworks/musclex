import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { CheckInsService } from './check-ins.service';
import {
  JwtAuthGuard,
  PermissionsGuard,
  BranchAccessGuard,
  Permissions,
  CurrentUser,
  JwtPayload,
  restrictedBranchIdsForUser,
  AllowWhenLocked,
} from '../common';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { FacialCheckInDto } from './dto/facial-check-in.dto';
import { SyncCheckInsDto } from './dto/sync-check-ins.dto';

// Check-ins are critical operational infrastructure — the gym entrance must
// keep working regardless of the studio's own SaaS subscription state. A
// billing lapse should never lock paying gym members out of the building.
//
// BranchAccessGuard enforces that a caller can only write check-ins for
// branches they have access to — closes Phase 1 discovery gap #3 where a
// staff member at Branch A could spoof `branch_id` to Branch B in the body.
@Controller('api/v1/check-ins')
@UseGuards(JwtAuthGuard, PermissionsGuard, BranchAccessGuard)
@AllowWhenLocked()
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @Post()
  @Permissions({ module: 'check_ins', action: 'create' })
  create(@CurrentUser() user: JwtPayload, @Body() data: CreateCheckInDto) {
    // Override is only honored when the caller has the explicit permission.
    // PermissionsGuard above gates 'check_ins:create'; finer-grained override
    // permission lookup happens here so a vanilla creator cannot force-allow.
    const hasOverride =
      user.permission_codes?.includes('check_ins.override') ?? false;
    return this.checkInsService.create(user.studio_id, {
      ...data,
      override_authorized: Boolean(data.override_authorized) && hasOverride,
      override_by_user_id:
        hasOverride && data.override_authorized ? user.user_id : null,
    });
  }

  @Post('facial')
  @Permissions({ module: 'check_ins', action: 'create' })
  facialCheckIn(
    @CurrentUser() user: JwtPayload,
    @Body() data: FacialCheckInDto,
  ) {
    return this.checkInsService.facialCheckIn(user.studio_id, data);
  }

  @Post('check-out')
  @Permissions({ module: 'check_ins', action: 'create' })
  checkOut(
    @Body()
    data: {
      member_id?: string;
      check_in_id?: string;
      qr_code?: string;
      branch_id: string;
    },
  ) {
    return this.checkInsService.checkOut(data);
  }

  @Get('open')
  @Permissions({ module: 'check_ins', action: 'view' })
  listOpen(@Query('branch_id') branch_id: string) {
    return this.checkInsService.listOpenVisits(branch_id);
  }

  @Post('sync')
  @Permissions({ module: 'check_ins', action: 'create' })
  syncOffline(@CurrentUser() user: JwtPayload, @Body() data: SyncCheckInsDto) {
    return this.checkInsService.syncOffline(user.studio_id, data.check_ins);
  }

  @Get()
  @Permissions({ module: 'check_ins', action: 'view' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('member_id') member_id?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.checkInsService.findAll(user.studio_id, {
      branch_id,
      date_from,
      date_to,
      member_id,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      user_branch_ids: restrictedBranchIdsForUser(user),
    });
  }

  @Get('heatmap')
  @Permissions({ module: 'check_ins', action: 'view' })
  getHeatmap(
    @Query('branch_id') branch_id?: string,
    @Query('weeks') weeks?: string,
  ) {
    return this.checkInsService.getHeatmap(
      branch_id,
      weeks ? parseInt(weeks) : 4,
    );
  }
}
