import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffInviteService } from './staff-invite.service';
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
  AcceptInviteDto,
  UpdatePermissionOverridesDto,
  ResetStaffPasswordDto,
  UpdateBranchAccessDto,
} from './dto';

@Controller('api/v1/staff')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly inviteService: StaffInviteService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // STATIC ROUTES (must come before :id param routes)
  // ══════════════════════════════════════════════════════════════

  // ── Staff Invites ─────────────────────────────────────────────

  @Get('invites')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'staff', action: 'view' })
  listInvites(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
  ) {
    return this.inviteService.listInvites(user.studio_id, { status });
  }

  @Post('invites/:id/resend')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'staff', action: 'edit' })
  resendInvite(
    @Param('id') inviteId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inviteService.resendInvite(inviteId, user.user_id);
  }

  @Delete('invites/:id')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'staff', action: 'delete' })
  revokeInvite(@Param('id') inviteId: string) {
    return this.inviteService.revokeInvite(inviteId);
  }

  // ── Attendance (static) ───────────────────────────────────────

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

  // ── Shifts (static) ──────────────────────────────────────────

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

  // ── Leaves (static) ──────────────────────────────────────────

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
    @Query('branch_id') branch_id?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.staffService.getLeaveRequests({
      staff_id,
      status,
      start_date,
      end_date,
      branch_id,
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

  // ══════════════════════════════════════════════════════════════
  // CRUD ROUTES (list, then :id parameterized)
  // ══════════════════════════════════════════════════════════════

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
      user.studio_id,
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

  @Post()
  @Permissions({ module: 'staff', action: 'create' })
  create(
    @Body() data: CreateStaffDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role !== 'owner' && data.role === 'owner') {
      throw new ForbiddenException('Cannot assign owner role');
    }
    if (!data.organization_id && user.organization_id) {
      data.organization_id = user.organization_id;
    }
    return this.staffService.create(user.studio_id, data, user.user_id);
  }

  // ══════════════════════════════════════════════════════════════
  // PARAMETERIZED :id ROUTES (must come after static routes)
  // ══════════════════════════════════════════════════════════════

  @Get(':id')
  @Permissions({ module: 'staff', action: 'view' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.staffService.findOne(user.studio_id, id, user.role);
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
    return this.staffService.update(user.studio_id, id, data);
  }

  @Delete(':id')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'staff', action: 'delete' })
  deactivate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.staffService.deactivate(user.studio_id, id);
  }

  // ── :id sub-routes ────────────────────────────────────────────

  @Get(':id/profile')
  @Permissions({ module: 'staff', action: 'view' })
  getProfile(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.staffService.getProfile(user.studio_id, id);
  }

  @Patch(':id/profile')
  @Permissions({ module: 'staff', action: 'edit' })
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStaffProfileDto,
  ) {
    return this.staffService.updateProfile(user.studio_id, id, dto);
  }

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

  @Patch(':id/branch-access')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'staff', action: 'edit' })
  updateBranchAccess(
    @Param('id') staffId: string,
    @Body() dto: UpdateBranchAccessDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.staffService.updateBranchAccess(user.studio_id, staffId, dto.branch_ids);
  }

  @Post(':id/invite')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'staff', action: 'create' })
  async sendInvite(
    @Param('id') staffId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { role_name: string; branch_id?: string; permission_overrides?: { grants?: string[]; denials?: string[] } },
  ) {
    const staff = await this.staffService.findOne(user.studio_id, staffId, user.role);
    if (!staff.email) {
      throw new ForbiddenException('Staff member has no email — cannot send invite');
    }
    return this.inviteService.createInvite({
      staff_id: staffId,
      studio_id: user.studio_id,
      email: staff.email,
      role_name: body.role_name,
      branch_id: body.branch_id,
      permission_overrides: body.permission_overrides,
      invited_by: user.user_id,
    });
  }

  @Get(':id/permissions')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'staff', action: 'view' })
  getPermissionOverrides(@Param('id') staffId: string) {
    return this.inviteService.getPermissionOverrides(staffId);
  }

  @Put(':id/permissions')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'staff', action: 'edit' })
  updatePermissionOverrides(
    @Param('id') staffId: string,
    @Body() dto: UpdatePermissionOverridesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inviteService.updatePermissionOverrides({
      staff_id: staffId,
      grants: dto.grants || [],
      denials: dto.denials || [],
      granted_by: user.user_id,
    });
  }

  @Post(':id/reset-password')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'staff', action: 'edit' })
  resetPassword(
    @Param('id') staffId: string,
    @Body() dto: ResetStaffPasswordDto,
  ) {
    return this.inviteService.resetStaffPassword(staffId, dto.password);
  }

  @Delete(':id/access')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'staff', action: 'delete' })
  revokeAllAccess(
    @Param('id') staffId: string,
    @CurrentUser() user: JwtPayload,
    @Query('delete_auth_user') deleteAuthUser?: string,
  ) {
    return this.inviteService.revokeAllAccess(
      staffId,
      user.studio_id,
      deleteAuthUser === 'true',
    );
  }
}

/**
 * Public controller for invite acceptance — no auth required.
 */
@Controller('api/v1/staff-invites')
export class StaffInviteController {
  constructor(private readonly inviteService: StaffInviteService) {}

  @Get(':token')
  getInviteByToken(@Param('token') token: string) {
    return this.inviteService.getInviteByToken(token);
  }

  @Post('accept')
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.inviteService.acceptInvite({
      token: dto.token,
      password: dto.password,
      full_name: dto.full_name,
    });
  }
}
