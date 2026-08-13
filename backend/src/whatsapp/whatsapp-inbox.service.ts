import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { TenantTaskRunner } from '../prisma/tenant-task-runner';
import { getTenantGymId } from '../common/tenant-context';
import { WhatsAppService } from './whatsapp.service';

interface InboundMessage {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
}

interface StatusUpdate {
  id?: string;
  status?: string; // sent | delivered | read | failed
}

/**
 * WhatsApp shared inbox.
 *
 * Webhook side (no auth context): resolves the owning gym from the WABA
 * phone_number_id via public.whatsapp_number_index, then stores inbound
 * messages / applies delivery-status updates inside that gym's context.
 * Falls back to the platform-global sender (env WHATSAPP_PHONE_NUMBER_ID +
 * WHATSAPP_INBOX_GYM_ID) for single-gym env-only setups.
 *
 * Admin side (request context): conversation list, thread read, reply.
 */
@Injectable()
export class WhatsAppInboxService {
  private readonly logger = new Logger(WhatsAppInboxService.name);

  constructor(
    private readonly pub: PublicPrismaService,
    private readonly tenant: TenantPrisma,
    private readonly tasks: TenantTaskRunner,
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // Webhook ingestion
  // ────────────────────────────────────────────────────────────────

  async resolveGymForNumber(phoneNumberId: string | undefined): Promise<string | null> {
    if (!phoneNumberId) return null;
    const index = await this.pub.whatsAppNumberIndex.findUnique({
      where: { phone_number_id: phoneNumberId },
    });
    if (index) return index.gym_id;

    // Env-global fallback: one WABA number for the whole platform.
    if (
      phoneNumberId === this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') &&
      this.config.get<string>('WHATSAPP_INBOX_GYM_ID')
    ) {
      return this.config.get<string>('WHATSAPP_INBOX_GYM_ID')!;
    }
    return null;
  }

  /** Store an inbound message (idempotent on wamid) and auto-reply if configured. */
  async handleInbound(phoneNumberId: string | undefined, message: InboundMessage): Promise<void> {
    const gymId = await this.resolveGymForNumber(phoneNumberId);
    if (!gymId || !message.from) {
      this.logger.log(
        `WhatsApp inbound (unrouted number=${phoneNumberId ?? 'unknown'}) from ${message.from}: ` +
          `${message.type === 'text' ? (message.text?.body ?? '').slice(0, 120) : `[${message.type}]`}`,
      );
      return;
    }

    await this.tasks.runForGym(gymId, async () => {
      // Webhooks are at-least-once — dedupe on the Meta message id.
      if (message.id) {
        const existing = await this.tenant.client.whatsAppMessage.findFirst({
          where: { wa_message_id: message.id },
          select: { id: true },
        });
        if (existing) return;
      }

      const phone = message.from!.replace(/[^\d]/g, '');
      const member = await this.matchMemberByPhone(phone);
      const body =
        message.type === 'text'
          ? (message.text?.body ?? '').slice(0, 4000)
          : `[${message.type ?? 'message'}]`;

      await this.tenant.client.whatsAppMessage.create({
        data: {
          gym_id: gymId,
          member_id: member?.id ?? null,
          phone,
          direction: 'inbound',
          message_type: message.type === 'text' ? 'text' : (message.type ?? 'other'),
          body,
          wa_message_id: message.id ?? null,
          status: 'received',
        },
      });

      await this.maybeAutoReply(phone, message);
    });
  }

  /** Apply a delivery-status update to the inbox row + NotificationLog. */
  async handleStatus(phoneNumberId: string | undefined, status: StatusUpdate): Promise<void> {
    if (!status.id || !status.status) return;
    const gymId = await this.resolveGymForNumber(phoneNumberId);
    if (!gymId) {
      this.logger.debug(`WhatsApp status for unrouted number: ${status.id} → ${status.status}`);
      return;
    }
    const newStatus = status.status;
    if (!['sent', 'delivered', 'read', 'failed'].includes(newStatus)) return;

    await this.tasks.runForGym(gymId, async () => {
      await this.tenant.client.whatsAppMessage.updateMany({
        where: { wa_message_id: status.id },
        data: { status: newStatus },
      });
      await this.tenant.client.notificationLog.updateMany({
        where: { external_message_id: status.id },
        data: { status: newStatus },
      });
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Admin inbox (request context)
  // ────────────────────────────────────────────────────────────────

  /** One row per counterparty phone: last message + member identity. */
  async conversations(limit = 50) {
    const gymId = getTenantGymId()!;
    const rows = await this.tenant.client.$queryRaw<
      Array<{
        phone: string;
        member_id: string | null;
        last_body: string;
        last_direction: string;
        last_at: Date;
        inbound_count: bigint;
      }>
    >`
      SELECT DISTINCT ON (phone)
        phone,
        member_id,
        body        AS last_body,
        direction   AS last_direction,
        created_at  AS last_at,
        (SELECT count(*) FROM whatsapp_messages i
          WHERE i.phone = m.phone AND i.gym_id = ${gymId}::uuid AND i.direction = 'inbound')
          AS inbound_count
      FROM whatsapp_messages m
      WHERE gym_id = ${gymId}::uuid
      ORDER BY phone, created_at DESC
      LIMIT ${limit}
    `;

    const memberIds = [...new Set(rows.map((r) => r.member_id).filter(Boolean))] as string[];
    const members = memberIds.length
      ? await this.tenant.client.member.findMany({
          where: { id: { in: memberIds } },
          select: { id: true, full_name: true, member_code: true },
        })
      : [];
    const byId = new Map(members.map((m) => [m.id, m]));

    return rows
      .map((r) => ({
        phone: r.phone,
        member: r.member_id ? (byId.get(r.member_id) ?? null) : null,
        last_message: r.last_body,
        last_direction: r.last_direction,
        last_at: r.last_at,
        inbound_count: Number(r.inbound_count),
      }))
      .sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());
  }

  async thread(phone: string, limit = 100) {
    const digits = phone.replace(/[^\d]/g, '');
    const messages = await this.tenant.client.whatsAppMessage.findMany({
      where: { phone: digits },
      orderBy: { created_at: 'desc' },
      take: Math.min(limit, 200),
      select: {
        id: true,
        direction: true,
        message_type: true,
        body: true,
        status: true,
        created_at: true,
        member: { select: { id: true, full_name: true } },
      },
    });
    return messages.reverse();
  }

  /** Staff reply from the inbox — goes out via the gym's own sender. */
  async reply(phone: string, text: string) {
    const digits = phone.replace(/[^\d]/g, '');
    const member = await this.matchMemberByPhone(digits);
    const result = await this.whatsapp.sendText({
      to: digits,
      text,
      memberId: member?.id,
      triggerType: 'inbox_reply',
    });
    if (!result.delivered) {
      throw new NotFoundException(
        'WhatsApp is not configured for this gym — connect it under Integrations first.',
      );
    }
    return { delivered: true, message_id: result.id ?? null };
  }

  // ────────────────────────────────────────────────────────────────

  /** Members store national numbers; WhatsApp sends international. Match on the last 10 digits. */
  private async matchMemberByPhone(digits: string): Promise<{ id: string } | null> {
    const national = digits.length > 10 ? digits.slice(-10) : digits;
    return this.tenant.client.member.findFirst({
      where: {
        OR: [{ phone: digits }, { phone: national }, { phone: { endsWith: national } }],
        status: { not: 'cancelled' },
      },
      select: { id: true },
    });
  }

  private async maybeAutoReply(phone: string, message: InboundMessage): Promise<void> {
    if (message.type !== 'text') return;
    try {
      // Per-gym auto-reply text (Integration config), env fallback.
      const integration = await this.tenant.client.integration.findFirst({
        where: { provider: 'whatsapp', is_enabled: true },
      });
      const cfg = (integration?.config ?? {}) as Record<string, unknown>;
      const autoReply =
        (typeof cfg.auto_reply_message === 'string' && cfg.auto_reply_message.trim()) ||
        this.config.get<string>('WHATSAPP_AUTO_REPLY_TEXT');
      if (!autoReply) return;

      // Reply at most once per hour per phone — don't loop on chatty senders.
      const oneHourAgo = new Date(Date.now() - 3600_000);
      const recentAutoReply = await this.tenant.client.notificationLog.findFirst({
        where: {
          channel: 'whatsapp',
          trigger_type: 'auto_reply',
          sent_at: { gte: oneHourAgo },
          message_body: autoReply.slice(0, 2000),
        },
        select: { id: true },
      });
      if (recentAutoReply) return;

      await this.whatsapp.sendText({ to: phone, text: autoReply, triggerType: 'auto_reply' });
    } catch (e) {
      this.logger.warn(`Auto-reply failed: ${(e as Error).message}`);
    }
  }
}
