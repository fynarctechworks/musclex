import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  IsIn, IsOptional, IsString, IsBoolean, IsInt, IsNumber, IsArray,
  IsObject, IsUUID, IsDateString, ValidateNested, Min, MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReferralsProxyService } from './referrals-proxy.service';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';

class ReviewSignalDto {
  @IsIn(['reviewed_ok', 'confirmed_fraud'])
  decision: 'reviewed_ok' | 'confirmed_fraud';

  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Rule DTOs (mirror main backend; SCC ValidationPipe whitelists) ──

class RuleConditionsDto {
  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  plan_ids?: string[];

  @IsOptional() @IsArray() @IsIn(['monthly', 'annual'], { each: true })
  billing_cycles?: ('monthly' | 'annual')[];

  @IsOptional() @IsNumber() @Min(0)
  min_subscription_amount?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  studio_countries?: string[];

  @IsOptional() @IsInt() @Min(1)
  max_referrals_per_referrer?: number;
}

class RewardActionDto {
  @IsIn(['extend_subscription', 'account_credit', 'trial_extension', 'wallet_credit'])
  type: 'extend_subscription' | 'account_credit' | 'trial_extension' | 'wallet_credit';

  @IsOptional() @IsInt() @Min(1)
  days?: number;

  @IsOptional() @IsNumber() @Min(0)
  amount?: number;

  @IsOptional() @IsString()
  currency?: string;

  @IsOptional() @IsInt() @Min(1)
  expires_in_days?: number;
}

class CreateRuleDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() campaign_id?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsInt() priority?: number;

  @ValidateNested() @Type(() => RuleConditionsDto) @IsObject()
  conditions: RuleConditionsDto;

  @IsArray() @ValidateNested({ each: true }) @Type(() => RewardActionDto)
  rewards: RewardActionDto[];

  @IsOptional() @IsInt() @Min(1) max_uses?: number;
  @IsOptional() @IsDateString() valid_from?: string;
  @IsOptional() @IsDateString() valid_until?: string;
}

class UpdateRuleDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() campaign_id?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsInt() priority?: number;

  @IsOptional() @ValidateNested() @Type(() => RuleConditionsDto) @IsObject()
  conditions?: RuleConditionsDto;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RewardActionDto)
  rewards?: RewardActionDto[];

  @IsOptional() @IsInt() @Min(1) max_uses?: number;
  @IsOptional() @IsDateString() valid_from?: string;
  @IsOptional() @IsDateString() valid_until?: string;
}

class CreateCampaignDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsDateString() valid_from?: string;
  @IsOptional() @IsDateString() valid_until?: string;
}

class FreezeWalletDto {
  @IsString() @MinLength(5) reason: string;
}

class ManualAdjustmentDto {
  @IsUUID() studio_id: string;
  @IsNumber() amount: number;
  @IsOptional() @IsString() currency?: string;
  @IsString() @MinLength(5) reason: string;
}

interface AdminCtx {
  id: string;
  email: string;
}

