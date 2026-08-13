import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Permissions,
  CurrentUser,
  JwtPayload,
} from '../common';
import { WorkoutPlansService } from './workout-plans.service';
import { StaffResolverService } from './staff-resolver.service';
import { AssignWorkoutPlanDto, CreateWorkoutPlanDto, UpdateWorkoutPlanDto } from './dto';

@Controller('api/v1/workout-plans')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class WorkoutPlansController {
  constructor(
    private readonly plans: WorkoutPlansService,
    private readonly staffResolver: StaffResolverService,
  ) {}

  @Get()
  @Permissions({ module: 'members', action: 'view' })
  findAll(
    @Query('search') search?: string,
    @Query('is_template') isTemplate?: string,
    @Query('is_active') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.plans.findAll({
      search,
      is_template: isTemplate,
      is_active: isActive,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('assignments')
  @Permissions({ module: 'members', action: 'view' })
  assignments(
    @Query('member_id') memberId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.plans.assignments({
      member_id: memberId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @Permissions({ module: 'members', action: 'view' })
  findOne(@Param('id') id: string) {
    return this.plans.findOne(id);
  }

  @Post()
  @Permissions({ module: 'members', action: 'create' })
  async create(@Body() dto: CreateWorkoutPlanDto, @CurrentUser() user: JwtPayload) {
    const staffId = await this.staffResolver.resolveStaffId(user.user_id);
    return this.plans.create(dto, staffId);
  }

  @Patch(':id')
  @Permissions({ module: 'members', action: 'edit' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkoutPlanDto) {
    return this.plans.update(id, dto);
  }

  @Delete(':id')
  @Permissions({ module: 'members', action: 'delete' })
  remove(@Param('id') id: string) {
    return this.plans.remove(id);
  }

  @Post(':id/assign')
  @Permissions({ module: 'members', action: 'edit' })
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignWorkoutPlanDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const staffId = await this.staffResolver.resolveStaffId(user.user_id);
    return this.plans.assign(id, dto, staffId);
  }

  @Delete('assignments/:assignmentId')
  @Permissions({ module: 'members', action: 'edit' })
  cancelAssignment(@Param('assignmentId') assignmentId: string) {
    return this.plans.cancelAssignment(assignmentId);
  }
}
