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
import { ResourceLimitService } from '../common/services/resource-limit.service';
import { AiChatDto } from './dto/ai-chat.dto';

@Controller('api/v1/ai')
@UseGuards(JwtAuthGuard)
@Throttle({ short: { limit: 10, ttl: 60000 } })
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly resourceLimits: ResourceLimitService,
  ) {}

  @Post('chat')
  async chat(
    @Body() data: AiChatDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.resourceLimits.checkFeatureAccess(user.studio_id, 'ai_advisor');
    return this.aiService.chat({
      message: data.message,
      conversation_id: data.conversation_id,
      staff_id: user.user_id,
      view_context: data.view_context,
      user_role: user.role,
    });
  }

  @Get('daily-briefing')
  async getDailyBriefing(@CurrentUser() user: JwtPayload) {
    await this.resourceLimits.checkFeatureAccess(user.studio_id, 'ai_advisor');
    return this.aiService.getDailyBriefing();
  }

  @Get('conversations')
  getConversations(@CurrentUser() user: JwtPayload) {
    return this.aiService.getConversations(user.user_id);
  }
}
