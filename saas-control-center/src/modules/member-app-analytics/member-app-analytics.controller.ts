import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Response } from 'express';
import { MemberAppAnalyticsService } from './member-app-analytics.service';
import { MemberAppCampaignsService } from './member-app-campaigns.service';

class CreateCampaignDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  body!: string;

  @IsIn(['public', 'lead', 'expired', 'active', 'inactive', 'incomplete_onboarding'])
  targetSegment!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deepLink?: string;
}

class UpdateAutomationDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  cooldownDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deepLink?: string;
}

/**
 * Member-app (public fitness platform) analytics for the control center.
 * All routes are super-admin (global) — protected by the app-wide JwtAuthGuard.
 */
@ApiTags('Member App Analytics')
@ApiBearerAuth()
@Controller('member-app')
export class MemberAppAnalyticsController {
  constructor(
    private readonly svc: MemberAppAnalyticsService,
    private readonly campaigns: MemberAppCampaignsService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Member-app KPI overview' })
  overview() {
    return this.svc.overview();
  }

  @Get('growth')
  @ApiOperation({ summary: 'Daily registration growth' })
  growth(@Query('days') days?: number) {
    return this.svc.growth(days ? Number(days) : 30);
  }

  @Get('segments')
  @ApiOperation({ summary: 'User segmentation breakdown' })
  segments() {
    return this.svc.segments();
  }

  @Get('funnel')
  @ApiOperation({ summary: 'Registration → conversion funnel' })
  funnel() {
    return this.svc.funnel();
  }

  @Get('leads')
  @ApiOperation({ summary: 'Leads (registered, no gym membership)' })
  leads(
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.users({
      type: 'leads',
      search,
      city,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
    });
  }

  @Get('leads/export')
  @ApiOperation({ summary: 'Export leads as CSV' })
  async exportLeads(
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('city') city?: string,
  ) {
    const csv = await this.svc.exportLeadsCsv(search, city);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(csv);
  }

  @Get('crm')
  @ApiOperation({ summary: 'CRM — all app users with membership status' })
  crm(
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.users({
      type: 'crm',
      search,
      city,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
    });
  }

  @Get('referrals')
  @ApiOperation({ summary: 'Referral / acquisition-source analytics' })
  referrals() {
    return this.svc.referrals();
  }

  @Get('referral-chain')
  @ApiOperation({ summary: 'Referral chain: registrations, conversions, top referrers' })
  referralChain() {
    return this.svc.referralChain();
  }

  @Get('campaign-audiences')
  @ApiOperation({ summary: 'Addressable segment audience sizes' })
  campaignAudiences() {
    return this.svc.campaignAudiences();
  }

  // ── Campaigns (Phase 5b) ──
  @Get('campaigns')
  @ApiOperation({ summary: 'List notification campaigns' })
  listCampaigns() {
    return this.campaigns.list();
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Create a draft campaign' })
  createCampaign(@Body() dto: CreateCampaignDto) {
    return this.campaigns.create(dto);
  }

  @Post('campaigns/:id/send')
  @ApiOperation({ summary: 'Send a campaign to its target segment' })
  sendCampaign(@Param('id') id: string) {
    return this.campaigns.send(id);
  }

  // ── Automations (Phase 7.6) ──
  @Get('automations')
  @ApiOperation({ summary: 'List campaign automations + their delivery stats' })
  listAutomations() {
    return this.campaigns.listAutomations();
  }

  @Patch('automations/:key')
  @ApiOperation({ summary: 'Update / enable / disable an automation' })
  updateAutomation(@Param('key') key: string, @Body() dto: UpdateAutomationDto) {
    return this.campaigns.updateAutomation(key, dto);
  }

  @Post('automations/:key/run')
  @ApiOperation({ summary: 'Run an automation now (respects cooldown)' })
  runAutomation(@Param('key') key: string) {
    return this.campaigns.runAutomation(key);
  }
}
