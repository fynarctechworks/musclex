import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TrainerService } from './trainer.service';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Permissions,
  CurrentUser,
  JwtPayload,
} from '../common';
import {
  AssignClientDto,
  CreateTrainerSessionDto,
  UpdateTrainerSessionDto,
} from './dto';

@Controller('api/v1/trainer')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TrainerController {
  constructor(private readonly trainerService: TrainerService) {}

  // ── Client Assignment ─────────────────────────────────────────

  @Post('assign-client')
  @Permissions({ module: 'staff', action: 'edit' })
  assignClient(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AssignClientDto,
  ) {
    return this.trainerService.assignClient(user.studio_id, dto);
  }

  @Get(':id/clients')
  @Permissions({ module: 'staff', action: 'view' })
  getClients(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('status') status?: string,
  ) {
    return this.trainerService.getTrainerClients(user.studio_id, id, status);
  }

  @Patch('clients/:assignmentId')
  @Permissions({ module: 'staff', action: 'edit' })
  updateClientAssignment(
    @CurrentUser() user: JwtPayload,
    @Param('assignmentId') assignmentId: string,
    @Query('status') status: string,
  ) {
    return this.trainerService.updateClientAssignment(user.studio_id, assignmentId, status);
  }

  // ── Sessions ──────────────────────────────────────────────────

  @Post('sessions')
  @Permissions({ module: 'staff', action: 'create' })
  createSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTrainerSessionDto,
  ) {
    return this.trainerService.createSession(user.studio_id, dto);
  }

  @Get('sessions')
  @Permissions({ module: 'staff', action: 'view' })
  getSessions(
    @CurrentUser() user: JwtPayload,
    @Query('trainer_id') trainer_id?: string,
    @Query('member_id') member_id?: string,
    @Query('branch_id') branch_id?: string,
    @Query('status') status?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.trainerService.getSessions(user.studio_id, {
      trainer_id,
      member_id,
      branch_id,
      status,
      start_date,
      end_date,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Patch('sessions/:id')
  @Permissions({ module: 'staff', action: 'edit' })
  updateSession(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTrainerSessionDto,
  ) {
    return this.trainerService.updateSession(user.studio_id, id, dto);
  }

  // ── Performance & Dashboard ───────────────────────────────────

  @Get('performance')
  @Permissions({ module: 'staff', action: 'view' })
  getPerformance(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
    @Query('organization_id') organization_id?: string,
  ) {
    return this.trainerService.getTrainerPerformance({ branch_id, organization_id });
  }

  @Get(':id/dashboard')
  @Permissions({ module: 'staff', action: 'view' })
  getDashboard(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.trainerService.getTrainerDashboard(user.studio_id, id);
  }

  // ── Performance Snapshots ─────────────────────────────────────

  @Post(':id/performance-snapshot')
  @Permissions({ module: 'staff', action: 'create' })
  recordPerformanceSnapshot(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('period_start') period_start: string,
    @Query('period_end') period_end: string,
  ) {
    return this.trainerService.recordPerformanceSnapshot(user.studio_id, id, period_start, period_end);
  }

  @Get(':id/performance-history')
  @Permissions({ module: 'staff', action: 'view' })
  getPerformanceHistory(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    return this.trainerService.getPerformanceHistory(user.studio_id, id, { start_date, end_date });
  }
}
