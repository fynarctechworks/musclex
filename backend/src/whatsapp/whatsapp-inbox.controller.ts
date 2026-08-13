import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Permissions,
} from '../common';
import { WhatsAppInboxService } from './whatsapp-inbox.service';

export class InboxReplyDto {
  @IsString()
  @Matches(/^[+\d][\d\s-]{7,17}$/)
  phone: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}

/**
 * Staff-facing WhatsApp shared inbox:
 *   GET  /api/v1/whatsapp/inbox                 — conversation list
 *   GET  /api/v1/whatsapp/inbox/thread?phone=…  — one thread
 *   POST /api/v1/whatsapp/inbox/reply           — reply as the gym
 */
@Controller('api/v1/whatsapp/inbox')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class WhatsAppInboxController {
  constructor(private readonly inbox: WhatsAppInboxService) {}

  @Get()
  @Permissions({ module: 'marketing', action: 'view' })
  conversations(@Query('limit') limit?: string) {
    return this.inbox.conversations(limit ? Math.min(parseInt(limit, 10), 200) : 50);
  }

  @Get('thread')
  @Permissions({ module: 'marketing', action: 'view' })
  thread(@Query('phone') phone: string, @Query('limit') limit?: string) {
    return this.inbox.thread(phone ?? '', limit ? parseInt(limit, 10) : 100);
  }

  @Post('reply')
  @Permissions({ module: 'marketing', action: 'create' })
  reply(@Body() dto: InboxReplyDto) {
    return this.inbox.reply(dto.phone, dto.text);
  }
}
