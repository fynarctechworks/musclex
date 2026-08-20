import { Body, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { PublicMemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberClubService } from './member-club.service';
import { ClubCreateDto, ClubEventDto, RsvpDto } from './dto';

/**
 * Clubs and their events.
 *
 * PublicMemberDataController: a club is a group of people and routinely spans
 * gyms, so it belongs to the app_user rather than to any one tenant.
 */
@PublicMemberDataController()
export class MemberClubController {
  constructor(private readonly clubs: MemberClubService) {}

  /** Public clubs only — a private club is unlisted by definition. */
  @Get('clubs/discover')
  discover(@CurrentMember() member: CurrentMemberContext, @Query('sport') sport?: string) {
    return this.clubs.discover(member, sport);
  }

  @Get('clubs')
  mine(@CurrentMember() member: CurrentMemberContext) {
    return this.clubs.myClubs(member);
  }

  @Post('clubs')
  create(@CurrentMember() member: CurrentMemberContext, @Body() dto: ClubCreateDto) {
    return this.clubs.create(member, dto);
  }

  @Get('clubs/:id')
  get(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.clubs.get(member, id);
  }

  @Post('clubs/:id/join')
  join(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.clubs.join(member, id);
  }

  @Delete('clubs/:id/join')
  leave(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.clubs.leave(member, id);
  }

  @Get('clubs/:id/members')
  members(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.clubs.members(member, id);
  }

  @Get('clubs/:id/feed')
  feed(
    @CurrentMember() member: CurrentMemberContext,
    @Param('id') id: string,
    @Query('before') before?: string,
  ) {
    return this.clubs.feed(member, id, before);
  }

  @Get('clubs/:id/events')
  events(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.clubs.events(member, id);
  }

  @Post('clubs/:id/events')
  createEvent(
    @CurrentMember() member: CurrentMemberContext,
    @Param('id') id: string,
    @Body() dto: ClubEventDto,
  ) {
    return this.clubs.createEvent(member, id, dto);
  }

  @Post('clubs/events/:eventId/rsvp')
  rsvp(
    @CurrentMember() member: CurrentMemberContext,
    @Param('eventId') eventId: string,
    @Body() dto: RsvpDto,
  ) {
    return this.clubs.rsvp(member, eventId, dto.status ?? null);
  }
}
