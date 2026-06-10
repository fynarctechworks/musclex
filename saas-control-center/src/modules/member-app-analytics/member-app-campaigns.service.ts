import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER APP CAMPAIGNS SERVICE (Phase 5b + 7.6)
 * ────────────────────────────────────────────────────────────────
 *
 * Segment-targeted push to the public fitness app, authored + sent from the SCC.
 * Resolves a segment → app_users → app_user_device_tokens and delivers via Expo's
 * push HTTP API. Phase 7.6 adds per-recipient delivery rows (sent/delivered/
 * opened/clicked analytics) and an automation engine: admin-configured triggered
 * campaigns run hourly by a cron, deduped per user by a cooldown. Raw SQL
 * throughout (public schema). Owns the flow in SCC because the main backend's push
 * is gym-scoped.
 */
@Injectable()
export class MemberAppCampaignsService {
  private readonly logger = new Logger(MemberAppCampaignsService.name);
  private readonly EXPO_URL = 'https://exp.host/--/api/v2/push/send';

  constructor(private readonly prisma: PrismaService) {}

  private n(v: unknown): number {
    return v == null ? 0 : Number(v);
  }

  // ── Manual campaigns ─────────────────────────────────────────────
  async list() {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT c.id, c.title, c.body, c.target_segment, c.status, c.recipients,
             c.sent_count, c.failed_count, c.sent_at, c.created_at,
             COALESCE(d.opened, 0) AS opened, COALESCE(d.clicked, 0) AS clicked
      FROM public.app_campaigns c
      LEFT JOIN (
        SELECT campaign_id,
          count(*) FILTER (WHERE opened_at IS NOT NULL OR status IN ('opened','clicked')) AS opened,
          count(*) FILTER (WHERE clicked_at IS NOT NULL OR status = 'clicked') AS clicked
        FROM public.app_campaign_deliveries
        WHERE campaign_id IS NOT NULL
        GROUP BY campaign_id
      ) d ON d.campaign_id = c.id
      ORDER BY c.created_at DESC
      LIMIT 100
    `);
    return { campaigns: rows };
  }

  async create(input: {
    title: string;
    body: string;
    targetSegment: string;
    deepLink?: string;
  }) {
    const [row] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      INSERT INTO public.app_campaigns (title, body, target_segment, deep_link, status)
      VALUES (${input.title}, ${input.body}, ${input.targetSegment}, ${input.deepLink ?? null}, 'draft')
      RETURNING id, title, body, target_segment, status, created_at
    `);
    return row;
  }

  /** SQL predicate that selects app_users for a target segment. */
  private segmentPredicate(segment: string): Prisma.Sql {
    switch (segment) {
      case 'active':
        return Prisma.sql`um.active_member`;
      case 'expired':
        return Prisma.sql`um.has_gym AND NOT um.active_member`;
      case 'public':
      case 'lead':
        return Prisma.sql`NOT um.has_gym`;
      case 'inactive':
        return Prisma.sql`(a.last_active_at IS NULL OR a.last_active_at < now() - interval '30 day')`;
      case 'incomplete_onboarding':
        return Prisma.sql`a.onboarding_state IN ('not_started','in_progress')`;
      default:
        return Prisma.sql`false`;
    }
  }

  /** Resolve a segment to its users' (app_user_id, token) pairs. */
  private async recipientsForSegment(
    segment: string,
    cooldown?: { automationKey: string; days: number },
  ): Promise<Array<{ app_user_id: string; token: string }>> {
    const pred = this.segmentPredicate(segment);
    const dedup = cooldown
      ? Prisma.sql`AND NOT EXISTS (
          SELECT 1 FROM public.app_campaign_deliveries d
          WHERE d.automation_key = ${cooldown.automationKey}
            AND d.app_user_id = a.id
            AND d.created_at > now() - (${cooldown.days} || ' days')::interval
        )`
      : Prisma.empty;
    return this.prisma.$queryRaw<Array<{ app_user_id: string; token: string }>>(Prisma.sql`
      WITH user_membership AS (
        SELECT a.id,
          EXISTS (SELECT 1 FROM public.app_user_gym_links l WHERE l.app_user_id = a.id) AS has_gym,
          EXISTS (
            SELECT 1 FROM public.app_user_gym_links l
            JOIN studio_template.members m ON m.id = l.member_id AND m.gym_id = l.tenant_id
            WHERE l.app_user_id = a.id
              AND m.status IN ('active','trial','expiring_soon','frozen')
          ) AS active_member
        FROM public.app_users a
      )
      SELECT DISTINCT t.app_user_id::text AS app_user_id, t.token
      FROM public.app_users a
      JOIN user_membership um ON um.id = a.id
      JOIN public.app_user_device_tokens t ON t.app_user_id = a.id
      WHERE ${pred} ${dedup}
    `);
  }

  /**
   * Core delivery: create per-recipient delivery rows, push via Expo with a
   * per-message deliveryId (so opens/clicks attribute back), then mark each
   * sent/failed. Returns counts.
   */
  private async deliver(
    recipients: Array<{ app_user_id: string; token: string }>,
    msg: { title: string; body: string; deepLink?: string | null },
    attribution: { campaignId?: string; automationKey?: string },
  ): Promise<{ recipients: number; sent: number; failed: number }> {
    if (recipients.length === 0) return { recipients: 0, sent: 0, failed: 0 };

    const values = Prisma.join(
      recipients.map(
        (r) =>
          Prisma.sql`(${attribution.campaignId ?? null}::uuid, ${attribution.automationKey ?? null}, ${r.app_user_id}::uuid, ${r.token}, 'queued')`,
      ),
    );
    const rows = await this.prisma.$queryRaw<Array<{ id: string; token: string }>>(Prisma.sql`
      INSERT INTO public.app_campaign_deliveries (campaign_id, automation_key, app_user_id, token, status)
      VALUES ${values}
      RETURNING id::text AS id, token
    `);

    const messages = rows.map((r) => ({
      to: r.token,
      title: msg.title,
      body: msg.body,
      data: { deliveryId: r.id, ...(msg.deepLink ? { deepLink: msg.deepLink } : {}) },
    }));

    const sentIds: string[] = [];
    const failedIds: string[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const chunkRows = rows.slice(i, i + 100);
      try {
        const res = await fetch(this.EXPO_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk),
        });
        const json: any = await res.json().catch(() => null);
        const tickets: any[] = json?.data ?? [];
        chunkRows.forEach((row, idx) => {
          const ok = tickets[idx]?.status === 'ok';
          (ok ? sentIds : failedIds).push(row.id);
        });
        // No per-ticket data (e.g. transport error) → whole chunk failed.
        if (tickets.length === 0) chunkRows.forEach((row) => failedIds.push(row.id));
      } catch (err) {
        chunkRows.forEach((row) => failedIds.push(row.id));
        this.logger.warn(`Expo push chunk failed: ${(err as Error).message}`);
      }
    }

    if (sentIds.length) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE public.app_campaign_deliveries
        SET status = 'sent', sent_at = now()
        WHERE id IN (${Prisma.join(sentIds.map((id) => Prisma.sql`${id}::uuid`))})
      `);
    }
    if (failedIds.length) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE public.app_campaign_deliveries
        SET status = 'failed'
        WHERE id IN (${Prisma.join(failedIds.map((id) => Prisma.sql`${id}::uuid`))})
      `);
    }

    return { recipients: rows.length, sent: sentIds.length, failed: failedIds.length };
  }

  /** Send a draft campaign to its segment. */
  async send(id: string) {
    const [c] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT id, title, body, target_segment, deep_link, status
      FROM public.app_campaigns WHERE id = ${id}::uuid
    `);
    if (!c) return { error: 'not_found' };
    if (c.status === 'sent' || c.status === 'sending') return { error: 'already_' + c.status };

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.app_campaigns SET status = 'sending', updated_at = now() WHERE id = ${id}::uuid
    `);
    const recipients = await this.recipientsForSegment(c.target_segment);
    const r = await this.deliver(
      recipients,
      { title: c.title, body: c.body, deepLink: c.deep_link },
      { campaignId: id },
    );

    const status = r.failed > 0 && r.sent === 0 ? 'failed' : 'sent';
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.app_campaigns
      SET status = ${status}, recipients = ${r.recipients}, sent_count = ${r.sent},
          failed_count = ${r.failed}, sent_at = now(), updated_at = now()
      WHERE id = ${id}::uuid
    `);
    return { id, ...r, status };
  }

  // ── Automations (Phase 7.6) ──────────────────────────────────────
  async listAutomations() {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT a.id, a.key, a.title, a.body, a.target_segment, a.deep_link, a.enabled,
             a.cooldown_days, a.last_run_at,
             COALESCE(s.sent, 0) AS sent, COALESCE(s.opened, 0) AS opened, COALESCE(s.clicked, 0) AS clicked
      FROM public.app_campaign_automations a
      LEFT JOIN (
        SELECT automation_key,
          count(*) FILTER (WHERE status IN ('sent','opened','clicked')) AS sent,
          count(*) FILTER (WHERE opened_at IS NOT NULL OR status IN ('opened','clicked')) AS opened,
          count(*) FILTER (WHERE clicked_at IS NOT NULL OR status = 'clicked') AS clicked
        FROM public.app_campaign_deliveries
        WHERE automation_key IS NOT NULL
        GROUP BY automation_key
      ) s ON s.automation_key = a.key
      ORDER BY a.key
    `);
    return { automations: rows };
  }

  async updateAutomation(
    key: string,
    patch: { enabled?: boolean; title?: string; body?: string; cooldownDays?: number; deepLink?: string },
  ) {
    const sets: Prisma.Sql[] = [];
    if (patch.enabled !== undefined) sets.push(Prisma.sql`enabled = ${patch.enabled}`);
    if (patch.title !== undefined) sets.push(Prisma.sql`title = ${patch.title}`);
    if (patch.body !== undefined) sets.push(Prisma.sql`body = ${patch.body}`);
    if (patch.cooldownDays !== undefined) sets.push(Prisma.sql`cooldown_days = ${patch.cooldownDays}`);
    if (patch.deepLink !== undefined) sets.push(Prisma.sql`deep_link = ${patch.deepLink}`);
    if (sets.length === 0) return { ok: true };
    sets.push(Prisma.sql`updated_at = now()`);
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.app_campaign_automations SET ${Prisma.join(sets, ', ')} WHERE key = ${key}
    `);
    return { ok: true };
  }

  /** Run one automation now (respects cooldown). */
  async runAutomation(key: string) {
    const [a] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT key, title, body, target_segment, deep_link, cooldown_days
      FROM public.app_campaign_automations WHERE key = ${key}
    `);
    if (!a) return { error: 'not_found' };
    const recipients = await this.recipientsForSegment(a.target_segment, {
      automationKey: a.key,
      days: this.n(a.cooldown_days),
    });
    const r = await this.deliver(
      recipients,
      { title: a.title, body: a.body, deepLink: a.deep_link },
      { automationKey: a.key },
    );
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.app_campaign_automations SET last_run_at = now(), updated_at = now() WHERE key = ${key}
    `);
    return { key, ...r };
  }

  /** Hourly: run every enabled automation (cooldown prevents re-sends). */
  @Cron(CronExpression.EVERY_HOUR)
  async runDueAutomations() {
    const enabled = await this.prisma.$queryRaw<Array<{ key: string }>>(Prisma.sql`
      SELECT key FROM public.app_campaign_automations WHERE enabled = true
    `);
    for (const a of enabled) {
      try {
        const r = await this.runAutomation(a.key);
        if ('sent' in r && (r.sent || r.failed)) {
          this.logger.log(`Automation ${a.key}: sent=${r.sent} failed=${r.failed}`);
        }
      } catch (err) {
        this.logger.warn(`Automation ${a.key} failed: ${(err as Error).message}`);
      }
    }
  }
}
