import { Body, Delete, Get, Header, Param, Post, Query } from '@nestjs/common';
import { PublicMemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { RawResponse } from '../decorators/raw-response.decorator';
import { MemberRouteService } from './member-route.service';
import { RouteCreateDto, RouteImportDto } from './dto';

/**
 * Saved routes.
 *
 * PublicMemberDataController: a route belongs to the person, like an activity —
 * it does not stop being theirs when they change gyms.
 */
@PublicMemberDataController()
export class MemberRouteController {
  constructor(private readonly routes: MemberRouteService) {}

  @Get('routes')
  list(@CurrentMember() member: CurrentMemberContext) {
    return this.routes.list(member);
  }

  /** Routes starting near a position. Answered by PostGIS, not by Node. */
  @Get('routes/near')
  near(
    @CurrentMember() member: CurrentMemberContext,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
    @Query('sport') sport?: string,
  ) {
    const r = Number(radius);
    return this.routes.near(
      member,
      Number(lat),
      Number(lng),
      Number.isFinite(r) && r > 0 ? r : undefined,
      sport,
    );
  }

  @Get('routes/:id')
  get(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.routes.get(member, id);
  }

  /**
   * The route as a GPX file.
   *
   * text/xml rather than JSON: this is a file meant to open in somebody else's
   * software, and wrapping it in an envelope would mean unwrapping it first.
   */
  @Get('routes/:id/gpx')
  @RawResponse()
  @Header('Content-Type', 'application/gpx+xml')
  exportGpx(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.routes.exportGpx(member, id);
  }

  @Post('routes')
  create(@CurrentMember() member: CurrentMemberContext, @Body() dto: RouteCreateDto) {
    return this.routes.create(member, dto);
  }

  @Post('routes/import')
  importGpx(@CurrentMember() member: CurrentMemberContext, @Body() dto: RouteImportDto) {
    return this.routes.importGpx(member, dto);
  }

  @Delete('routes/:id')
  remove(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.routes.remove(member, id);
  }
}
