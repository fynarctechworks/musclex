import { Body, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PublicMemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberFriendService } from './member-friend.service';
import {
  FriendPrefsDto,
  FriendRequestDto,
  FriendRespondDto,
  FriendSearchDto,
} from './dto';

/**
 * Friends: requests, feed, kudos and PR comparison.
 *
 * Every route here reads only from `public` — never a gym schema — because a
 * friend is usually at another gym. See MemberFriendService.
 *
 * PublicMemberDataController, not MemberDataController: friendship is a
 * property of the PERSON (app_user), not of their gym membership. Someone
 * between gyms — or never in one — must still keep their friends, which is the
 * whole point of the feature being cross-gym.
 *
 * That decorator's contract is to scope by appUserId and never touch a
 * studio-scoped model for a gym-less user. MemberFriendService reads only
 * `public` tables, and the one path that reaches a tenant model (backfilling
 * PRs when sharing is switched on) returns early without a memberId.
 */
@PublicMemberDataController()
export class MemberFriendController {
  constructor(private readonly friends: MemberFriendService) {}

  /** Find someone by phone number. Deliberately not a name search. */
  @Get('friends/search')
  search(@CurrentMember() member: CurrentMemberContext, @Query() q: FriendSearchDto) {
    return this.friends.search(member, q.phone);
  }

  @Get('friends')
  list(@CurrentMember() member: CurrentMemberContext) {
    return this.friends.list(member);
  }

  @Post('friends/request')
  request(@CurrentMember() member: CurrentMemberContext, @Body() dto: FriendRequestDto) {
    return this.friends.request(member, dto.appUserId);
  }

  @Post('friends/requests/:id/respond')
  respond(
    @CurrentMember() member: CurrentMemberContext,
    @Param('id') id: string,
    @Body() dto: FriendRespondDto,
  ) {
    return this.friends.respond(member, id, dto.accept);
  }

  @Delete('friends/:appUserId')
  remove(@CurrentMember() member: CurrentMemberContext, @Param('appUserId') appUserId: string) {
    return this.friends.remove(member, appUserId);
  }

  /** Friends' published sessions, newest first. */
  @Get('friends/feed')
  feed(@CurrentMember() member: CurrentMemberContext) {
    return this.friends.feed(member);
  }

  @Post('friends/sessions/:id/kudos')
  kudos(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.friends.toggleKudos(member, id);
  }

  /** Lifts you have BOTH recorded, matched on exercise name. */
  @Get('friends/:appUserId/prs')
  comparePrs(
    @CurrentMember() member: CurrentMemberContext,
    @Param('appUserId') appUserId: string,
  ) {
    return this.friends.comparePrs(member, appUserId);
  }

  @Get('friends/me/sharing')
  prefs(@CurrentMember() member: CurrentMemberContext) {
    return this.friends.prefs(member);
  }

  @Patch('friends/me/sharing')
  setPrefs(@CurrentMember() member: CurrentMemberContext, @Body() dto: FriendPrefsDto) {
    return this.friends.setPrefs(member, dto);
  }
}
