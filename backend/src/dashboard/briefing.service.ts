import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Anthropic from '@anthropic-ai/sdk';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { tenantContext } from '../common/tenant-context';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { DashboardPulseService } from './dashboard-pulse.service';
import { ActionQueueService } from './action-queue.service';

const BRIEFING_MODEL = 'claude-sonnet-4-20250514';

const BRIEFING_SYSTEM_PROMPT = `You are MuscleX AI Advisor — the founder's first-thing-in-the-morning briefing for a fitness studio. Read the metrics + action items provided and produce:

1. ONE headline (≤10 words) capturing the single most important thing today.
2. A briefing summary in 3-5 sentences. Lead with what changed, then what to do. Reference *specific numbers* the operator provided. No filler. No motivational quotes.
3. 2-4 actionable recommendations, each tied to a specific number or action item from the input. Each has a 'why' that quotes the data.

Output ONLY this JSON shape (no markdown fence, no prose):
{
  "headline": string,
  "summary": string,
  "recommendations": [
    { "title": string, "why": string, "action_id": string | null }
  ]
}`;

export interface DashboardBriefing {
  date: string;
  headline: string | null;
  summary: string;
  recommendations: Array<{
    title: string;
    why: string;
    action_id?: string | null;
  }>;
  metrics: Record<string, unknown>;
  generated_at: string;
  model: string | null;
}

/**
 * Generates and caches the daily briefing card. The 6 AM cron precomputes
 * for every studio with activity in the last 7 days, so the dashboard is
 * instant when the operator opens it with their morning coffee.
 *
 * On-demand fetch (`getOrGenerate`) re-uses today's stored briefing if it
 * exists, generates fresh otherwise. Stale briefings (>24h old) are
 * regenerated.
 */
