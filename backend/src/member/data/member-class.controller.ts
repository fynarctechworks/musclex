import { Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { Idempotent } from '../decorators/idempotent.decorator';
import { MemberClassService } from './member-class.service';

/**
 * Member class browse + self-book + cancel. The member is always resolved from
 * @CurrentMember; the classId in the path is validated server-side (member's
 * branch, future, not cancelled) before any write. Booking is @Idempotent so an
 * offline-outbox retry can't double-book.
 */
@MemberDataController()
export class MemberClassController {
  constructor(private readonly classes: MemberClassService) {}

  @Get('classes')
  list(@CurrentMember() member: CurrentMemberContext) {
    return this.classes.listUpcoming(member);
  }

  @Post('classes/:classId/book')
  @HttpCode(201)
  @Idempotent()
  book(
    @CurrentMember() member: CurrentMemberContext,
    @Param('classId') classId: string,
  ) {
    return this.classes.book(member, classId);
  }

  @Delete('classes/:classId/booking')
  cancel(
    @CurrentMember() member: CurrentMemberContext,
    @Param('classId') classId: string,
  ) {
    return this.classes.cancel(member, classId);
  }
}
