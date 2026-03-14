import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MembershipService } from './membership.service';
import { RenewalsService } from './renewals.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AssignMembershipDto, FreezeMembershipDto } from './dto';

@Controller('api/v1/memberships')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MembershipsController {
  constructor(
    private readonly membershipService: MembershipService,
    private readonly renewalsService: RenewalsService,
  ) {}

  // ── Assign membership to a member ─────────────────────────

  @Post('assign/:memberId')
  @Roles('owner', 'branch_manager', 'front_desk')
  assign(
    @Param('memberId') memberId: string,
    @Body() dto: AssignMembershipDto,
  ) {
    return this.membershipService.assign(memberId, dto);
  }

  // ── Get all memberships for a member ──────────────────────

  @Get('member/:memberId')
  findByMember(
    @Param('memberId') memberId: string,
    @Query('status') status?: string,
  ) {
    return this.membershipService.findByMember(memberId, status);
  }

  // ── Get single membership ─────────────────────────────────

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.membershipService.findOne(id);
  }

  // ── Freeze membership ─────────────────────────────────────

  @Post(':id/freeze')
  @Roles('owner', 'branch_manager')
  freeze(@Param('id') id: string, @Body() dto: FreezeMembershipDto) {
    return this.membershipService.freeze(id, dto);
  }

  // ── Unfreeze membership ───────────────────────────────────

  @Post(':id/unfreeze')
  @Roles('owner', 'branch_manager')
  unfreeze(@Param('id') id: string) {
    return this.membershipService.unfreeze(id);
  }

  // ── Cancel membership ─────────────────────────────────────

  @Post(':id/cancel')
  @Roles('owner', 'branch_manager')
  cancel(@Param('id') id: string) {
    return this.membershipService.cancel(id);
  }

  // ── Renew membership ──────────────────────────────────────

  @Post(':id/renew')
  @Roles('owner', 'branch_manager', 'front_desk')
  renew(
    @Param('id') id: string,
    @Body('payment_method') paymentMethod?: string,
  ) {
    return this.membershipService.renew(id, paymentMethod);
  }

  // ── Toggle auto-renew ─────────────────────────────────────

  @Patch(':id/auto-renew')
  toggleAutoRenew(
    @Param('id') id: string,
    @Body('enabled') enabled: boolean,
  ) {
    return this.membershipService.toggleAutoRenew(id, enabled);
  }

  // ── Track visit ───────────────────────────────────────────

  @Post(':id/track-visit')
  trackVisit(@Param('id') id: string) {
    return this.membershipService.trackVisit(id);
  }

  // ── Membership stats ──────────────────────────────────────

  @Get('stats/summary')
  @Roles('owner', 'branch_manager')
  getStats(@Query('branch_id') branch_id?: string) {
    return this.membershipService.getStats({ branch_id });
  }

  // ── Admin: Trigger cron jobs manually ─────────────────────

  @Post('admin/run-expiry')
  @Roles('owner')
  runExpiry() {
    return this.renewalsService.runExpiryManually();
  }

  @Post('admin/run-auto-renew')
  @Roles('owner')
  runAutoRenew() {
    return this.renewalsService.runAutoRenewManually();
  }
}
