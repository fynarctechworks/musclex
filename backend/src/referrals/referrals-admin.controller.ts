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
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ReferralsService } from './referrals.service';

@Controller('api/v1/admin/referrals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'super_admin')
export class ReferralsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly referralsService: ReferralsService,
  ) {}

  // ── Campaigns ─────────────────────────────────────────────────────

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
        name:          dto.name,
        description:   dto.description,
        is_active:     dto.is_active ?? true,
        valid_from:    dto.valid_from ? new Date(dto.valid_from) : null,
        valid_until:   dto.valid_until ? new Date(dto.valid_until) : null,
      },
    });
  }

  @Patch('campaigns/:id')
  updateCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateCampaignDto>,
  ) {
    return this.prisma.referralCampaign.update({
      where: { id },
      data:  {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        ...(dto.valid_from !== undefined && { valid_from: new Date(dto.valid_from) }),
        ...(dto.valid_until !== undefined && { valid_until: new Date(dto.valid_until) }),
      },
    });
  }

  // ── Rules ─────────────────────────────────────────────────────────

  /**
   * GET /api/v1/admin/referrals/rules
   * Returns all rules, sorted by priority desc.
   * Allows admin to understand which rules are active and their config.
   */
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
        rewards:     (dto.rewards as unknown) as Prisma.InputJsonValue,
        max_uses:    dto.max_uses,
        valid_from:  dto.valid_from  ? new Date(dto.valid_from)  : null,
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
      data:  {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.campaign_id !== undefined && { campaign_id: dto.campaign_id }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.conditions !== undefined && { conditions: (dto.conditions as unknown) as Prisma.InputJsonValue }),
        ...(dto.rewards !== undefined && { rewards: (dto.rewards as unknown) as Prisma.InputJsonValue }),
        ...(dto.max_uses !== undefined && { max_uses: dto.max_uses }),
        ...(dto.valid_from !== undefined && { valid_from: new Date(dto.valid_from) }),
        ...(dto.valid_until !== undefined && { valid_until: new Date(dto.valid_until) }),
      },
    });
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRule(@Param('id', ParseUUIDPipe) id: string) {
    const hasLogs = await this.prisma.rewardLog.count({ where: { rule_id: id } });
    if (hasLogs > 0) {
      // Soft-delete: deactivate instead of delete to preserve audit trail
      await this.prisma.referralRewardRule.update({
        where: { id },
        data:  { is_active: false },
      });
      return { deactivated: true, reason: 'Rule has reward history — deactivated instead of deleted' };
    }
    await this.prisma.referralRewardRule.delete({ where: { id } });
  }

  // ── Analytics ─────────────────────────────────────────────────────

  /**
   * GET /api/v1/admin/referrals/analytics
   * Platform-wide referral funnel metrics.
   */
  @Get('analytics')
  async getAnalytics() {
    const [
      totalReferrals,
      byStatus,
      totalRewardsApplied,
      topReferrers,
      rewardsByType,
    ] = await Promise.all([
      this.prisma.referral.count(),

      this.prisma.referral.groupBy({
        by: ['status'],
        _count: true,
      }),

      this.prisma.rewardLog.count({ where: { status: 'applied' } }),

      // Top 10 referrers by number of rewarded referrals
      this.prisma.referral.groupBy({
        by:    ['referrer_studio_id'],
        where: { status: 'rewarded' },
        _count: { referrer_studio_id: true },
        orderBy: { _count: { referrer_studio_id: 'desc' } },
        take: 10,
      }),

      this.prisma.rewardLog.groupBy({
        by:    ['reward_type'],
        where: { status: 'applied' },
        _count: true,
      }),
    ]);

    const referrerStudioIds = topReferrers.map((r: { referrer_studio_id: string }) => r.referrer_studio_id);
    const referrerStudios = await this.prisma.studio.findMany({
      where:  { id: { in: referrerStudioIds } },
      select: { id: true, name: true, referral_code: true },
    });

    const studioMap: Record<string, any> = Object.fromEntries(referrerStudios.map((s) => [s.id, s]));

    return {
      total_referrals:      totalReferrals,
      total_rewards_applied: totalRewardsApplied,
      by_status:            byStatus.map((s: { status: string; _count: number }) => ({ status: s.status, count: s._count })),
      rewards_by_type:      rewardsByType.map((r: { reward_type: string; _count: number }) => ({ type: r.reward_type, count: r._count })),
      top_referrers:        topReferrers.map((r: { referrer_studio_id: string; _count: { referrer_studio_id: number } }) => ({
        studio:         studioMap[r.referrer_studio_id],
        rewarded_count: r._count.referrer_studio_id,
      })),
    };
  }

  /** List all referrals with optional filters */
  @Get()
  listAllReferrals(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.referralsService.listReferrals({
      status,
      page:  page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  /** Reward logs for auditing */
  @Get('reward-logs')
  getRewardLogs(
    @Query('studio_id') studioId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;
    return this.prisma.rewardLog.findMany({
      where:   studioId ? { beneficiary_studio_id: studioId } : {},
      orderBy: { applied_at: 'desc' },
      skip:    (p - 1) * l,
      take:    l,
      include: {
        referral: { select: { referrer_studio: { select: { name: true } }, referred_studio: { select: { name: true } } } },
        rule:     { select: { name: true, priority: true } },
      },
    });
  }
}
