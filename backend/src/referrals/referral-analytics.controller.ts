import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { IsOptional, IsDateString, IsInt, Min, IsNumber, IsUUID, IsString } from 'class-validator';
import { ReferralAnalyticsService } from './referral-analytics.service';
import { WalletRedemptionService } from './wallet-redemption.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../common';

class DateRangeDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsInt() @Min(1) limit?: number;
}

class QuoteRedemptionDto {
  @IsUUID() studio_id: string;
  @IsNumber() plan_total: number;
  @IsString() currency: string;
}

class ApplyRedemptionDto extends QuoteRedemptionDto {
  @IsNumber() requested_amount: number;
  @IsUUID() invoice_id: string;
  @IsString() idempotency_key: string;
}

class ReverseRedemptionDto {
  @IsString() reason: string;
}

// ── SaaS-admin analytics ─────────────────────────────────────────

@Controller('api/v1/admin/referrals/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class B2BAnalyticsController {
  constructor(
    private readonly analytics: ReferralAnalyticsService,
    private readonly redemption: WalletRedemptionService,
  ) {}

  @Get('funnel')
  funnel(@Query() q: DateRangeDto) {
    return this.analytics.b2bFunnel(this.parseRange(q));
  }

  @Get('top-referrers')
  topReferrers(@Query() q: DateRangeDto) {
    return this.analytics.b2bTopReferrers({ ...this.parseRange(q), limit: q.limit });
  }

  @Get('attributed-revenue')
  attributedRevenue(@Query() q: DateRangeDto) {
    return this.analytics.b2bAttributedRevenue(this.parseRange(q));
  }

  @Get('time-to-reward')
  timeToReward(@Query() q: DateRangeDto) {
    return this.analytics.b2bTimeToReward(this.parseRange(q));
  }

  @Get('wallet-aggregates')
  walletAggregates() {
    return this.analytics.b2bWalletAggregates();
  }

  @Get('daily-trend')
  dailyTrend(@Query() q: DateRangeDto) {
    if (!q.from || !q.to) throw new BadRequestException('from & to required');
    return this.analytics.b2bDailyTrend({ from: new Date(q.from), to: new Date(q.to) });
  }

  // ── Wallet redemption admin endpoints ──
  @Post('redemption/quote')
  @HttpCode(HttpStatus.OK)
  quote(@Body() dto: QuoteRedemptionDto) {
    return this.redemption.quoteRedemption({
      studioId:  dto.studio_id,
      planTotal: dto.plan_total,
      currency:  dto.currency,
    });
  }

  @Post('redemption/apply')
  @HttpCode(HttpStatus.OK)
  apply(@Body() dto: ApplyRedemptionDto) {
    return this.redemption.applyRedemption({
      studioId:        dto.studio_id,
      planTotal:       dto.plan_total,
      requestedAmount: dto.requested_amount,
      currency:        dto.currency,
      invoiceId:       dto.invoice_id,
      idempotencyKey:  dto.idempotency_key,
    });
  }

  @Post('redemption/:entry_id/reverse')
  @HttpCode(HttpStatus.OK)
  reverse(
    @Param('entry_id', ParseUUIDPipe) entryId: string,
    @Body() dto: ReverseRedemptionDto,
  ) {
    return this.redemption.reverseRedemption({
      redemptionEntryId: entryId,
      reason:            dto.reason,
    });
  }

  private parseRange(q: DateRangeDto): { from?: Date; to?: Date } {
    return {
      from: q.from ? new Date(q.from) : undefined,
      to:   q.to   ? new Date(q.to)   : undefined,
    };
  }
}

// ── Gym-owner analytics (B2C) ────────────────────────────────────

@Controller('api/v1/admin/member-referrals/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'manager', 'super_admin')
export class B2CAnalyticsController {
  constructor(private readonly analytics: ReferralAnalyticsService) {}

  @Get('funnel')
  funnel(@Query() q: DateRangeDto) {
    return this.analytics.b2cFunnel(this.parseRange(q));
  }

  @Get('leaderboard')
  leaderboard(@Query() q: DateRangeDto) {
    return this.analytics.b2cLeaderboard({ ...this.parseRange(q), limit: q.limit });
  }

  @Get('reward-costs')
  rewardCosts(@Query() q: DateRangeDto) {
    return this.analytics.b2cRewardCosts(this.parseRange(q));
  }

  private parseRange(q: DateRangeDto): { from?: Date; to?: Date } {
    return {
      from: q.from ? new Date(q.from) : undefined,
      to:   q.to   ? new Date(q.to)   : undefined,
    };
  }
}

// ── Member-facing dashboard ──────────────────────────────────────

@Controller('api/v1/member-referrals/dashboard')
@UseGuards(JwtAuthGuard)
export class MemberDashboardController {
  constructor(private readonly analytics: ReferralAnalyticsService) {}

  @Get(':member_id')
  dashboard(@Param('member_id', ParseUUIDPipe) memberId: string) {
    return this.analytics.memberDashboard(memberId);
  }
}
