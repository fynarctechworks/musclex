import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
  CurrentUser,
  JwtPayload,
} from '../common';
import {
  CreateStaffDto,
  UpdateStaffDto,
  UpdateStaffProfileDto,
  SetAvailabilityDto,
  RecordAttendanceDto,
  CreateStaffShiftDto,
  UpdateStaffShiftDto,
  CreateLeaveRequestDto,
  ReviewLeaveRequestDto,
} from './dto';

@Controller('api/v1/staff')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // ── Staff CRUD ────────────────────────────────────────────────

  @Get()
  @Permissions({ module: 'staff', action: 'view' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
    @Query('organization_id') organization_id?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.staffService.findAll(
      {
        branch_id,
        organization_id,
        role,
        status,
        search,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 50,
      },
      user,
    );
  }

  @Get(':id')
  @Permissions({ module: 'staff', action: 'view' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.staffService.findOne(id, user.role);
  }

  @Post()
  @Permissions({ module: 'staff', action: 'create' })
  create(
    @Body() data: CreateStaffDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role !== 'owner' && data.role === 'owner') {
      throw new ForbiddenException('Cannot assign owner role');
    }
    return this.staffService.create(data);
  }

  @Patch(':id')
  @Permissions({ module: 'staff', action: 'edit' })
  update(
    @Param('id') id: string,
    @Body() data: UpdateStaffDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role !== 'owner' && data.role === 'owner') {
      throw new ForbiddenException('Cannot assign owner role');
    }
    return this.staffService.update(id, data);
  }

  @Delete(':id')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'staff', action: 'delete' })
  deactivate(@Param('id') id: string) {
    return this.staffService.deactivate(id);
  }

  // ── Staff Profile ─────────────────────────────────────────────

  @Get(':id/profile')
  @Permissions({ module: 'staff', action: 'view' })
  getProfile(@Param('id') id: string) {
    return this.staffService.getProfile(id);
  }

  @Patch(':id/profile')
  @Permissions({ module: 'staff', action: 'edit' })
  updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateStaffProfileDto,
  ) {
    return this.staffService.updateProfile(id, dto);
  }

  // ── Availability ──────────────────────────────────────────────

  @Get(':id/availability')
  @Permissions({ module: 'staff', action: 'view' })
  getAvailability(@Param('id') id: string) {
    return this.staffService.getAvailability(id);
  }

  @Post(':id/availability')
  @Permissions({ module: 'staff', action: 'edit' })
  setAvailability(
    @Param('id') id: string,
    @Body() slots: SetAvailabilityDto[],
  ) {
    return this.staffService.setAvailability(id, slots);
  }

  // ── Attendance ────────────────────────────────────────────────

  @Get(':id/attendance')
  @Permissions({ module: 'staff', action: 'view' })
  getAttendance(
    @Param('id') id: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
    @Query('branch_id') branch_id?: string,
  ) {
    return this.staffService.getAttendance(id, { start_date, end_date, branch_id });
  }

  @Post('attendance/check-in')
  @Permissions({ module: 'staff', action: 'create' })
  recordCheckIn(@Body() dto: RecordAttendanceDto) {
    return this.staffService.recordCheckIn(dto);
  }

  @Patch('attendance/:attendanceId/check-out')
  @Permissions({ module: 'staff', action: 'edit' })
  recordCheckOut(@Param('attendanceId') attendanceId: string) {
    return this.staffService.recordCheckOut(attendanceId);
  }

  // ── Shifts ────────────────────────────────────────────────────

  @Post('shifts')
  @Permissions({ module: 'staff', action: 'create' })
  createShift(@Body() dto: CreateStaffShiftDto) {
    return this.staffService.createShift(dto);
  }

  @Get('shifts')
  @Permissions({ module: 'staff', action: 'view' })
  getShifts(
    @Query('staff_id') staff_id?: string,
    @Query('branch_id') branch_id?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    return this.staffService.getShifts({ staff_id, branch_id, start_date, end_date });
  }

  @Patch('shifts/:id')
  @Permissions({ module: 'staff', action: 'edit' })
  updateShift(@Param('id') id: string, @Body() dto: UpdateStaffShiftDto) {
    return this.staffService.updateShift(id, dto);
  }

  @Delete('shifts/:id')
  @Permissions({ module: 'staff', action: 'delete' })
  deleteShift(@Param('id') id: string) {
    return this.staffService.deleteShift(id);
  }

  // ── Leave Requests ────────────────────────────────────────────

  @Post('leaves')
  @Permissions({ module: 'staff', action: 'create' })
  createLeaveRequest(@Body() dto: CreateLeaveRequestDto) {
    return this.staffService.createLeaveRequest(dto);
  }

  @Get('leaves')
  @Permissions({ module: 'staff', action: 'view' })
  getLeaveRequests(
    @Query('staff_id') staff_id?: string,
    @Query('status') status?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.staffService.getLeaveRequests({
      staff_id,
      status,
      start_date,
      end_date,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Patch('leaves/:id/review')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'staff', action: 'edit' })
  reviewLeaveRequest(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReviewLeaveRequestDto,
  ) {
    return this.staffService.reviewLeaveRequest(id, user.user_id, dto);
  }

  @Post('leaves/:id/cancel')
  @Permissions({ module: 'staff', action: 'edit' })
  cancelLeaveRequest(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.staffService.cancelLeaveRequest(id, user.user_id);
  }
}