@ApiTags('Referrals')
@ApiBearerAuth()
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly proxy: ReferralsProxyService) {}

  // ── Overview / analytics ────────────────────────────────────────

  @Get('overview')
  @ApiOperation({ summary: 'Referral program overview (funnel, rewards, wallet, fraud)' })
  overview() {
    return this.proxy.overview();
  }

  @Get('analytics/funnel')
  funnel(@Query() q: Record<string, string>) {
    return this.proxy.funnel(q);
  }

  @Get('analytics/top-referrers')
  topReferrers(@Query() q: Record<string, string>) {
    return this.proxy.topReferrers(q);
  }

  @Get('analytics/attributed-revenue')
  attributedRevenue(@Query() q: Record<string, string>) {
    return this.proxy.attributedRevenue(q);
  }

  @Get('analytics/time-to-reward')
  timeToReward(@Query() q: Record<string, string>) {
    return this.proxy.timeToReward(q);
  }

  @Get('analytics/wallet-aggregates')
  walletAggregates() {
    return this.proxy.walletAggregates();
  }

  @Get('analytics/daily-trend')
  dailyTrend(@Query() q: Record<string, string>) {
    return this.proxy.dailyTrend(q);
  }

  // ── Fraud queue ─────────────────────────────────────────────────

  @Get('fraud-queue')
  @ApiOperation({ summary: 'Pending fraud signals across all tenants' })
  fraudQueue(@Query() q: Record<string, string>) {
    return this.proxy.fraudQueue(q);
  }

  @Post('fraud-signals/:id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review a fraud signal (dismiss or confirm fraud)' })
  reviewSignal(
    @Param('id', ParseUUIDPipe) signalId: string,
    @Body() dto: ReviewSignalDto,
    @CurrentAdmin() admin: AdminCtx,
  ) {
    return this.proxy.reviewSignal(signalId, {
      decision: dto.decision,
      notes:    dto.notes,
      actor_id: admin.id,
    });
  }

  // ── Wallet (read) ───────────────────────────────────────────────

  @Get('wallets/:studio_id')
  wallet(@Param('studio_id', ParseUUIDPipe) studioId: string) {
    return this.proxy.wallet(studioId);
  }

  @Post('wallets/:studio_id/freeze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Freeze a gym referral wallet' })
  freezeWallet(
    @Param('studio_id', ParseUUIDPipe) studioId: string,
    @Body() dto: FreezeWalletDto,
    @CurrentAdmin() admin: AdminCtx,
  ) {
    return this.proxy.freezeWallet(studioId, { reason: dto.reason, actor_id: admin.id });
  }

  @Post('wallets/:studio_id/unfreeze')
  @HttpCode(HttpStatus.OK)
  unfreezeWallet(
    @Param('studio_id', ParseUUIDPipe) studioId: string,
    @CurrentAdmin() admin: AdminCtx,
  ) {
    return this.proxy.unfreezeWallet(studioId, { actor_id: admin.id });
  }

  @Post('wallets/manual-adjustment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually credit or debit a gym referral wallet' })
  manualAdjustment(@Body() dto: ManualAdjustmentDto, @CurrentAdmin() admin: AdminCtx) {
    return this.proxy.manualAdjustment({
      studio_id: dto.studio_id,
      amount:    dto.amount,
      currency:  dto.currency,
      reason:    dto.reason,
      actor_id:  admin.id,
    });
  }

  // ── Plans (for rule condition builder) ──────────────────────────

  @Get('plans')
  @ApiOperation({ summary: 'List active subscription plans' })
  plans() {
    return this.proxy.listPlans();
  }

  // ── Reward rules CRUD ───────────────────────────────────────────

  @Get('rules')
  @ApiOperation({ summary: 'List reward rules' })
  listRules(@Query('campaign_id') campaignId?: string) {
    return this.proxy.listRules(campaignId);
  }

  @Get('rules/:id')
  getRule(@Param('id', ParseUUIDPipe) id: string) {
    return this.proxy.getRule(id);
  }

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a reward rule' })
  createRule(@Body() body: CreateRuleDto) {
    return this.proxy.createRule(body);
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: 'Update a reward rule' })
  updateRule(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateRuleDto) {
    return this.proxy.updateRule(id, body);
  }

  @Delete('rules/:id')
  @ApiOperation({ summary: 'Delete (or deactivate) a reward rule' })
  deleteRule(@Param('id', ParseUUIDPipe) id: string) {
    return this.proxy.deleteRule(id);
  }

  // ── Campaigns ───────────────────────────────────────────────────

  @Get('campaigns')
  listCampaigns() {
    return this.proxy.listCampaigns();
  }

  @Post('campaigns')
  @HttpCode(HttpStatus.CREATED)
  createCampaign(@Body() body: CreateCampaignDto) {
    return this.proxy.createCampaign(body);
  }
}
