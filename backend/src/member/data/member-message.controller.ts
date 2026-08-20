import { Body, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { PublicMemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberMessageService } from './member-message.service';
import { MessagePrivacyDto, ReportDto, SendDirectMessageDto } from './dto';

/**
 * Member-to-member direct messages.
 *
 * Distinct from `trainer-chat/*`, which is a member talking to gym STAFF and
 * is gym-scoped. This is one person to another, across gyms or with no gym at
 * all, so it belongs to the app_user.
 */
@PublicMemberDataController()
export class MemberMessageController {
  constructor(private readonly messages: MemberMessageService) {}

  @Get('messages')
  list(@CurrentMember() member: CurrentMemberContext) {
    return this.messages.list(member);
  }

  /** Find or create the single thread with this person. */
  @Post('messages/with/:appUserId')
  open(@CurrentMember() member: CurrentMemberContext, @Param('appUserId') id: string) {
    return this.messages.open(member, id);
  }

  @Get('messages/:conversationId')
  thread(
    @CurrentMember() member: CurrentMemberContext,
    @Param('conversationId') conversationId: string,
  ) {
    return this.messages.messages(member, conversationId);
  }

  @Post('messages/:conversationId')
  send(
    @CurrentMember() member: CurrentMemberContext,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendDirectMessageDto,
  ) {
    return this.messages.send(member, conversationId, dto.body);
  }

  @Delete('messages/item/:messageId')
  remove(@CurrentMember() member: CurrentMemberContext, @Param('messageId') messageId: string) {
    return this.messages.deleteMessage(member, messageId);
  }

  @Patch('messages/privacy')
  privacy(@CurrentMember() member: CurrentMemberContext, @Body() dto: MessagePrivacyDto) {
    return this.messages.setMessagePrivacy(member, dto.value);
  }

  /** Report anything — a message, a comment, an activity, a person, a club. */
  @Post('reports')
  report(@CurrentMember() member: CurrentMemberContext, @Body() dto: ReportDto) {
    return this.messages.report(member, dto);
  }
}
