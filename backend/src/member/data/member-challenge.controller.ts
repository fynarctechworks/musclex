import { Body, Delete, Get, Param, Post } from '@nestjs/common';
import { PublicMemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberChallengeService } from './member-challenge.service';
import { GroupChallengeDto } from './dto';

/**
 * Member-made challenges.
 *
 * Mounted at `group-challenges/*`, not `community/challenges/*`, which is the
 * gym-run surface with a different owner and a different scope. Same word,
 * different feature — the paths keep them apart.
 */
@PublicMemberDataController()
export class MemberChallengeController {
  constructor(private readonly challenges: MemberChallengeService) {}

  @Get('group-challenges')
  mine(@CurrentMember() member: CurrentMemberContext) {
    return this.challenges.mine(member);
  }

  @Post('group-challenges')
  create(@CurrentMember() member: CurrentMemberContext, @Body() dto: GroupChallengeDto) {
    return this.challenges.create(member, dto);
  }

  @Get('group-challenges/:id')
  get(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.challenges.get(member, id);
  }

  @Post('group-challenges/:id/join')
  join(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.challenges.join(member, id);
  }

  @Delete('group-challenges/:id/join')
  leave(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.challenges.leave(member, id);
  }

  @Post('group-challenges/:id/invite/:appUserId')
  invite(
    @CurrentMember() member: CurrentMemberContext,
    @Param('id') id: string,
    @Param('appUserId') appUserId: string,
  ) {
    return this.challenges.invite(member, id, appUserId);
  }
}