@Injectable()
export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);
  private anthropic: Anthropic | null = null;

  constructor(
    private readonly pub: PublicPrismaService, // registry: studios
    private readonly tenant: TenantPrisma, // tenant: per-gym briefing storage
    private readonly configService: ConfigService,
    @Optional() private readonly pulse?: DashboardPulseService,
    @Optional() private readonly actionQueue?: ActionQueueService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  /**
   * Fetch today's briefing, generating it if missing or older than 24h.
   * The operator's `branch_id` is honored (per-branch briefings allowed).
   */
  async getOrGenerate(
    user: JwtPayload | undefined,
    branchId?: string,
  ): Promise<DashboardBriefing> {
    if (!user?.studio_id) return this.emptyBriefing();
    const today = todayKey();

    const stored = await this.fetchStored(user.studio_id, branchId, today);
    if (stored) return stored;

    return this.generate(user, branchId);
  }

  /**
   * Force regeneration of today's briefing. Used by the manual "refresh"
   * button or the 6 AM cron.
   */
  async generate(
    user: JwtPayload | undefined,
    branchId?: string,
  ): Promise<DashboardBriefing> {
    if (!user?.studio_id) return this.emptyBriefing();

    const [pulse, actions] = await Promise.all([
      this.pulse?.getPulse(user, branchId),
      this.actionQueue?.getActions(user, branchId).catch(() => []),
    ]);

    const ctx = this.buildContext(pulse, actions ?? []);
    const today = todayKey();

    let parsed: {
      headline: string;
      summary: string;
      recommendations: Array<{
        title: string;
        why: string;
        action_id: string | null;
      }>;
    } | null = null;

    if (this.anthropic) {
      try {
        const response = await this.anthropic.messages.create({
          model: BRIEFING_MODEL,
          max_tokens: 600,
          system: BRIEFING_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. Here is the current data:\n\n${JSON.stringify(ctx, null, 2)}\n\nReturn ONLY the JSON.`,
            },
          ],
        });
        const text =
          response.content.find((b) => b.type === 'text')?.text ?? '';
        parsed = safeJsonParse(text);
      } catch (err) {
        this.logger.warn(
          `Briefing generation failed: ${(err as Error)?.message ?? err}`,
        );
      }
    }

    if (!parsed) {
      parsed = this.fallbackBriefing(ctx);
    }

    const briefing: DashboardBriefing = {
      date: today,
      headline: parsed.headline,
      summary: parsed.summary,
      recommendations: parsed.recommendations ?? [],
      metrics: ctx.metrics,
      generated_at: new Date().toISOString(),
      model: this.anthropic ? BRIEFING_MODEL : null,
    };

    await this.persist(user.studio_id, branchId, briefing);
    return briefing;
  }

  /** Cron — 6 AM every day, in the studio's timezone we approximate as IST (UTC+5:30). */
  @Cron('30 0 * * *', { timeZone: 'UTC' }) // 6:00 AM IST = 00:30 UTC
  async runDailyBriefingCron() {
    if (!this.anthropic) {
      this.logger.debug('Skipping briefing cron — ANTHROPIC_API_KEY not set');
      return;
    }
    try {
      const studios = await this.pub.studio.findMany({
        where: {
          last_login_at: {
            gte: new Date(Date.now() - 7 * 86400000),
          },
        },
        select: { id: true, owner_user_id: true, schema_name: true },
        take: 200,
      });
      this.logger.log(
        `Daily briefing cron — generating for ${studios.length} studios`,
      );
      for (const s of studios) {
        // Each gym's briefing must run in its own tenant context so the pulse/
        // action-queue tenant clients route to the right per-gym schema.
        if (!s.id || !/^studio_[0-9a-f_]+$/i.test(s.schema_name)) continue;
        try {
          await tenantContext.run(
            {
              schemaName: s.schema_name, // from the registry, never derived from gym_id
              gymId: s.id,
              activeBranchId: null,
              allowedBranchIds: 'ALL',
              bypassBranchScope: false,
            },
            () =>
              this.generate({
                studio_id: s.id,
                user_id: s.owner_user_id,
                role: 'owner',
                branch_ids: [],
              } as any),
          );
        } catch (err) {
          this.logger.warn(
            `Briefing for ${s.id} failed: ${(err as Error)?.message ?? err}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Daily briefing cron failed: ${(err as Error)?.message ?? err}`,
      );
    }
  }

  // ── Storage ──────────────────────────────────────────────────────

  private async fetchStored(
    studioId: string,
    branchId: string | undefined,
    date: string,
  ): Promise<DashboardBriefing | null> {
    try {
      const rows = await this.tenant.client.$queryRawUnsafe<any[]>(
        `SELECT * FROM dashboard_briefings
         WHERE gym_id = $1::uuid
           AND briefing_date = $2::date
           AND ((branch_id IS NULL AND $3::uuid IS NULL) OR branch_id = $3::uuid)
         LIMIT 1`,
        studioId,
        date,
        branchId ?? null,
      );
      const row = rows[0];
      if (!row) return null;
      const ageMs = Date.now() - new Date(row.generated_at).getTime();
      if (ageMs > 24 * 3600 * 1000) return null;
      return {
        date: typeof row.briefing_date === 'string'
          ? row.briefing_date.slice(0, 10)
          : new Date(row.briefing_date).toISOString().slice(0, 10),
        headline: row.headline,
        summary: row.summary,
        recommendations: (row.recommendations as any[]) ?? [],
        metrics: (row.metrics as Record<string, unknown>) ?? {},
        generated_at: new Date(row.generated_at).toISOString(),
        model: row.model,
      };
    } catch (err) {
      this.logger.warn(
        `fetchStored failed (table missing?): ${(err as Error)?.message ?? err}`,
      );
      return null;
    }
  }

  private async persist(
    studioId: string,
    branchId: string | undefined,
    b: DashboardBriefing,
  ) {
    try {
      await this.tenant.client.$executeRawUnsafe(
        `INSERT INTO dashboard_briefings
           (gym_id, branch_id, briefing_date, summary, headline, metrics, recommendations, model, generated_at)
         VALUES ($1::uuid, $2::uuid, $3::date, $4, $5, $6::jsonb, $7::jsonb, $8, NOW())
         ON CONFLICT (gym_id, briefing_date, branch_id) DO UPDATE SET
           summary = EXCLUDED.summary,
           headline = EXCLUDED.headline,
           metrics = EXCLUDED.metrics,
           recommendations = EXCLUDED.recommendations,
           model = EXCLUDED.model,
           generated_at = NOW()`,
        studioId,
        branchId ?? null,
        b.date,
        b.summary,
        b.headline,
        JSON.stringify(b.metrics),
        JSON.stringify(b.recommendations),
        b.model,
      );
    } catch (err) {
      this.logger.warn(
        `persist briefing failed: ${(err as Error)?.message ?? err}`,
      );
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private buildContext(
    pulse: any,
    actions: any[],
  ): { metrics: Record<string, unknown>; top_actions: any[] } {
    const metrics: Record<string, unknown> = {};
    if (pulse) {
      metrics.active_members = pulse.active_members?.value;
      metrics.today_revenue = pulse.today_revenue?.value;
      metrics.today_revenue_delta_pct = pulse.today_revenue?.delta_pct;
      metrics.mrr = pulse.mrr?.value;
      metrics.mrr_delta_pct = pulse.mrr?.delta_pct;
      metrics.check_ins_today = pulse.check_ins_today?.value;
      metrics.renewals_at_risk_7d = pulse.renewals_at_risk_7d?.value;
      metrics.renewals_at_risk_value_at_stake =
        pulse.renewals_at_risk_7d?.value_at_stake;
      metrics.outstanding_dues = pulse.outstanding_dues?.value;
      metrics.outstanding_dues_invoice_count =
        pulse.outstanding_dues?.invoice_count;
    }
    const top = (actions ?? []).slice(0, 6).map((a) => ({
      id: a.id,
      kind: a.kind,
      severity: a.severity,
      title: a.title,
      impact_amount: a.impact_amount ?? 0,
    }));
    return { metrics, top_actions: top };
  }

  private fallbackBriefing(ctx: {
    metrics: Record<string, unknown>;
    top_actions: any[];
  }): {
    headline: string;
    summary: string;
    recommendations: Array<{
      title: string;
      why: string;
      action_id: string | null;
    }>;
  } {
    const m = ctx.metrics;
    const summary = [
      typeof m.check_ins_today === 'number'
        ? `${m.check_ins_today} check-ins so far today`
        : null,
      typeof m.today_revenue === 'number'
        ? `₹${(m.today_revenue as number).toLocaleString()} revenue today`
        : null,
      typeof m.renewals_at_risk_7d === 'number' && (m.renewals_at_risk_7d as number) > 0
        ? `${m.renewals_at_risk_7d} renewals at risk this week (₹${((m.renewals_at_risk_value_at_stake as number) ?? 0).toLocaleString()} at stake)`
        : null,
      typeof m.outstanding_dues === 'number' && (m.outstanding_dues as number) > 0
        ? `₹${(m.outstanding_dues as number).toLocaleString()} dues outstanding`
        : null,
    ]
      .filter(Boolean)
      .join('. ');

    const recs = ctx.top_actions.slice(0, 3).map((a) => ({
      title: a.title,
      why: `Severity ${a.severity}, ₹${(a.impact_amount ?? 0).toLocaleString()} at stake.`,
      action_id: a.id,
    }));
    return {
      headline: ctx.top_actions[0]?.title ?? "Today's briefing",
      summary: summary || 'No notable activity yet today.',
      recommendations: recs,
    };
  }

  private emptyBriefing(): DashboardBriefing {
    return {
      date: todayKey(),
      headline: null,
      summary: 'Briefing not available — sign in with a studio context.',
      recommendations: [],
      metrics: {},
      generated_at: new Date().toISOString(),
      model: null,
    };
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function safeJsonParse(text: string): {
  headline: string;
  summary: string;
  recommendations: Array<{
    title: string;
    why: string;
    action_id: string | null;
  }>;
} | null {
  if (!text) return null;
  // Strip markdown fences if Claude added any.
  const stripped = text.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
  try {
    const parsed = JSON.parse(stripped);
    if (typeof parsed?.summary === 'string') {
      return {
        headline: typeof parsed.headline === 'string' ? parsed.headline : '',
        summary: parsed.summary,
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations.filter(
              (r: any) =>
                r &&
                typeof r.title === 'string' &&
                typeof r.why === 'string',
            )
          : [],
      };
    }
  } catch {
    // ignore — fallback path will run
  }
  return null;
}
