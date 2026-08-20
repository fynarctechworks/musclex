import { Body, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberRoutineService } from './member-routine.service';
import { RoutineDto, RoutineUpdateDto, ImportRoutineDto } from './dto';

/**
 * Member-authored routines: personal, with link sharing.
 *
 * Every route resolves the member from the token and scopes by member_id on top
 * of the gym_id the tenant layer injects — a routine id from another member (or
 * another gym) simply does not resolve.
 *
 * `shared/:token` is the one exception and is deliberately gym-agnostic: it
 * reads a public snapshot that contains no tenant data at all. It still
 * requires a signed-in member, so links are not crawlable by anonymous callers.
 */
@MemberDataController()
export class MemberRoutineController {
  constructor(private readonly routines: MemberRoutineService) {}

  @Get('routines')
  list(@CurrentMember() member: CurrentMemberContext) {
    return this.routines.list(member);
  }

  @Get('routines/shared/:token')
  preview(@Param('token') token: string) {
    return this.routines.preview(token);
  }

  @Get('routines/:id')
  get(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.routines.get(member, id);
  }

  @Post('routines')
  @HttpCode(201)
  create(@CurrentMember() member: CurrentMemberContext, @Body() dto: RoutineDto) {
    return this.routines.create(member, dto);
  }

  @Post('routines/import')
  @HttpCode(201)
  import(@CurrentMember() member: CurrentMemberContext, @Body() dto: ImportRoutineDto) {
    return this.routines.importShared(member, dto.token);
  }

  @Post('routines/:id/share')
  @HttpCode(201)
  share(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.routines.share(member, id);
  }

  @Patch('routines/:id')
  update(
    @CurrentMember() member: CurrentMemberContext,
    @Param('id') id: string,
    @Body() dto: RoutineUpdateDto,
  ) {
    return this.routines.update(member, id, dto);
  }

  @Delete('routines/:id')
  remove(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.routines.remove(member, id);
  }
}
