import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppInboxService } from './whatsapp-inbox.service';

interface MetaWebhookMessage {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
}

interface MetaWebhookStatus {
  id?: string;
  status?: string; // sent | delivered | read | failed
  recipient_id?: string;
}

/**
 * Inbound Meta WhatsApp Cloud API webhook.
 *   GET  /api/v1/whatsapp/webhook — subscription verification challenge
 *   POST /api/v1/whatsapp/webhook — message + delivery-status events,
 *        authenticated via X-Hub-Signature-256 (HMAC-SHA256 of the raw body
 *        with WHATSAPP_APP_SECRET, timing-safe compare)
 *
 * No JWT guards — Meta's servers call this. The HMAC is the authentication.
 * Auto-reply: when WHATSAPP_AUTO_REPLY_TEXT is set, every inbound text gets
 * one reply sent from the same phone_number_id the message arrived on.
 */
@Controller('api/v1/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsAppService,
    private readonly inbox: WhatsAppInboxService,
  ) {}

  @Get('webhook')
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && expected && token === expected && challenge) {
      return challenge;
    }
    throw new ForbiddenException('Webhook verification failed');
  }

  @Post('webhook')
  @HttpCode(200)
  async receive(@Req() req: Request & { rawBody?: Buffer }): Promise<{ received: boolean }> {
    this.assertSignature(req);

    const body = req.body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            metadata?: { phone_number_id?: string };
            messages?: MetaWebhookMessage[];
            statuses?: MetaWebhookStatus[];
          };
        }>;
      }>;
    };

    for (const entry of body?.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;
        const phoneNumberId = value.metadata?.phone_number_id;

        for (const status of value.statuses ?? []) {
          this.logger.log(
            `WhatsApp status: message=${status.id} → ${status.status} (to ${status.recipient_id})`,
          );
          await this.inbox.handleStatus(phoneNumberId, status).catch((e) => {
            this.logger.warn(`Status handling failed: ${(e as Error).message}`);
          });
        }

        for (const message of value.messages ?? []) {
          this.logger.log(
            `WhatsApp inbound from ${message.from}: ${message.type === 'text' ? (message.text?.body ?? '').slice(0, 200) : `[${message.type}]`}`,
          );
          // Routed per-gym: stores the message in the shared inbox, matches
          // the member by phone, and auto-replies (per-gym text, env fallback).
          await this.inbox.handleInbound(phoneNumberId, message).catch((e) => {
            this.logger.warn(`Inbound handling failed: ${(e as Error).message}`);
          });
          await this.maybeEnvAutoReply(phoneNumberId, message);
        }
      }
    }

    return { received: true };
  }

  /**
   * Env-global auto-reply for numbers with NO gym routing (unrouted). Routed
   * gyms auto-reply inside WhatsAppInboxService with their own text/creds.
   */
  private async maybeEnvAutoReply(phoneNumberId: string | undefined, message: MetaWebhookMessage): Promise<void> {
    if (!phoneNumberId || !message.from || message.type !== 'text') return;
    if (await this.inbox.resolveGymForNumber(phoneNumberId)) return; // routed — handled per-gym
    const autoReply = this.config.get<string>('WHATSAPP_AUTO_REPLY_TEXT');
    const accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    if (!autoReply || !accessToken) return;
    try {
      await this.whatsapp.replyWithCredentials(
        { phoneNumberId, accessToken },
        message.from,
        autoReply,
      );
    } catch (e) {
      this.logger.warn(`Auto-reply failed: ${(e as Error).message}`);
    }
  }

  /** HMAC-SHA256 over the exact raw request bytes, timing-safe compare. */
  private assertSignature(req: Request & { rawBody?: Buffer }): void {
    const appSecret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!appSecret) {
      // Without an app secret we cannot authenticate Meta — reject rather
      // than process unauthenticated input.
      throw new ForbiddenException('Webhook not configured');
    }
    const header = req.headers['x-hub-signature-256'];
    const signature = Array.isArray(header) ? header[0] : header;
    if (!signature?.startsWith('sha256=')) {
      throw new BadRequestException('Missing signature');
    }
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const expected = `sha256=${createHmac('sha256', appSecret).update(raw).digest('hex')}`;
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Invalid signature');
    }
  }
}
