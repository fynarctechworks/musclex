import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  IsDateString,
  IsIn,
  MinLength,
  IsObject,
} from 'class-validator';
import { MemberReferralAdminService } from './member-referral-admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../common';

class CreateProgramDto {
  @IsString() program_name: string;
  @IsIn(['discount', 'free_days', 'cash', 'free_class']) reward_type: string;
  @IsNumber() reward_value: number;
  @IsOptional() @IsInt() @Min(1) min_referrals?: number;
  @IsOptional() @IsInt() @Min(1) max_rewards?: number;
  @IsOptional() @IsDateString() start_date?: string;
  @IsOptional() @IsDateString() end_date?: string;
}

class UpdateProgramDto {
  @IsOptional() @IsString() program_name?: string;
  @IsOptional() @IsIn(['discount', 'free_days', 'cash', 'free_class']) reward_type?: string;
  @IsOptional() @IsNumber() reward_value?: number;
  @IsOptional() @IsInt() @Min(1) min_referrals?: number;
  @IsOptional() @IsInt() @Min(1) max_rewards?: number;
  @IsOptional() @IsDateString() start_date?: string;
  @IsOptional() @IsDateString() end_date?: string;
  @IsOptional() @IsIn(['active', 'paused', 'ended']) status?: string;
}

class SetProgramStatusDto {
  @IsIn(['active', 'paused', 'ended']) status: 'active' | 'paused' | 'ended';
}

class ManualRewardDto {
  @IsString() reward_type: string;
  @IsObject() reward_value: Record<string, unknown>;
  @IsOptional() @IsString() notes?: string;
}

class ForceMemberTransitionDto {
  @IsString() to_status: string;
  @IsString() @MinLength(5) reason: string;
}

class RevokeMemberRewardDto {
  @IsString() @MinLength(5) reason: string;
}

class ReviewMemberSignalDto {
  @IsIn(['reviewed_ok', 'confirmed_fraud']) decision: 'reviewed_ok' | 'confirmed_fraud';
  @IsOptional() @IsString() notes?: string;
}

@Controller('api/v1/admin/member-referrals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'manager', 'super_admin')
export class MemberReferralsAdminController {
  constructor(private readonly admin: MemberReferralAdminService) {}

  // ── Overview ────────────────────────────────────────────────────

  @Get('overview')
  getOverview() {
    return this.admin.getOverview();
  }

  // ── Programs ────────────────────────────────────────────────────

  @Get('programs')
  listPrograms() {
    return this.admin.listPrograms();
  }

  @Post('programs')
  @HttpCode(HttpStatus.CREATED)
  createProgram(@Body() dto: CreateProgramDto) {
    return this.admin.createProgram(dto);
  }

  @Patch('programs/:id')
  updateProgram(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProgramDto,
  ) {
    return this.admin.updateProgram(id, dto as any);
  }

  @Post('programs/:id/status')
  @HttpCode(HttpStatus.OK)
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetProgramStatusDto,
  ) {
    return this.admin.setProgramStatus(id, dto.status);
  }

  // ── Manual reward & overrides ───────────────────────────────────

  @Post(':id/manual-reward')
  @HttpCode(HttpStatus.CREATED)
  manualReward(
    @Param('id', ParseUUIDPipe) memberReferralId: string,
    @Body() dto: ManualRewardDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.issueManualReward({
      memberReferralId,
      rewardType:  dto.reward_type,
      rewardValue: dto.reward_value,
      adminId:     user.user_id,
      notes:       dto.notes,
    });
  }

  @Post('rewards/:id/revoke')
  @HttpCode(HttpStatus.OK)
  revokeReward(
    @Param('id', ParseUUIDPipe) rewardId: string,
    @Body() dto: RevokeMemberRewardDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.revokeMemberReward({
      rewardId,
      adminId: user.user_id,
      reason:  dto.reason,
    });
  }

  @Post(':id/force-transition')
  @HttpCode(HttpStatus.OK)
  forceTransition(
    @Param('id', ParseUUIDPipe) memberReferralId: string,
    @Body() dto: ForceMemberTransitionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.forceTransition({
      memberReferralId,
      toStatus: dto.to_status,
      adminId:  user.user_id,
      reason:   dto.reason,
    });
  }

  // ── Fraud queue ─────────────────────────────────────────────────

  @Get('fraud-queue')
  listFraudQueue(
    @Query('severity') severity?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.admin.listFraudQueue({
      severity,
      limit:  limit  ? parseInt(limit, 10)  : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('fraud-signals/:id/review')
  @HttpCode(HttpStatus.OK)
  reviewSignal(
    @Param('id', ParseUUIDPipe) signalId: string,
    @Body() dto: ReviewMemberSignalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.reviewFraudSignal({
      signalId,
      adminId:  user.user_id,
      decision: dto.decision,
      notes:    dto.notes,
    });
  }
}
