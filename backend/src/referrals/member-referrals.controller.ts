import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsOptional, IsUUID } from 'class-validator';
import { MemberReferralsService } from './member-referrals.service';
import { JwtAuthGuard, CurrentUser, JwtPayload } from '../common';

class ValidateMemberCodeDto {
  @IsString()
  code: string;
}

class CreateMemberReferralPublicDto {
  @IsString()
  @IsOptional()
  referrer_code?: string;

  @IsUUID()
  @IsOptional()
  referrer_member_id?: string;

  @IsUUID()
  referred_member_id: string;
}

@Controller('api/v1/member-referrals')
export class MemberReferralsController {
  constructor(private readonly service: MemberReferralsService) {}

  /** Public — validate a member referral code before registration. */
  @Get('validate')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  validate(@Query() dto: ValidateMemberCodeDto) {
    return this.service.validateCode(dto.code);
  }

  /** Called during referred member registration. */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateMemberReferralPublicDto) {
    if (!dto.referrer_code && !dto.referrer_member_id) {
      throw new BadRequestException('referrer_code or referrer_member_id required');
    }
    return this.service.createMemberReferral({
      referrerCode:     dto.referrer_code,
      referrerMemberId: dto.referrer_member_id,
      referredMemberId: dto.referred_member_id,
    });
  }

  /** Member-facing dashboard. */
  @Get('me/stats')
  @UseGuards(JwtAuthGuard)
  getMyStats(@CurrentUser() user: JwtPayload, @Query('member_id', new ParseUUIDPipe({ optional: true })) memberId?: string) {
    // member_id is required since JwtPayload typically carries user_id, not member_id.
    // In a real app, look up member via user_id. For now, require explicit memberId.
    if (!memberId) throw new BadRequestException('member_id required');
    return this.service.getMemberStats(memberId);
  }

  /** Gym-owner leaderboard. */
  @Get('leaderboard')
  @UseGuards(JwtAuthGuard)
  getLeaderboard(@Query('limit') limit?: string) {
    return this.service.getLeaderboard({ limit: limit ? parseInt(limit, 10) : 10 });
  }

  /**
   * Generate (or fetch) the referral code for a given member.
   * Idempotent — re-calling returns the existing code.
   * Restricted to staff (owner/manager/staff/super_admin) so members can't
   * brute-force codes for other members.
   */
  @Post(':member_id/ensure-code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'manager', 'staff', 'super_admin')
  @HttpCode(HttpStatus.OK)
  async ensureCode(@Param('member_id', ParseUUIDPipe) memberId: string) {
    const referral_code = await this.service.ensureMemberCode(memberId);
    return { member_id: memberId, referral_code };
  }
}
