import { Body, Get, Post } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberCoachService } from './member-coach.service';

export class CoachChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;
}

/**
 * Member AI coach:
 *   GET  member/v1/coach — conversation history (one rolling thread)
 *   POST member/v1/coach/chat — send a message, get the coach's reply
 */
@MemberDataController()
export class MemberCoachController {
  constructor(private readonly coach: MemberCoachService) {}

  @Get('coach')
  conversation(@CurrentMember() member: CurrentMemberContext) {
    return this.coach.getConversation(member);
  }

  @Post('coach/chat')
  chat(@CurrentMember() member: CurrentMemberContext, @Body() dto: CoachChatDto) {
    return this.coach.chat(member, dto.message);
  }
}
