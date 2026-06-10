import { Body, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import {
  CurrentMember,
  CurrentMemberContext,
} from '../decorators/current-member.decorator';
import { Idempotent } from '../decorators/idempotent.decorator';
import { MemberHealthService } from './member-health.service';
import { HealthSampleBatchDto, WearableConnectDto } from './dto';

/**
 * Health Data Platform endpoints: ingest wearable telemetry, read daily
 * rollups, and manage provider connections. Member identity is always resolved
 * from @CurrentMember; no memberId/tenantId is accepted from the client.
 */
@MemberDataController()
export class MemberHealthController {
  constructor(private readonly health: MemberHealthService) {}

  @Post('health/samples')
  @HttpCode(201)
  @Idempotent()
  ingest(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: HealthSampleBatchDto,
  ) {
    return this.health.ingest(member, dto.samples);
  }

  @Get('health/summary')
  summary(
    @CurrentMember() member: CurrentMemberContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('types') types?: string,
  ) {
    return this.health.getSummary(member, from, to, types);
  }

  @Get('health/connections')
  connections(@CurrentMember() member: CurrentMemberContext) {
    return this.health.listConnections(member);
  }

  @Post('health/connections')
  connect(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: WearableConnectDto,
  ) {
    return this.health.connect(member, dto);
  }

  @Delete('health/connections/:provider')
  revoke(
    @CurrentMember() member: CurrentMemberContext,
    @Param('provider') provider: string,
  ) {
    return this.health.revoke(member, provider);
  }
}
