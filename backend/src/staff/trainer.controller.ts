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
  assignClient(@Body() dto: AssignClientDto) {
    return this.trainerService.assignClient(dto);
  }

  @Get(':id/clients')
  @Permissions({ module: 'staff', action: 'view' })
  getClients(
    @Param('id') id: string,
    @Query('status') status?: string,
  ) {
    return this.trainerService.getTrainerClients(id, status);
  }

  @Patch('clients/:assignmentId')
  @Permissions({ module: 'staff', action: 'edit' })
  updateClientAssignment(
    @Param('assignmentId') assignmentId: string,
    @Query('status') status: string,
  ) {
    return this.trainerService.updateClientAssignment(assignmentId, status);
  }

  // ── Sessions ──────────────────────────────────────────────────

  @Post('sessions')
  @Permissions({ module: 'staff', action: 'create' })
  createSession(@Body() dto: CreateTrainerSessionDto) {
    return this.trainerService.createSession(dto);
  }

  @Get('sessions')
  @Permissions({ module: 'staff', action: 'view' })
  getSessions(
    @Query('trainer_id') trainer_id?: string,
    @Query('member_id') member_id?: string,
    @Query('branch_id') branch_id?: string,
    @Query('status') status?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.trainerService.getSessions({
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
    @Param('id') id: string,
    @Body() dto: UpdateTrainerSessionDto,
  ) {
    return this.trainerService.updateSession(id, dto);
  }

  // ── Performance & Dashboard ───────────────────────────────────

  @Get('performance')
  @Permissions({ module: 'staff', action: 'view' })
  getPerformance(
    @Query('branch_id') branch_id?: string,
    @Query('organization_id') organization_id?: string,
  ) {
    return this.trainerService.getTrainerPerformance({ branch_id, organization_id });
  }

  @Get(':id/dashboard')
  @Permissions({ module: 'staff', action: 'view' })
  getDashboard(@Param('id') id: string) {
    return this.trainerService.getTrainerDashboard(id);
  }

  // ── Performance Snapshots ─────────────────────────────────────

  @Post(':id/performance-snapshot')
  @Permissions({ module: 'staff', action: 'create' })
  recordPerformanceSnapshot(
    @Param('id') id: string,
    @Query('period_start') period_start: string,
    @Query('period_end') period_end: string,
  ) {
    return this.trainerService.recordPerformanceSnapshot(id, period_start, period_end);
  }

  @Get(':id/performance-history')
  @Permissions({ module: 'staff', action: 'view' })
  getPerformanceHistory(
    @Param('id') id: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    return this.trainerService.getPerformanceHistory(id, { start_date, end_date });
  }
}
