import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
import { StaffBiometricsService } from './staff-biometrics.service';
import {
  AllowWhenLocked,
  BranchAccessGuard,
  CurrentUser,
  JwtAuthGuard,
  JwtPayload,
  Permissions,
  PermissionsGuard,
} from '../common';

class EnrollStaffFaceDto {
  @IsUUID()
  staff_id!: string;

  @IsArray()
  descriptor!: number[];

  @IsUUID()
  @IsOptional()
  consent_log_id?: string;
}

class StaffFaceClockDto {
  @IsArray()
  descriptor!: number[];

  @IsUUID()
  branch_id!: string;
}

class StaffManualClockDto {
  @IsUUID()
  staff_id!: string;

  @IsUUID()
  branch_id!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * Staff biometric enrollment + attendance.
 *
 * Endpoints:
 *  - GET    /api/v1/staff/biometric/enrollments               → tenant-wide list
 *  - GET    /api/v1/staff/biometric/staff/:id                 → one staff's enrollments
 *  - POST   /api/v1/staff/biometric/enroll                    → enroll a face
 *  - DELETE /api/v1/staff/biometric/enrollments/:id           → revoke
 *  - POST   /api/v1/staff/biometric/clock-face                → identify + toggle attendance
 *  - POST   /api/v1/staff/biometric/clock-manual              → manual toggle (staff picker)
 *
 * Lock-exempt: payroll-relevant signals must keep flowing even if the studio's
 * own subscription is in a grace state.
 */
@Controller('api/v1/staff/biometric')
@UseGuards(JwtAuthGuard, PermissionsGuard, BranchAccessGuard)
@AllowWhenLocked()
export class StaffBiometricsController {
  constructor(private readonly service: StaffBiometricsService) {}

  @Get('enrollments')
  @Permissions({ module: 'staff', action: 'view' })
  listAll(@Query('include_revoked') includeRevoked?: string) {
    return this.service.listAll({ include_revoked: includeRevoked === 'true' });
  }

  @Get('staff/:id')
  @Permissions({ module: 'staff', action: 'view' })
  listForStaff(@Param('id', new ParseUUIDPipe()) staffId: string) {
    return this.service.listForStaff(staffId);
  }

  @Post('enroll')
  @Permissions({ module: 'staff', action: 'edit' })
  enroll(@CurrentUser() user: JwtPayload, @Body() body: EnrollStaffFaceDto) {
    return this.service.enrollFace({
      staff_id: body.staff_id,
      descriptor: body.descriptor,
      enrolled_by: user.user_id,
      consent_log_id: body.consent_log_id ?? null,
    });
  }

  @Delete('enrollments/:id')
  @Permissions({ module: 'staff', action: 'edit' })
  revoke(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) enrollmentId: string,
  ) {
    return this.service.revoke(enrollmentId, user.user_id);
  }

  @Post('clock-face')
  @Permissions({ module: 'staff', action: 'view' })
  clockFace(@Body() body: StaffFaceClockDto) {
    return this.service.clockByFace({
      descriptor: body.descriptor,
      branch_id: body.branch_id,
    });
  }

  @Post('clock-manual')
  @Permissions({ module: 'staff', action: 'edit' })
  clockManual(@Body() body: StaffManualClockDto) {
    return this.service.clockManual({
      staff_id: body.staff_id,
      branch_id: body.branch_id,
      notes: body.notes,
    });
  }
}
