import { Injectable, Logger } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../common/tenant-context';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import { QueueService } from '../queue/queue.service';
import { PushService } from '../push/push.service';

/**
 * Executes a campaign: loads the pending audience, renders the message per
 * member ({{name}}, {{first_name}}, {{member_code}} substitution) and delivers
 * on every channel the campaign selected. This is the piece that was missing —
 * `sendCampaign` flipped status to "sending" and built the audience, but
 * nothing ever sent.
 *
 * MUST run inside a tenant context (request path, or runForGym from the
 * campaign queue processor).
 */
@Injectable()
export class CampaignSenderService {
  private readonly logger = new Logger(CampaignSenderService.name);

  constructor(
    private readonly tenant: TenantPrisma,
    private readonly whatsapp: WhatsAppService,
    private readonly email: EmailService,
    private readonly queue: QueueService,
    private readonly push: PushService,
  ) {}

  async dispatch(campaignId: string): Promise<{ sent: number; failed: number; skipped: number }> {
    const campaign = await this.tenant.client.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      this.logger.error(`Campaign ${campaignId} not found — nothing dispatched`);
      return { sent: 0, failed: 0, skipped: 0 };
    }

    const audience = await this.tenant.client.campaignAudience.findMany({
      where: { campaign_id: campaignId, status: 'pending' },
      include: {
        member: { select: { id: true, full_name: true, phone: true, email: true, member_code: true } },
      },
    });

    const channels = (campaign.channels ?? []).filter((c) =>
      ['whatsapp', 'sms', 'email', 'push'].includes(c),
    );
    if (channels.length === 0) channels.push('whatsapp');

    // Marketing consent. ConsentLog existed and was written by the compliance
    // module, but no sender ever read it — a member could revoke marketing
    // WhatsApp and keep receiving bulk campaigns.
    const revoked = await this.revokedChannels(
      audience.map((a) => a.member.id),
      channels,
    );

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    const batchSize = 25;
    for (let i = 0; i < audience.length; i += batchSize) {
      const batch = audience.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (row) => {
          const allowed = channels.filter(
            (c) => !revoked.get(row.member.id)?.has(c),
          );
          if (allowed.length === 0) {
            // Every requested channel was explicitly opted out of. Record it
            // distinctly so "opted out" isn't misread as a delivery failure.
            await this.tenant.client.campaignAudience.update({
              where: { id: row.id },
              data: { status: 'opted_out', sent_at: null },
            });
            throw new Error('no deliverable channel');
          }

          const message = this.render(campaign.message_template, {
            name: row.member.full_name,
            first_name: row.member.full_name.split(/\s+/)[0] ?? row.member.full_name,
            member_code: row.member.member_code,
          });
          const delivered = await this.deliver(allowed, row.member, message, campaign.name);
          await this.tenant.client.campaignAudience.update({
            where: { id: row.id },
            data: {
              status: delivered ? 'sent' : 'bounced',
              sent_at: delivered ? new Date() : null,
            },
          });
          if (!delivered) throw new Error('no deliverable channel');
        }),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') sent++;
        else if ((r.reason as Error)?.message === 'no deliverable channel') skipped++;
        else failed++;
      }
    }

    await this.tenant.client.campaign.update({
      where: { id: campaignId },
      data: { status: 'sent', delivered_count: sent },
    });

    this.logger.log(
      `Campaign ${campaignId} dispatched: sent=${sent}, failed=${failed}, skipped=${skipped} (audience=${audience.length})`,
    );
    return { sent, failed, skipped };
  }

  /** Campaign channel → the ConsentLog.consent_type that governs it. */
  private static readonly CONSENT_TYPE_BY_CHANNEL: Record<string, string> = {
    whatsapp: 'marketing_whatsapp',
    sms: 'marketing_sms',
    email: 'marketing_email',
    // `push` has no marketing consent type — it is an owned in-app channel the
    // member controls with OS-level notification permission and the app's own
    // preference screen, so it is not gated here.
  };

  /**
   * Which channels each member has explicitly REVOKED.
   *
   * Deliberately opt-out, not opt-in: no gym has consent rows today, so
   * treating "no record" as "no consent" would silently stop every campaign
   * for every existing customer and read as the feature breaking. This closes
   * the actual defect — messaging people who said no — and leaves tightening
   * the default to an explicit policy decision.
   *
   * ConsentLog is append-only; the newest row per (member, type) is current.
   */
  private async revokedChannels(
    memberIds: string[],
    channels: string[],
  ): Promise<Map<string, Set<string>>> {
    const result = new Map<string, Set<string>>();
    const types = channels
      .map((c) => CampaignSenderService.CONSENT_TYPE_BY_CHANNEL[c])
      .filter(Boolean);
    if (memberIds.length === 0 || types.length === 0) return result;

    const logs = await this.tenant.client.consentLog.findMany({
      where: { member_id: { in: memberIds }, consent_type: { in: types } },
      orderBy: { created_at: 'desc' },
      select: { member_id: true, consent_type: true, granted: true },
    });

    // Descending order means the first row seen per (member, type) is current.
    const seen = new Set<string>();
    const channelFor = Object.entries(
      CampaignSenderService.CONSENT_TYPE_BY_CHANNEL,
    ).reduce<Record<string, string>>((acc, [ch, type]) => {
      acc[type] = ch;
      return acc;
    }, {});

    for (const log of logs) {
      const key = `${log.member_id}:${log.consent_type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (log.granted) continue;
      const channel = channelFor[log.consent_type];
      if (!channel) continue;
      const set = result.get(log.member_id) ?? new Set<string>();
      set.add(channel);
      result.set(log.member_id, set);
    }
    return result;
  }

  private async deliver(
    channels: string[],
    member: { id: string; full_name: string; phone: string | null; email: string | null },
    message: string,
    subject: string,
  ): Promise<boolean> {
    let delivered = false;
    for (const channel of channels) {
      try {
        if (channel === 'whatsapp' && member.phone) {
          const result = await this.whatsapp.sendText({
            to: member.phone,
            text: message,
            memberId: member.id,
            triggerType: 'campaign',
          });
          delivered = delivered || result.delivered;
        } else if (channel === 'email' && member.email) {
          const result = await this.email.sendRaw({
            to: member.email,
            subject,
            html: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
            text: message,
          });
          delivered = delivered || result.delivered;
        } else if (channel === 'sms' && member.phone) {
          // SMS rides the notification queue (Twilio); counts as dispatched.
          const result = await this.queue.enqueueNotification({
            type: 'sms',
            to: member.phone,
            message,
            gymId: getTenantGymId() ?? undefined,
            memberId: member.id,
            triggerType: 'campaign',
          });
          delivered = delivered || result.queued;
        } else if (channel === 'push') {
          const devices = await this.push.sendToMember(
            member.id,
            { title: subject, body: message, data: { source: 'campaign' } },
            { category: 'promos' },
          );
          delivered = delivered || devices > 0;
        }
      } catch (e) {
        this.logger.warn(`Campaign ${channel} send to member ${member.id} failed: ${(e as Error).message}`);
      }
    }
    return delivered;
  }

  private render(template: string, vars: Record<string, string>): string {
    let out = template;
    for (const [key, value] of Object.entries(vars)) {
      out = out.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value ?? '');
    }
    return out;
  }
}
