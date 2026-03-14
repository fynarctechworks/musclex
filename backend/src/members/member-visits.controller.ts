import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MemberVisitsService } from './member-visits.service';
import {
  JwtAuthGuard,
  PermissionsGuard,
  Permissions,
} from '../common';

@Controller('api/v1/members')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MemberVisitsController {
  constructor(private readonly visitsService: MemberVisitsService) {}

  @Get(':id/visit-history')
  @Permissions({ module: 'members', action: 'view' })
  getVisits(
    @Param('id') id: string,
    @Query('branch_id') branch_id?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.visitsService.getVisits(id, {
      branch_id,
      date_from,
      date_to,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get(':id/visit-streak')
  @Permissions({ module: 'members', action: 'view' })
  getStreak(@Param('id') id: string) {
    return this.visitsService.getVisitStreak(id);
  }

  @Get(':id/attendance-by-month')
  @Permissions({ module: 'members', action: 'view' })
  getAttendanceByMonth(
    @Param('id') id: string,
    @Query('months') months?: string,
  ) {
    return this.visitsService.getAttendanceByMonth(id, months ? parseInt(months) : 6);
  }
}
