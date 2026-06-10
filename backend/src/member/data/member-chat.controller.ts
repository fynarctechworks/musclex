import { Body, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { Idempotent } from '../decorators/idempotent.decorator';
import { MemberChatService } from './member-chat.service';
import { SendMessageDto } from './dto';

/**
 * Trainer Chat endpoints (Member App V2.3): list threads, read a conversation,
 * send a message. The trainer is validated against the member's active
 * TrainerClient links; sends are idempotent for offline-outbox safety.
 */
@MemberDataController()
export class MemberChatController {
  constructor(private readonly chat: MemberChatService) {}

  @Get('trainer-chat/threads')
  threads(@CurrentMember() member: CurrentMemberContext) {
    return this.chat.threads(member);
  }

  @Get('trainer-chat/threads/:trainerId/messages')
  messages(
    @CurrentMember() member: CurrentMemberContext,
    @Param('trainerId') trainerId: string,
  ) {
    return this.chat.messages(member, trainerId);
  }

  @Post('trainer-chat/threads/:trainerId/messages')
  @HttpCode(201)
  @Idempotent()
  send(
    @CurrentMember() member: CurrentMemberContext,
    @Param('trainerId') trainerId: string,
    @Body() dto: SendMessageDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.chat.send(member, trainerId, dto.body, idempotencyKey);
  }
}
