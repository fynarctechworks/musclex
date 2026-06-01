import { Body, Get, HttpCode, Post } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { Idempotent } from '../decorators/idempotent.decorator';
import { MemberDataService } from './member-data.service';
import { BodyMetricDto } from './dto';

/**
 * Core-loop read endpoints + body-metric logging. Every handler derives the
 * member from @CurrentMember (the verified token) — never from the client.
 * Responses are wrapped in { data, meta } by EnvelopeInterceptor.
 */
@MemberDataController()
export class MemberCoreController {
  constructor(private readonly data: MemberDataService) {}

  @Get('me')
  me(@CurrentMember() member: CurrentMemberContext) {
    return this.data.getProfile(member);
  }

  @Get('home')
  home(@CurrentMember() member: CurrentMemberContext) {
    return this.data.getHome(member);
  }

  @Get('gym/occupancy')
  occupancy(@CurrentMember() member: CurrentMemberContext) {
    return this.data.getOccupancy(member);
  }

  @Get('membership')
  membership(@CurrentMember() member: CurrentMemberContext) {
    return this.data.getMembership(member);
  }

  @Get('progress')
  progress(@CurrentMember() member: CurrentMemberContext) {
    return this.data.getProgress(member);
  }

  @Post('progress/metrics')
  @HttpCode(201)
  @Idempotent()
  addMetric(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: BodyMetricDto,
  ) {
    return this.data.addMetric(member, dto);
  }
}
