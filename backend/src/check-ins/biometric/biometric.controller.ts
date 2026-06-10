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
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { BiometricEnrollmentService } from './biometric-enrollment.service';
import { BiometricRegistry } from './biometric-registry.service';
import {
  AllowWhenLocked,
  BranchAccessGuard,
  CurrentUser,
  JwtAuthGuard,
  JwtPayload,
  Permissions,
  PermissionsGuard,
} from '../../common';

class EnrollBiometricDto {
  @IsUUID()
  member_id!: string;

  @IsUUID()
  branch_id!: string;

  @IsIn(['face', 'fingerprint', 'iris', 'palm'])
  modality!: 'face' | 'fingerprint' | 'iris' | 'palm';

  @IsString()
  @IsOptional()
  provider_id?: string;

  @IsUUID()
  @IsOptional()
  consent_log_id?: string;

  // For face modality
  @IsArray()
  @IsOptional()
  descriptor?: number[];

  // For fingerprint modality
  @IsString()
  @IsOptional()
  @MaxLength(50_000)
  template_base64?: string;

  @IsString()
  @IsOptional()
  vendor?: string;
}

/**
 * Biometric enrollment management.
 *
 * - GET    /api/v1/check-ins/biometric/providers          → registry surface
 * - GET    /api/v1/check-ins/biometric/members/:id        → enrollments for one member
 * - POST   /api/v1/check-ins/biometric/enroll             → enroll (provider-routed)
 * - DELETE /api/v1/check-ins/biometric/enrollments/:id    → revoke (provider clears template)
 *
 * Same lock + branch posture as the rest of the check-ins module.
 */
@Controller('api/v1/check-ins/biometric')
@UseGuards(JwtAuthGuard, PermissionsGuard, BranchAccessGuard)
@AllowWhenLocked()
export class BiometricController {
  constructor(
    private readonly enrollments: BiometricEnrollmentService,
    private readonly registry: BiometricRegistry,
  ) {}

  @Get('providers')
  @Permissions({ module: 'members', action: 'view' })
  listProviders() {
    return {
      providers: this.registry.listAll().map((p) => ({
        id: p.id,
        modality: p.modality,
        label: p.label,
        available: p.isAvailable(),
      })),
    };
  }

  @Get('members/:id')
  @Permissions({ module: 'members', action: 'view' })
  listForMember(@Param('id', new ParseUUIDPipe()) memberId: string) {
    return this.enrollments.listForMember(memberId);
  }

  @Get('enrollments')
  @Permissions({ module: 'members', action: 'view' })
  listAllEnrollments(
    @Query('modality') modality?: 'face' | 'fingerprint' | 'iris' | 'palm',
    @Query('include_revoked') includeRevoked?: string,
  ) {
    return this.enrollments.listAll({
      modality,
      include_revoked: includeRevoked === 'true',
    });
  }

  @Post('enroll')
  @Permissions({ module: 'members', action: 'edit' })
  enroll(@CurrentUser() user: JwtPayload, @Body() body: EnrollBiometricDto) {
    const payload =
      body.modality === 'face'
        ? { modality: 'face' as const, descriptor: body.descriptor ?? [] }
        : {
            modality: 'fingerprint' as const,
            template_base64: body.template_base64 ?? '',
            vendor: body.vendor ?? '',
          };

    return this.enrollments.enroll({
      member_id: body.member_id,
      branch_id: body.branch_id,
      provider_id: body.provider_id,
      modality: body.modality,
      enrolled_by: user.user_id,
      consent_log_id: body.consent_log_id ?? null,
      payload,
    });
  }

  @Delete('enrollments/:id')
  @Permissions({ module: 'members', action: 'edit' })
  revoke(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) enrollmentId: string,
    @Query('branch_id') branchId: string,
  ) {
    return this.enrollments.revoke(enrollmentId, branchId, user.user_id);
  }
}
