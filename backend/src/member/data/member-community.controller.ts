import { Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberCommunityService } from './member-community.service';

/**
 * Community endpoints (V2.5): attendance leaderboard, gym challenges + join, and
 * earned badges — all computed from / backed by real activity. Reads are
 * gym-scoped; the leaderboard exposes first names only.
 */
@MemberDataController()
export class MemberCommunityController {
  constructor(private readonly community: MemberCommunityService) {}

  @Get('community/leaderboard')
  leaderboard(
    @CurrentMember() member: CurrentMemberContext,
    @Query('period') period?: string,
  ) {
    const days = period ? parseInt(period, 10) : 30;
    return this.community.leaderboard(member, Number.isFinite(days) ? days : 30);
  }

  @Get('community/challenges')
  challenges(@CurrentMember() member: CurrentMemberContext) {
    return this.community.challenges(member);
  }

  @Post('community/challenges/:challengeId/join')
  @HttpCode(200)
  join(
    @CurrentMember() member: CurrentMemberContext,
    @Param('challengeId') challengeId: string,
  ) {
    return this.community.join(member, challengeId);
  }

  @Get('community/badges')
  badges(@CurrentMember() member: CurrentMemberContext) {
    return this.community.badges(member);
  }
}
