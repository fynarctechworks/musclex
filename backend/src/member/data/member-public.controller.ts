import { Body, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { PublicMemberDataController } from '../decorators/member-data-controller.decorator';
import {
  CurrentMember,
  CurrentMemberContext,
} from '../decorators/current-member.decorator';
import { MemberContextService } from './member-context.service';
import { MemberPublicHealthService } from './member-public-health.service';
import { MemberEventsService } from './member-events.service';
import { MemberDiscoveryService } from './member-discovery.service';
import { MemberPublicProfileService } from './member-public-profile.service';
import { AppUserService } from '../app-user/app-user.service';
import {
  WeightInputDto,
  WaterInputDto,
  GoalInputDto,
  GoalUpdateDto,
  HealthDailyInputDto,
  EventBatchDto,
  AppDeviceTokenDto,
  AppDeviceTokenDeleteDto,
  ReferralApplyDto,
  UpdateProfileDto,
  ToolsComputeDto,
  NotificationAckDto,
} from './dto';

/**
 * Endpoints available to ANY authenticated app user, including gym-less PUBLIC
 * users (uses PublicMemberDataController → no GymMemberGuard). Every handler
 * scopes by appUserId from the verified token; none touch studio-scoped data.
 */
@PublicMemberDataController()
export class MemberPublicController {
  constructor(
    private readonly context: MemberContextService,
    private readonly health: MemberPublicHealthService,
    private readonly events: MemberEventsService,
    private readonly discovery: MemberDiscoveryService,
    private readonly appUsers: AppUserService,
    private readonly profile: MemberPublicProfileService,
  ) {}

  @Get('me/context')
  meContext(@CurrentMember() member: CurrentMemberContext) {
    return this.context.getContext(member);
  }

  // ── Fitness profile (Phase 7.1 — public onboarding + edits) ──
  @Get('me/profile')
  getProfile(@CurrentMember() member: CurrentMemberContext) {
    return this.profile.getProfile(member.appUserId);
  }

  @Patch('me/profile')
  updateProfile(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profile.updateProfile(member.appUserId, dto);
  }

  // ── Retention: weekly progress (Phase 7.7) ──
  @Get('me/weekly')
  weekly(@CurrentMember() member: CurrentMemberContext) {
    return this.profile.weekly(member.appUserId);
  }

  // ── Fitness calculators (Phase 7.4) ──
  @Post('me/tools/compute')
  @HttpCode(200)
  computeTools(@Body() dto: ToolsComputeDto) {
    return this.profile.computeTools(dto);
  }

  // ── Gym profile page (Phase 7.5) ──
  @Get('me/gyms/:tenantId')
  gymProfile(@Param('tenantId') tenantId: string) {
    return this.discovery.gymProfile(tenantId);
  }

  // ── Conversion: public gym directory (Phase 5) ──
  @Get('me/nearby-gyms')
  nearbyGyms(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('q') q?: string,
  ) {
    return this.discovery.nearbyGyms(
      lat != null ? Number(lat) : undefined,
      lng != null ? Number(lng) : undefined,
      q,
    );
  }

  // ── Funnel / behaviour events (Phase 3) ──
  @Post('me/events')
  @HttpCode(200)
  ingestEvents(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: EventBatchDto,
  ) {
    return this.events.ingest(member.appUserId, dto.events);
  }

  // ── Push device tokens (Phase 5b) ──
  @Post('me/device-tokens')
  @HttpCode(200)
  async registerDeviceToken(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: AppDeviceTokenDto,
  ) {
    await this.appUsers.registerDeviceToken(member.appUserId, dto.token, dto.platform);
    return { ok: true };
  }

  @Delete('me/device-tokens')
  @HttpCode(200)
  async deleteDeviceToken(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: AppDeviceTokenDeleteDto,
  ) {
    await this.appUsers.deleteDeviceToken(member.appUserId, dto.token);
    return { ok: true };
  }

  // ── Campaign delivery ack (Phase 7.6) ──
  @Post('me/notifications/ack')
  @HttpCode(200)
  async ackNotification(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: NotificationAckDto,
  ) {
    await this.appUsers.ackDelivery(member.appUserId, dto.deliveryId, dto.action);
    return { ok: true };
  }

  // ── Referral attribution (Phase 5c) ──
  @Post('me/referral')
  @HttpCode(200)
  applyReferral(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: ReferralApplyDto,
  ) {
    return this.appUsers.applyReferral(member.appUserId, dto.code);
  }

  // ── Weight ──
  @Get('me/weight')
  getWeight(
    @CurrentMember() member: CurrentMemberContext,
    @Query('days') days?: string,
  ) {
    return this.health.getWeight(member.appUserId, days ? Number(days) : 90);
  }

  @Post('me/weight')
  logWeight(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: WeightInputDto,
  ) {
    return this.health.logWeight(member.appUserId, dto);
  }

  // ── Water ──
  @Get('me/water')
  getWater(
    @CurrentMember() member: CurrentMemberContext,
    @Query('date') date?: string,
  ) {
    return this.health.getWater(member.appUserId, date);
  }

  @Post('me/water')
  logWater(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: WaterInputDto,
  ) {
    return this.health.logWater(member.appUserId, dto);
  }

  // ── Goals ──
  @Get('me/goals')
  listGoals(@CurrentMember() member: CurrentMemberContext) {
    return this.health.listGoals(member.appUserId);
  }

  @Post('me/goals')
  @HttpCode(201)
  createGoal(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: GoalInputDto,
  ) {
    return this.health.createGoal(member.appUserId, dto);
  }

  @Patch('me/goals/:goalId')
  updateGoal(
    @CurrentMember() member: CurrentMemberContext,
    @Param('goalId') goalId: string,
    @Body() dto: GoalUpdateDto,
  ) {
    return this.health.updateGoal(member.appUserId, goalId, dto);
  }

  // ── On-device health daily ──
  @Get('me/health/daily')
  getHealthDaily(
    @CurrentMember() member: CurrentMemberContext,
    @Query('days') days?: string,
  ) {
    return this.health.getHealthDaily(member.appUserId, days ? Number(days) : 30);
  }

  @Post('me/health/daily')
  upsertHealthDaily(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: HealthDailyInputDto,
  ) {
    return this.health.upsertHealthDaily(member.appUserId, dto);
  }
}
