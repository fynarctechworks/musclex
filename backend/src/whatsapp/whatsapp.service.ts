import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { TenantTaskRunner } from '../prisma/tenant-task-runner';
import { getTenantGymId } from '../common/tenant-context';
import {
  WHATSAPP_PROVIDER,
  WabaCredentials,
  WhatsAppProvider,
  WhatsAppSendResult,
} from './whatsapp-provider.interface';

export interface SendWhatsAppOptions {
  to: string;
  /**
   * Gym to send on behalf of. Required when no tenant context is active
   * (crons, webhooks, queue processors). When a tenant context IS active
   * (request path) it is ignored — the context gym wins.
   */
  gymId?: string;
  /** For the NotificationLog audit row (only written inside a tenant context). */
  memberId?: string;
  /** e.g. 'campaign', 'automation:birthday', 'document_delivery'. */
  triggerType?: string;
}

export interface SendWhatsAppText extends SendWhatsAppOptions {
  text: string;
}

export interface SendWhatsAppDocument extends SendWhatsAppOptions {
  documentUrl: string;
  filename?: string;
  caption?: string;
}

/**
 * The one way to send WhatsApp messages. Resolves credentials per gym:
 *   1. the gym's `Integration` row (provider='whatsapp', is_enabled) —
 *      config keys `phone_number_id` + `access_token` (the shapes already
 *      declared in IntegrationsService.getAvailableCatalog)
 *   2. fallback: platform-global env WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN
 *
 * Unconfigured gyms are a silent skip (warn log, delivered:false) — mirroring
 * the pre-existing behavior of the inline senders this service replaces.
 * Failures on a *configured* send THROW so BullMQ / callers can retry.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly defaultCountryCode: string;

  constructor(
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider,
    private readonly config: ConfigService,
    private readonly tenant: TenantPrisma,
    private readonly tasks: TenantTaskRunner,
  ) {
    this.defaultCountryCode = this.config.get<string>('WHATSAPP_DEFAULT_COUNTRY_CODE') ?? '91';
  }

  /** True when a platform-global sender is configured (per-gym may still exist). */
  get globallyConfigured(): boolean {
    return Boolean(
      this.config.get<string>('WHATSAPP_ACCESS_TOKEN') &&
        this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID'),
    );
  }

  async sendText(opts: SendWhatsAppText): Promise<WhatsAppSendResult> {
    return this.withGymContext(opts.gymId, async () => {
      const creds = await this.resolveCredentials();
      if (!creds) {
        this.logger.warn(`WhatsApp not configured (gym=${getTenantGymId() ?? 'none'}) — text skipped`);
        return { delivered: false };
      }
      const to = this.normalizePhone(opts.to);
      const result = await this.provider.sendText(creds, { to, text: opts.text });
      await this.audit(opts, to, opts.text, 'text', result);
      return result;
    });
  }

  async sendDocument(opts: SendWhatsAppDocument): Promise<WhatsAppSendResult> {
    return this.withGymContext(opts.gymId, async () => {
      const creds = await this.resolveCredentials();
      if (!creds) {
        this.logger.warn(`WhatsApp not configured (gym=${getTenantGymId() ?? 'none'}) — document skipped`);
        return { delivered: false };
      }
      const to = this.normalizePhone(opts.to);
      const result = await this.provider.sendDocument(creds, {
        to,
        documentUrl: opts.documentUrl,
        filename: opts.filename,
        caption: opts.caption,
      });
      await this.audit(opts, to, `[document] ${opts.filename ?? opts.documentUrl}`, 'document', result);
      return result;
    });
  }

  /**
   * Reply using explicit credentials — used by the inbound webhook, where the
   * sender (phone_number_id) comes from the webhook payload itself and there
   * is no tenant context.
   */
  async replyWithCredentials(creds: WabaCredentials, to: string, text: string): Promise<WhatsAppSendResult> {
    return this.provider.sendText(creds, { to: this.normalizePhone(to), text });
  }

  // ────────────────────────────────────────────────────────────────

  /** Run `fn` in the given gym's tenant context unless one is already active. */
  private async withGymContext(gymId: string | undefined, fn: () => Promise<WhatsAppSendResult>): Promise<WhatsAppSendResult> {
    if (getTenantGymId()) return fn(); // request path — context already set
    if (gymId) {
      const result = await this.tasks.runForGym(gymId, fn);
      return result ?? { delivered: false };
    }
    return fn(); // no gym at all — env-global creds only, no audit row
  }

  /** Per-gym Integration first (needs tenant context), then env fallback. */
  private async resolveCredentials(): Promise<WabaCredentials | null> {
    if (getTenantGymId()) {
      try {
        const integration = await this.tenant.client.integration.findFirst({
          where: { provider: 'whatsapp', is_enabled: true, status: 'active' },
        });
        const cfg = (integration?.config ?? {}) as Record<string, unknown>;
        const phoneNumberId = typeof cfg.phone_number_id === 'string' ? cfg.phone_number_id.trim() : '';
        const accessToken = typeof cfg.access_token === 'string' ? cfg.access_token.trim() : '';
        if (phoneNumberId && accessToken) return { phoneNumberId, accessToken };
      } catch (e) {
        this.logger.warn(`WhatsApp integration lookup failed: ${(e as Error).message}`);
      }
    }

    const accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (accessToken && phoneNumberId) return { phoneNumberId, accessToken };
    return null;
  }

  /**
   * Best-effort audit: a NotificationLog row (delivery telemetry) AND a
   * WhatsAppMessage row (the shared-inbox thread). Only possible inside a
   * tenant context. Never fails the send.
   */
  private async audit(
    opts: SendWhatsAppOptions,
    normalizedTo: string,
    body: string,
    messageType: 'text' | 'document',
    result: WhatsAppSendResult,
  ): Promise<void> {
    const gymId = getTenantGymId();
    if (!gymId) return;
    try {
      await this.tenant.client.notificationLog.create({
        data: {
          gym_id: gymId,
          member_id: opts.memberId ?? null,
          channel: 'whatsapp',
          trigger_type: opts.triggerType ?? 'manual',
          message_body: body.slice(0, 2000),
          status: result.delivered ? 'sent' : 'skipped',
          external_message_id: result.id ?? null,
        },
      });
    } catch (e) {
      this.logger.warn(`NotificationLog write failed: ${(e as Error).message}`);
    }
    if (!result.delivered) return; // inbox shows real traffic only
    try {
      await this.tenant.client.whatsAppMessage.create({
        data: {
          gym_id: gymId,
          member_id: opts.memberId ?? null,
          phone: normalizedTo,
          direction: 'outbound',
          message_type: messageType,
          body: body.slice(0, 4000),
          wa_message_id: result.id ?? null,
          status: 'sent',
        },
      });
    } catch (e) {
      this.logger.warn(`WhatsAppMessage write failed: ${(e as Error).message}`);
    }
  }

  /**
   * Meta wants digits-only international format (no +). 10-digit numbers get
   * the default country code (India) — matches how members are stored.
   */
  private normalizePhone(raw: string): string {
    const digits = raw.replace(/[^\d]/g, '');
    if (digits.length === 10) return `${this.defaultCountryCode}${digits}`;
    return digits;
  }
}
