import { Body, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { PublicMemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberFeedService } from './member-feed.service';
import { CommentDto } from './dto';

/**
 * The activity feed and everything social attached to it.
 *
 * PublicMemberDataController: following someone is a property of the person,
 * not of their gym membership — the whole point is that it works across gyms
 * and for members between them.
 */
@PublicMemberDataController()
export class MemberFeedController {
  constructor(private readonly feed: MemberFeedService) {}

  @Get('feed')
  list(
    @CurrentMember() member: CurrentMemberContext,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    const n = Number(limit);
    return this.feed.feed(member, before, Number.isFinite(n) && n > 0 ? n : undefined);
  }

  /** Someone else's activity, by the same visibility rule the feed uses. */
  @Get('feed/activities/:id')
  view(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.feed.view(member, id);
  }

  @Get('feed/following')
  following(@CurrentMember() member: CurrentMemberContext) {
    return this.feed.following(member);
  }

  @Get('feed/followers')
  followers(@CurrentMember() member: CurrentMemberContext) {
    return this.feed.followers(member);
  }

  @Post('feed/follow/:appUserId')
  follow(@CurrentMember() member: CurrentMemberContext, @Param('appUserId') id: string) {
    return this.feed.follow(member, id);
  }

  @Delete('feed/follow/:appUserId')
  unfollow(@CurrentMember() member: CurrentMemberContext, @Param('appUserId') id: string) {
    return this.feed.unfollow(member, id);
  }

  @Post('feed/block/:appUserId')
  block(@CurrentMember() member: CurrentMemberContext, @Param('appUserId') id: string) {
    return this.feed.block(member, id);
  }

  @Delete('feed/block/:appUserId')
  unblock(@CurrentMember() member: CurrentMemberContext, @Param('appUserId') id: string) {
    return this.feed.unblock(member, id);
  }

  @Post('feed/activities/:id/kudos')
  kudos(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.feed.giveKudos(member, id);
  }

  @Delete('feed/activities/:id/kudos')
  unkudos(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.feed.removeKudos(member, id);
  }

  @Get('feed/activities/:id/comments')
  comments(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.feed.comments(member, id);
  }

  @Post('feed/activities/:id/comments')
  addComment(
    @CurrentMember() member: CurrentMemberContext,
    @Param('id') id: string,
    @Body() dto: CommentDto,
  ) {
    return this.feed.addComment(member, id, dto.body);
  }

  @Delete('feed/comments/:commentId')
  deleteComment(
    @CurrentMember() member: CurrentMemberContext,
    @Param('commentId') commentId: string,
  ) {
    return this.feed.deleteComment(member, commentId);
  }
}
