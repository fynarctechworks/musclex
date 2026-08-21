import { Body, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { PublicMemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberSegmentService } from './member-segment.service';
import { SegmentCreateDto } from './dto';

/**
 * Segments and their leaderboards.
 *
 * Segments are public by nature — racing a stretch only means something if
 * other people can — so unlike activities there is no per-segment visibility.
 * What stays private is the ACTIVITY behind an effort: the board shows a name
 * and a time, never the track it came from.
 */
@PublicMemberDataController()
export class MemberSegmentController {
  constructor(private readonly segments: MemberSegmentService) {}

  @Get('segments/near')
  near(
    @CurrentMember() member: CurrentMemberContext,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    const r = Number(radius);
    return this.segments.near(member, Number(lat), Number(lng), Number.isFinite(r) && r > 0 ? r : undefined);
  }

  @Get('segments/starred')
  starred(@CurrentMember() member: CurrentMemberContext) {
    return this.segments.starred(member);
  }

  @Get('segments/:id')
  get(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.segments.get(member, id);
  }

  @Post('segments')
  create(@CurrentMember() member: CurrentMemberContext, @Body() dto: SegmentCreateDto) {
    return this.segments.create(member, dto);
  }

  /** Re-run matching for an activity. Idempotent — efforts are unique per pair. */
  @Post('activities/:id/segments')
  match(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.segments.matchActivity(member, id);
  }

  @Post('segments/:id/star')
  star(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.segments.toggleStar(member, id);
  }

  @Delete('segments/:id/star')
  unstar(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.segments.toggleStar(member, id);
  }
}
