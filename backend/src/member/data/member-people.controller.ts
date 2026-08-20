import { Body, Get, Param, Post } from '@nestjs/common';
import { PublicMemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberPeopleService } from './member-people.service';
import { ContactMatchDto } from './dto';

/** Finding other members: suggestions, a QR code, and hashed contact matching. */
@PublicMemberDataController()
export class MemberPeopleController {
  constructor(private readonly people: MemberPeopleService) {}

  @Get('people/suggestions')
  suggestions(@CurrentMember() member: CurrentMemberContext) {
    return this.people.suggestions(member);
  }

  /** What this member's own QR encodes. */
  @Get('people/me/code')
  myCode(@CurrentMember() member: CurrentMemberContext) {
    return this.people.myCode(member);
  }

  /**
   * Match hashed contacts.
   *
   * POST because it carries a body, not because it creates anything — nothing
   * from this request is stored.
   */
  @Post('people/contacts')
  contacts(@CurrentMember() member: CurrentMemberContext, @Body() dto: ContactMatchDto) {
    return this.people.matchContacts(member, dto.hashes);
  }

  @Get('people/:appUserId')
  profile(@CurrentMember() member: CurrentMemberContext, @Param('appUserId') id: string) {
    return this.people.profile(member, id);
  }
}
