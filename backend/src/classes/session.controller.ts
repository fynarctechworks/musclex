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
import { SchedulingService } from './scheduling.service';
import {
  CreateClassSessionDto,
  UpdateClassSessionDto,
  CreateStudioRoomDto,
  UpdateStudioRoomDto,
  CreateRecurringRuleDto,
} from './dto';
import { JwtAuthGuard, PermissionsGuard, Permissions, CurrentUser, JwtPayload } from '../common';

@Controller('api/v1/classes/sessions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SessionController {
  constructor(private readonly schedulingService: SchedulingService) {}

  // ── Sessions ──────────────────────────────────────────────

  @Post()
  @Permissions({ module: 'classes', action: 'create' })
  createSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateClassSessionDto,
  ) {
    return this.schedulingService.createSession(user.studio_id, dto);
  }

  @Get()
  @Permissions({ module: 'classes', action: 'view' })
  findAllSessions(
    @Query('branch_id') branch_id?: string,
    @Query('trainer_id') trainer_id?: string,
    @Query('studio_id') studio_id?: string,
    @Query('template_id') template_id?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.schedulingService.findAllSessions({
      branch_id,
      trainer_id,
      studio_id,
      template_id,
      category,
      status,
      date_from,
      date_to,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get(':id')
  @Permissions({ module: 'classes', action: 'view' })
  findOneSession(@Param('id') id: string) {
    return this.schedulingService.findOneSession(id);
  }

  @Patch(':id')
  @Permissions({ module: 'classes', action: 'edit' })
  updateSession(@Param('id') id: string, @Body() dto: UpdateClassSessionDto) {
    return this.schedulingService.updateSession(id, dto);
  }

  @Post(':id/cancel')
  @Permissions({ module: 'classes', action: 'edit' })
  cancelSession(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.schedulingService.cancelSession(id, reason);
  }

  // ── Trainer Schedule ──────────────────────────────────────

  @Get('trainer/:trainerId/schedule')
  @Permissions({ module: 'classes', action: 'view' })
  getTrainerSchedule(
    @Param('trainerId') trainerId: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.schedulingService.getTrainerSchedule(trainerId, dateFrom, dateTo);
  }

  // ── Room Schedule ─────────────────────────────────────────

  @Get('room/:studioId/schedule')
  @Permissions({ module: 'classes', action: 'view' })
  getRoomSchedule(
    @Param('studioId') studioId: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.schedulingService.getRoomSchedule(studioId, dateFrom, dateTo);
  }

  // ── Studio Rooms ──────────────────────────────────────────

  @Post('rooms')
  @Permissions({ module: 'classes', action: 'create' })
  createRoom(@Body() dto: CreateStudioRoomDto) {
    return this.schedulingService.createRoom(dto);
  }

  @Get('rooms')
  @Permissions({ module: 'classes', action: 'view' })
  findAllRooms(@Query('branch_id') branchId?: string) {
    return this.schedulingService.findAllRooms(branchId);
  }

  @Get('rooms/:id')
  @Permissions({ module: 'classes', action: 'view' })
  findOneRoom(@Param('id') id: string) {
    return this.schedulingService.findOneRoom(id);
  }

  @Patch('rooms/:id')
  @Permissions({ module: 'classes', action: 'edit' })
  updateRoom(@Param('id') id: string, @Body() dto: UpdateStudioRoomDto) {
    return this.schedulingService.updateRoom(id, dto);
  }

  // ── Recurring Rules ───────────────────────────────────────

  @Post('recurring-rules')
  @Permissions({ module: 'classes', action: 'create' })
  createRecurringRule(@Body() dto: CreateRecurringRuleDto) {
    return this.schedulingService.createRecurringRule(dto);
  }

  @Get('recurring-rules')
  @Permissions({ module: 'classes', action: 'view' })
  findRecurringRules(
    @Query('template_id') templateId?: string,
    @Query('branch_id') branchId?: string,
  ) {
    return this.schedulingService.findRecurringRules(templateId, branchId);
  }

  @Post('recurring-rules/:id/deactivate')
  @Permissions({ module: 'classes', action: 'edit' })
  deactivateRecurringRule(@Param('id') id: string) {
    return this.schedulingService.deactivateRecurringRule(id);
  }

  @Post('recurring-rules/generate')
  @Permissions({ module: 'classes', action: 'create' })
  generateRecurringSessions() {
    return this.schedulingService.generateRecurringManually();
  }
}
