import { Get, Query } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberIdentityService } from './member-identity.service';

/**
 * Member digital ID card + visit history.
 *
 *   GET /member/v1/id              → signed static + rolling QR for the member's card
 *   GET /member/v1/visits          → paged own check-in history
 *   GET /member/v1/visits/summary  → per-month + per-day counts for the calendar
 */
@MemberDataController()
export class MemberIdentityController {
  constructor(private readonly identity: MemberIdentityService) {}

  @Get('id')
  getDigitalId(@CurrentMember() member: CurrentMemberContext) {
    return this.identity.getDigitalId(member);
  }

  @Get('visits')
  getVisits(
    @CurrentMember() member: CurrentMemberContext,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.identity.getVisits(member, {
      limit: limit ? Number(limit) : undefined,
      cursor: cursor || undefined,
    });
  }

  @Get('visits/summary')
  getVisitSummary(
    @CurrentMember() member: CurrentMemberContext,
    @Query('months') months?: string,
  ) {
    return this.identity.getVisitSummary(
      member,
      months ? Number(months) : undefined,
    );
  }
}
