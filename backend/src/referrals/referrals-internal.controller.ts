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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';
import { ReferralAdminService } from './referral-admin.service';
import { ReferralAnalyticsService } from './referral-analytics.service';
import { ReferralWalletService } from './referral-wallet.service';
import {
  FraudQueueFilterDto,
  ReviewSignalDto,
} from './dto/admin-actions.dto';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';

/**
 * Internal (service-to-service) referral admin surface.
 *
 * Consumed by the SaaS Control Center via x-internal-secret header.
 * Mirrors the B2B admin endpoints but without a gym-app JWT — auth is the
 * shared internal secret. The acting admin's identity is passed in the body
 * (actor_id) since there's no JWT to derive it from.
 *
 * Read endpoints are safe; write endpoints (review, etc.) require actor_id.
 */
@Controller('api/v1/internal/referrals')
@UseGuards(InternalSecretGuard)
export class ReferralsInternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: ReferralAdminService,
    private readonly analytics: ReferralAnalyticsService,
    private readonly wallet: ReferralWalletService,
  ) {}

  // ── Overview / analytics (read-only) ────────────────────────────

  @Get('overview')
  overview() {
    return this.admin.getOverview();
  }

  @Get('analytics/funnel')
  funnel(@Query() q: { from?: string; to?: string }) {
    return this.analytics.b2bFunnel(this.range(q));
  }

  @Get('analytics/top-referrers')
  topReferrers(@Query() q: { from?: string; to?: string; limit?: string }) {
    return this.analytics.b2bTopReferrers({
      ...this.range(q),
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
    });
  }

  @Get('analytics/attributed-revenue')
  attributedRevenue(@Query() q: { from?: string; to?: string }) {
    return this.analytics.b2bAttributedRevenue(this.range(q));
  }

  @Get('analytics/time-to-reward')
  timeToReward(@Query() q: { from?: string; to?: string }) {
    return this.analytics.b2bTimeToReward(this.range(q));
  }

  @Get('analytics/wallet-aggregates')
  walletAggregates() {
    return this.analytics.b2bWalletAggregates();
  }

  @Get('analytics/daily-trend')
  dailyTrend(@Query() q: { from: string; to: string }) {
    return this.analytics.b2bDailyTrend({ from: new Date(q.from), to: new Date(q.to) });
  }

  // ── Fraud queue ─────────────────────────────────────────────────

  @Get('fraud-queue')
  fraudQueue(@Query() filters: FraudQueueFilterDto) {
    return this.admin.listFraudQueue(filters);
  }

  @Post('fraud-signals/:id/review')
  @HttpCode(HttpStatus.OK)
  reviewSignal(
    @Param('id', ParseUUIDPipe) signalId: string,
    @Body() dto: ReviewSignalDto & { actor_id: string },
  ) {
    return this.admin.reviewFraudSignal({
      signalId,
      reviewerId: dto.actor_id,
      decision:   dto.decision,
      notes:      dto.notes,
    });
  }

  // ── Wallet (read) ───────────────────────────────────────────────

  @Get('wallets/:studio_id')
  async wallet_(@Param('studio_id', ParseUUIDPipe) studioId: string) {
    const [balance, entries] = await Promise.all([
      this.wallet.getBalance(studioId),
      this.wallet.listEntries(studioId, { limit: 50 }),
    ]);
    return { ...balance, entries };
  }

  @Post('wallets/:studio_id/freeze')
  @HttpCode(HttpStatus.OK)
  freezeWallet(
    @Param('studio_id', ParseUUIDPipe) studioId: string,
    @Body() dto: { reason: string; actor_id: string },
  ) {
    return this.admin.freezeWallet({ studioId, adminId: dto.actor_id, reason: dto.reason });
  }

  @Post('wallets/:studio_id/unfreeze')
  @HttpCode(HttpStatus.OK)
  unfreezeWallet(
    @Param('studio_id', ParseUUIDPipe) studioId: string,
    @Body() dto: { actor_id: string },
  ) {
    return this.admin.unfreezeWallet({ studioId, adminId: dto.actor_id });
  }

  @Post('wallets/manual-adjustment')
  @HttpCode(HttpStatus.OK)
  manualAdjustment(
    @Body() dto: { studio_id: string; amount: number; currency?: string; reason: string; actor_id: string },
  ) {
    return this.admin.manualWalletAdjustment({
      studioId: dto.studio_id,
      amount:   dto.amount,
      currency: dto.currency,
      reason:   dto.reason,
      adminId:  dto.actor_id,
    });
  }

  // ── Subscription plans (for rule condition builder) ─────────────

  @Get('plans')
  listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where:   { is_active: true },
      orderBy: { sort_order: 'asc' },
      select: {
        id:            true,
        name:          true,
        display_name:  true,
        monthly_price: true,
        annual_price:  true,
      },
    });
  }

  // ── Reward rules CRUD ───────────────────────────────────────────

  @Get('rules')
  listRules(@Query('campaign_id') campaignId?: string) {
    return this.prisma.referralRewardRule.findMany({
      where:   campaignId ? { campaign_id: campaignId } : {},
      orderBy: { priority: 'desc' },
      include: { campaign: { select: { id: true, name: true } } },
    });
  }

  @Get('rules/:id')
  async getRule(@Param('id', ParseUUIDPipe) id: string) {
    const rule = await this.prisma.referralRewardRule.findUnique({
      where:   { id },
      include: { campaign: true, reward_logs: { take: 5, orderBy: { applied_at: 'desc' } } },
    });
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  createRule(@Body() dto: CreateRuleDto) {
    if (!dto.rewards || dto.rewards.length === 0) {
      throw new BadRequestException('At least one reward action is required');
    }
    return this.prisma.referralRewardRule.create({
      data: {
        name:        dto.name,
        description: dto.description,
        campaign_id: dto.campaign_id,
        is_active:   dto.is_active ?? true,
        priority:    dto.priority ?? 0,
        conditions:  dto.conditions as unknown as Prisma.InputJsonValue,
        rewards:     dto.rewards as unknown as Prisma.InputJsonValue,
        max_uses:    dto.max_uses,
        valid_from:  dto.valid_from ? new Date(dto.valid_from) : null,
        valid_until: dto.valid_until ? new Date(dto.valid_until) : null,
      },
    });
  }

  @Patch('rules/:id')
  async updateRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRuleDto,
  ) {
    const existing = await this.prisma.referralRewardRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Rule not found');

    return this.prisma.referralRewardRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.campaign_id !== undefined && { campaign_id: dto.campaign_id }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.conditions !== undefined && {
          conditions: dto.conditions as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.rewards !== undefined && {
          rewards: dto.rewards as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.max_uses !== undefined && { max_uses: dto.max_uses }),
        ...(dto.valid_from !== undefined && { valid_from: new Date(dto.valid_from) }),
        ...(dto.valid_until !== undefined && { valid_until: new Date(dto.valid_until) }),
      },
    });
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.OK)
  async deleteRule(@Param('id', ParseUUIDPipe) id: string) {
    const hasLogs = await this.prisma.rewardLog.count({ where: { rule_id: id } });
    if (hasLogs > 0) {
      // Preserve audit trail — deactivate instead of delete.
      await this.prisma.referralRewardRule.update({
        where: { id },
        data:  { is_active: false },
      });
      return { deactivated: true, reason: 'Rule has reward history — deactivated, not deleted' };
    }
    await this.prisma.referralRewardRule.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Campaigns ───────────────────────────────────────────────────

  @Get('campaigns')
  listCampaigns() {
    return this.prisma.referralCampaign.findMany({
      orderBy: { created_at: 'desc' },
      include: { rules: { select: { id: true, name: true, is_active: true } } },
    });
  }

  @Post('campaigns')
  @HttpCode(HttpStatus.CREATED)
  createCampaign(@Body() dto: CreateCampaignDto) {
    return this.prisma.referralCampaign.create({
      data: {
        name:        dto.name,
        description: dto.description,
        is_active:   dto.is_active ?? true,
        valid_from:  dto.valid_from ? new Date(dto.valid_from) : null,
        valid_until: dto.valid_until ? new Date(dto.valid_until) : null,
      },
    });
  }

  private range(q: { from?: string; to?: string }): { from?: Date; to?: Date } {
    return {
      from: q.from ? new Date(q.from) : undefined,
      to:   q.to   ? new Date(q.to)   : undefined,
    };
  }
}
