import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { AiChatDto } from './dto/ai-chat.dto';

@Controller('api/v1/ai')
@UseGuards(JwtAuthGuard)
@Throttle({ short: { limit: 10, ttl: 60000 } })
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  chat(
    @Body() data: AiChatDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.aiService.chat({
      message: data.message,
      conversation_id: data.conversation_id,
      staff_id: user.user_id,
    });
  }

  @Get('daily-briefing')
  getDailyBriefing() {
    return this.aiService.getDailyBriefing();
  }

  @Get('conversations')
  getConversations(@CurrentUser() user: JwtPayload) {
    return this.aiService.getConversations(user.user_id);
  }
}
