import { Body, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { PublicMemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberActivityService } from './member-activity.service';
import { ActivityCreateDto, ActivityStreamsDto, ActivityUpdateDto } from './dto';

/**
 * Activities: recorded, imported or typed in, of any sport.
 *
 * PublicMemberDataController, not MemberDataController: an activity belongs to
 * the PERSON. Someone between gyms — or who has never joined one — still runs,
 * and must still be able to record it. Every route is scoped by the appUserId
 * on the verified token; the service takes no id from the client for ownership.
 */
@PublicMemberDataController()
export class MemberActivityController {
  constructor(private readonly activities: MemberActivityService) {}

  /** The sports the server will accept, so the app never hard-codes a list
   *  that then drifts from what validation allows. */
  @Get('activities/sports')
  sports() {
    return this.activities.sports();
  }

  @Get('activities')
  list(
    @CurrentMember() member: CurrentMemberContext,
    @Query('limit') limit?: string,
    /** Keyset cursor: the startedAt of the last row you were given. */
    @Query('before') before?: string,
    @Query('sport') sport?: string,
  ) {
    const n = Number(limit);
    return this.activities.list(member, {
      limit: Number.isFinite(n) && n > 0 ? n : undefined,
      before,
      sport,
    });
  }

  @Get('activities/:id')
  get(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.activities.get(member, id);
  }

  @Post('activities')
  create(@CurrentMember() member: CurrentMemberContext, @Body() dto: ActivityCreateDto) {
    return this.activities.create(member, dto);
  }

  @Patch('activities/:id')
  update(
    @CurrentMember() member: CurrentMemberContext,
    @Param('id') id: string,
    @Body() dto: ActivityUpdateDto,
  ) {
    return this.activities.update(member, id, dto);
  }

  /**
   * PUT, not POST: the recorded series replaces whatever is stored for that
   * type, so a retried upload on a bad connection cannot store the ride twice.
   */
  @Put('activities/:id/streams')
  putStreams(
    @CurrentMember() member: CurrentMemberContext,
    @Param('id') id: string,
    @Body() dto: ActivityStreamsDto,
  ) {
    return this.activities.putStreams(member, id, dto);
  }

  @Delete('activities/:id')
  remove(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.activities.remove(member, id);
  }
}
