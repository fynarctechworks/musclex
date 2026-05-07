import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CheckInsService } from './check-ins.service';
import { JwtAuthGuard, PermissionsGuard, Permissions, CurrentUser, JwtPayload, restrictedBranchIdsForUser } from '../common';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { FacialCheckInDto } from './dto/facial-check-in.dto';
import { SyncCheckInsDto } from './dto/sync-check-ins.dto';

@Controller('api/v1/check-ins')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @Post()
  @Permissions({ module: 'check_ins', action: 'create' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() data: CreateCheckInDto,
  ) {
    return this.checkInsService.create(user.studio_id, data);
  }

  @Post('facial')
  @Permissions({ module: 'check_ins', action: 'create' })
  facialCheckIn(
    @CurrentUser() user: JwtPayload,
    @Body() data: FacialCheckInDto,
  ) {
    return this.checkInsService.facialCheckIn(user.studio_id, data);
  }

  @Post('sync')
  @Permissions({ module: 'check_ins', action: 'create' })
  syncOffline(
    @CurrentUser() user: JwtPayload,
    @Body() data: SyncCheckInsDto,
  ) {
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
