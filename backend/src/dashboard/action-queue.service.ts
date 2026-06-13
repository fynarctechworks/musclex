import { Injectable, Logger } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { resolveBranchScope } from '../common/branch-scope.util';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import {
  capabilitiesFor,
  resolveRoleView,
  type DashboardRoleView,
  type RoleCapabilities,
} from './role-view.util';
import { AnomalyService, type Anomaly } from './anomaly.service';
import { DashboardPulseService } from './dashboard-pulse.service';

export type ActionSeverity = 'high' | 'medium' | 'low';
export type ActionKind =
  | 'renewal_at_risk'
  | 'renewal_imminent'
  | 'dues_overdue'
  | 'payment_failed'
  | 'class_overfill'
  | 'trainer_no_show'
  | 'lead_cold'
  | 'inactive_member'
  | 'branch_underperform'
  | 'anomaly_check_ins_low'
  | 'anomaly_check_ins_high'
  | 'anomaly_revenue_low'
  | 'anomaly_revenue_high';

/**
 * "Why we said this" payload — surfaces the data points the rules engine /
 * anomaly detector used to generate this action. Rendered as a tooltip /
 * expand panel in the UI so users can audit AI-style recommendations.
 */
export interface ActionEvidence {
  /** A short data-driven sentence the user reads first. */
  summary: string;
  /** Optional metric name when the action is anomaly-driven. */
  metric?: string;
  /** Today's observed value. */
  value?: number;
  /** Baseline (mean of trailing window). */
  baseline?: number;
  /** Standard deviation. */
  stdev?: number;
  /** Deviation in σ units. */
  z_score?: number;
  /** % change vs baseline. */
  delta_pct?: number;
  /** Source rule / detector identifier. */
  source: string;
}

export interface ActionItem {
  id: string;
  kind: ActionKind;
  severity: ActionSeverity;
  title: string;
  reason?: string;
  impact_amount?: number;
  currency?: string;
  cta_label?: string;
  cta_href?: string;
  /** Stable references the front-end can use for navigation / bulk select. */
  refs: {
    member_id?: string;
    member_ids?: string[];
    invoice_id?: string;
    payment_id?: string;
    session_id?: string;
    lead_id?: string;
    branch_id?: string;
  };
  /** ISO timestamp when this item was first generated (best-effort). */
  generated_at: string;
  /** When set in the future, the item is currently snoozed and not in the queue. */
  snoozed_until?: string | null;
  /** "Why we said this" — surfaced as a tooltip / expand panel on each item. */
  evidence?: ActionEvidence;
}

interface ActionState {
  action_id: string;
  state: 'dismissed' | 'snoozed';
  snoozed_until: Date | null;
}

type BranchFilter = { branch_id?: string | { in: string[] } };

@Injectable()
export class ActionQueueService {
  private readonly logger = new Logger(ActionQueueService.name);

  constructor(
    private readonly tenant: TenantPrisma,
    private readonly anomaly: AnomalyService = new AnomalyService(),
    private readonly pulse?: DashboardPulseService,
  ) {}

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Compute the current Action Stack for a user. Applies dismiss/snooze
   * state from `dashboard_action_states` so resolved items don't reappear.
   */
  async getActions(
    user: JwtPayload | undefined,
    branchId: string | undefined,
  ): Promise<ActionItem[]> {
    const branchFilter = this.getBranchFilter(user, branchId);
    const view = resolveRoleView(user);
    const caps = capabilitiesFor(view);
    const trainerStaffId =
      view === 'trainer' ? await this.lookupTrainerStaffId(user) : null;
    const now = new Date();

    const [generated, states, dismissCounts] = await Promise.all([
      this.runRules(branchFilter, now, caps, trainerStaffId),
      this.loadStates(user?.studio_id),
      this.loadDismissCounts(user?.studio_id),
    ]);

    const stateMap = new Map<string, ActionState>(
      states.map((s) => [s.action_id, s]),
    );

    const out: ActionItem[] = [];
    for (const a of generated) {
      const s = stateMap.get(a.id);
      if (!s) {
        out.push(this.applyMemoryEscalation(a, dismissCounts.get(a.id) ?? 0));
        continue;
      }
      if (s.state === 'dismissed') continue;
      if (
        s.state === 'snoozed' &&
        s.snoozed_until &&
        new Date(s.snoozed_until) > now
      ) {
        continue;
      }
      out.push(this.applyMemoryEscalation(a, dismissCounts.get(a.id) ?? 0));
    }

    return this.rank(out);
  }

  /**
   * Action memory (Wave 7) — when an item has been dismissed or snoozed
   * multiple times, escalate. The premise: ignored signals shouldn't
   * silently fade. Two prior receipts → bump medium → high. Three or more
   * prior receipts → if already high, prefix the title so the user knows
   * we're noticing the pattern.
   *
   * Resolved items don't re-emit (they're caught by the dismissed state),
   * so this only escalates *items the user keeps deferring*.
   */
  private applyMemoryEscalation(
    item: ActionItem,
    priorCount: number,
  ): ActionItem {
    if (priorCount < 2) return item;
    let severity: ActionSeverity = item.severity;
    if (priorCount >= 2 && severity === 'low') severity = 'medium';
    if (priorCount >= 2 && severity === 'medium') severity = 'high';
    let title = item.title;
    if (priorCount >= 3) {
      title = `Still open · ${title}`;
    }
    const reason =
      priorCount >= 3
        ? `${item.reason ? `${item.reason} · ` : ''}You've snoozed/dismissed this ${priorCount} times.`
        : item.reason;
    return { ...item, severity, title, reason };
  }

  /**
   * Counts prior dismiss/snooze receipts per action_id in the last 30 days.
   * Receipts are written by dismiss(), snooze(), and resolve() — only
   * dismiss + snooze count toward escalation (resolve is a *win* and the
   * action wouldn't re-emit anyway).
   */
  private async loadDismissCounts(
    studioId?: string,
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!studioId) return out;
    try {
      const since = new Date(Date.now() - 30 * 86400000);
      const rows = await this.tenant.client.$queryRawUnsafe<
        { action_id: string; count: number }[]
      >(
        `SELECT action_id, COUNT(*)::int AS count
         FROM dashboard_action_receipts
         WHERE gym_id = $1::uuid
           AND created_at >= $2
           AND receipt_type IN ('dismissed', 'snoozed')
         GROUP BY action_id`,
        studioId,
        since,
      );
      for (const r of rows) out.set(r.action_id, Number(r.count) || 0);
      return out;
    } catch (err) {
      this.logger.warn(
        `loadDismissCounts failed: ${(err as Error)?.message ?? err}`,
      );
      return out;
    }
  }

  async dismiss(
    user: JwtPayload,
    actionId: string,
    branchId?: string,
  ): Promise<{ ok: true }> {
    if (!user?.studio_id) throw new Error('No studio in JWT');
    await this.upsertState(
      user.studio_id,
      actionId,
      'dismissed',
      null,
      user.user_id,
      branchId,
    );
    await this.logReceipt(user, actionId, this.kindFromId(actionId), 'dismissed', branchId);
    return { ok: true };
  }

  async snooze(
    user: JwtPayload,
    actionId: string,
    until: Date,
    branchId?: string,
  ): Promise<{ ok: true; snoozed_until: string }> {
    if (!user?.studio_id) throw new Error('No studio in JWT');
    await this.upsertState(
      user.studio_id,
      actionId,
      'snoozed',
      until,
      user.user_id,
      branchId,
    );
    await this.logReceipt(
      user,
      actionId,
      this.kindFromId(actionId),
      'snoozed',
      branchId,
      { snoozed_until: until.toISOString() },
    );
    return { ok: true, snoozed_until: until.toISOString() };
  }

  async resolve(
    user: JwtPayload,
    actionId: string,
    branchId?: string,
    payload?: Record<string, unknown>,
  ): Promise<{ ok: true }> {
    if (!user?.studio_id) throw new Error('No studio in JWT');
    // "Resolved" = mark as dismissed AND log a resolution receipt.
    await this.upsertState(
      user.studio_id,
      actionId,
      'dismissed',
      null,
      user.user_id,
      branchId,
    );
    await this.logReceipt(
      user,
      actionId,
      this.kindFromId(actionId),
      'resolved',
      branchId,
      payload,
    );
    return { ok: true };
  }

  async getReceipts(
    user: JwtPayload,
    limit = 25,
    sinceDays = 7,
  ): Promise<
    Array<{
      id: string;
      action_id: string;
      action_kind: string;
      receipt_type: string;
      created_at: string;
      actor_user_id: string | null;
      payload: Record<string, unknown> | null;
    }>
  > {
    if (!user?.studio_id) return [];
    const since = new Date(Date.now() - sinceDays * 86400000);
    try {
      const rows = await this.tenant.client.$queryRawUnsafe<any[]>(
        `SELECT id, action_id, action_kind, receipt_type, created_at, actor_user_id, payload
         FROM dashboard_action_receipts
         WHERE gym_id = $1::uuid AND created_at >= $2
         ORDER BY created_at DESC
         LIMIT ${Math.min(Math.max(limit, 1), 100)}`,
        user.studio_id,
        since,
      );
      return rows.map((r) => ({
        ...r,
        created_at: new Date(r.created_at).toISOString(),
      }));
    } catch (err) {
      this.logger.warn(`getReceipts failed: ${(err as Error)?.message ?? err}`);
      return [];
    }
  }

  // ── Rule engine ──────────────────────────────────────────────────

  private async runRules(
    branchFilter: BranchFilter,
    now: Date,
    caps: RoleCapabilities = capabilitiesFor('owner'),
    trainerStaffId: string | null = null,
  ): Promise<ActionItem[]> {
    const tasks: Array<{ name: string; fn: () => Promise<ActionItem[]> }> = [];

    // ── Rules included per role view (§3.6 visibility matrix) ──
    if (this.includeRule('renewal_at_risk', caps)) {
      tasks.push({
        name: 'renewal_at_risk',
        fn: () =>
          caps.view === 'trainer'
            ? this.ruleRenewalAtRiskForTrainer(branchFilter, now, trainerStaffId)
            : this.ruleRenewalAtRisk(branchFilter, now),
      });
    }
    if (this.includeRule('dues_overdue', caps)) {
      tasks.push({ name: 'dues_overdue', fn: () => this.ruleDuesOverdue(branchFilter, now) });
    }
    if (this.includeRule('payment_failed', caps)) {
      tasks.push({ name: 'payment_failed', fn: () => this.rulePaymentFailed(branchFilter, now) });
    }
    if (this.includeRule('class_overfill', caps)) {
      tasks.push({ name: 'class_overfill', fn: () => this.ruleClassOverfill(branchFilter, now, trainerStaffId) });
    }
    if (this.includeRule('trainer_no_show', caps)) {
      tasks.push({ name: 'trainer_no_show', fn: () => this.ruleTrainerNoShow(branchFilter, now, trainerStaffId) });
    }
    if (this.includeRule('lead_cold', caps)) {
      tasks.push({ name: 'lead_cold', fn: () => this.ruleLeadCold(branchFilter, now) });
    }
    if (this.includeRule('inactive_member', caps)) {
      tasks.push({
        name: 'inactive_member',
        fn: () =>
          caps.view === 'trainer'
            ? this.ruleInactiveMemberForTrainer(branchFilter, now, trainerStaffId)
            : this.ruleInactiveMember(branchFilter, now),
      });
    }
    if (this.includeRule('anomaly', caps)) {
      tasks.push({
        name: 'anomaly',
        fn: () => this.ruleAnomalies(now, branchFilter),
      });
    }

    const settled = await Promise.allSettled(tasks.map((t) => t.fn()));
    const all: ActionItem[] = [];
    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      if (r.status === 'fulfilled') {
        all.push(...r.value);
      } else {
        this.logger.warn(
          `Rule "${tasks[i].name}" failed: ${(r.reason as Error)?.message ?? r.reason}`,
        );
      }
    }
    return all;
  }

  /**
   * Rule allowlist per role view (§3.6 visibility matrix).
   *
   *   - owner / manager: all rules
   *   - front_desk: only desk-level items (dues, classes, leads)
   *   - trainer: only items related to their classes / clients
   */
  private includeRule(rule: string, caps: RoleCapabilities): boolean {
    const view: DashboardRoleView = caps.view;
    if (view === 'owner' || view === 'manager') return true;
    if (view === 'front_desk') {
      return ['dues_overdue', 'class_overfill', 'lead_cold'].includes(rule);
    }
    if (view === 'trainer') {
      return [
        'renewal_at_risk',
        'class_overfill',
        'trainer_no_show',
        'inactive_member',
      ].includes(rule);
    }
    return false;
  }

  /**
   * Detect statistical anomalies in today's KPIs vs the 13-day baseline,
   * by reading the existing pulse sparklines (zero new DB load when pulse
   * is already cached). Each anomaly emits an Action with an evidence
   * payload so the user can see *why* we said this.
   */
  private async ruleAnomalies(
    now: Date,
    branchFilter: BranchFilter,
  ): Promise<ActionItem[]> {
    if (!this.pulse) return [];
    let pulse;
    try {
      const branchId =
        typeof branchFilter.branch_id === 'string'
          ? branchFilter.branch_id
          : undefined;
      pulse = await this.pulse.getPulse(undefined, branchId);
    } catch (err) {
      this.logger.warn(
        `ruleAnomalies could not fetch pulse: ${(err as Error)?.message ?? err}`,
      );
      return [];
    }

    const out: ActionItem[] = [];
    const todayKey = now.toISOString().slice(0, 10);

    const checkInsAnomaly = this.anomaly.detect({
      series_14d: pulse.check_ins_today.sparkline ?? [],
      today_value: pulse.check_ins_today.value,
      metric: 'check_ins',
    });
    if (checkInsAnomaly) {
      out.push(this.anomalyToAction(checkInsAnomaly, now, todayKey, 'check_ins'));
    }

    const revenueAnomaly = this.anomaly.detect({
      series_14d: pulse.today_revenue.sparkline ?? [],
      today_value: pulse.today_revenue.value,
      metric: 'revenue',
    });
    if (revenueAnomaly) {
      out.push(this.anomalyToAction(revenueAnomaly, now, todayKey, 'revenue'));
    }
    return out;
  }

  private anomalyToAction(
    a: Anomaly,
    now: Date,
    dayKey: string,
    metricKey: 'check_ins' | 'revenue',
  ): ActionItem {
    const kind = `anomaly_${a.kind}` as ActionKind;
    return {
      id: `${kind}:${dayKey}`,
      kind,
      severity: a.severity,
      title: a.summary,
      reason: a.why,
      cta_label: a.kind.endsWith('_low') ? 'Investigate' : 'Capitalize',
      cta_href: metricKey === 'revenue' ? '/payments' : '/check-ins',
      refs: {},
      generated_at: now.toISOString(),
      evidence: {
        summary: a.summary,
        metric: a.metric,
        value: a.value,
        baseline: a.baseline,
        stdev: a.stdev,
        z_score: a.z_score,
        delta_pct: a.delta_pct,
        source: 'anomaly_detector_v1',
      },
    };
  }

  /**
   * Look up the Staff record linked to this user (trainer cockpit needs the
   * staff_id to scope sessions/clients). Returns null if the user has no
   * matching staff row, in which case trainer-scoped rules return [].
   */
  private async lookupTrainerStaffId(
    user?: JwtPayload | null,
  ): Promise<string | null> {
    if (!user?.user_id) return null;
    try {
      const row = await this.tenant.client.staff.findFirst({
        where: { user_id: user.user_id, is_active: true },
        select: { id: true },
      });
      return row?.id ?? null;
    } catch (err) {
      this.logger.warn(
        `lookupTrainerStaffId failed: ${(err as Error)?.message ?? err}`,
      );
      return null;
    }
  }

  /**
   * Rule: members whose memberships expire in the next 7 days. Splits into
   * "imminent" (≤3 days, high severity) and "at-risk" (4-7 days, medium).
   */
  private async ruleRenewalAtRisk(
    branchFilter: BranchFilter,
    now: Date,
  ): Promise<ActionItem[]> {
    const horizon = new Date(now.getTime() + 7 * 86400000);
    const memberships = await this.tenant.client.memberMembership.findMany({
      where: {
        status: 'active',
        end_date: { gte: now, lte: horizon },
        ...branchFilter,
      },
      select: {
        id: true,
        member_id: true,
        end_date: true,
        branch_id: true,
        plan: { select: { price: true, name: true } },
        member: { select: { full_name: true, member_code: true } },
      },
      take: 100,
      orderBy: { end_date: 'asc' },
    });

    const items: ActionItem[] = [];
    for (const m of memberships) {
      if (!m.end_date) continue;
      const daysLeft = Math.ceil(
        (new Date(m.end_date).getTime() - now.getTime()) / 86400000,
      );
      const imminent = daysLeft <= 3;
      const price = Number(m.plan?.price ?? 0);
      const isoDate = new Date(m.end_date).toISOString().slice(0, 10);
      items.push({
        id: `${imminent ? 'renewal_imminent' : 'renewal_at_risk'}:${m.member_id}:${isoDate}`,
        kind: imminent ? 'renewal_imminent' : 'renewal_at_risk',
        severity: imminent ? 'high' : 'medium',
        title: `${m.member?.full_name ?? 'Member'} (${m.member?.member_code ?? '—'}) expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
        reason: m.plan?.name
          ? `Plan: ${m.plan.name}`
          : 'Send a renewal nudge before they lapse.',
        impact_amount: price,
        currency: '₹',
        cta_label: 'Send nudge',
        cta_href: `/members/${m.member_id}#renew`,
        refs: { member_id: m.member_id, branch_id: m.branch_id ?? undefined },
        generated_at: now.toISOString(),
      });
    }
    return items;
  }

  /**
   * Rule: pending or partial invoices with the oldest age first. Severity
   * scales with age: <7d low, 7-30d medium, >30d high.
   */
  private async ruleDuesOverdue(
    branchFilter: BranchFilter,
    now: Date,
  ): Promise<ActionItem[]> {
    const invoices = await this.tenant.client.memberInvoice.findMany({
      where: {
        status: { in: ['pending', 'partial'] },
        ...branchFilter,
      },
      select: {
        id: true,
        member_id: true,
        branch_id: true,
        total_amount: true,
        issued_at: true,
        due_date: true,
        invoice_number: true,
        member: { select: { full_name: true, member_code: true } },
      },
      take: 50,
      orderBy: [{ due_date: 'asc' }, { issued_at: 'asc' }],
    });

    const items: ActionItem[] = [];
    for (const inv of invoices) {
      const anchor = inv.due_date ?? inv.issued_at;
      const ageDays = anchor
        ? Math.max(
            0,
            Math.floor(
              (now.getTime() - new Date(anchor).getTime()) / 86400000,
            ),
          )
        : 0;
      const severity: ActionSeverity =
        ageDays > 30 ? 'high' : ageDays > 7 ? 'medium' : 'low';
      items.push({
        id: `dues_overdue:${inv.id}`,
        kind: 'dues_overdue',
        severity,
        title: `${inv.member?.full_name ?? 'Member'} owes ₹${Number(inv.total_amount).toLocaleString()}`,
        reason: `Invoice ${inv.invoice_number} · ${ageDays} day${ageDays === 1 ? '' : 's'} old`,
        impact_amount: Number(inv.total_amount),
        currency: '₹',
        cta_label: 'Collect',
        cta_href: `/payments?invoice=${inv.id}`,
        refs: {
          invoice_id: inv.id,
          member_id: inv.member_id,
          branch_id: inv.branch_id ?? undefined,
        },
        generated_at: now.toISOString(),
      });
    }
    return items;
  }

  /** Rule: payments stuck in `failed` status — chase or reissue. */
  private async rulePaymentFailed(
    branchFilter: BranchFilter,
    now: Date,
  ): Promise<ActionItem[]> {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const payments = await this.tenant.client.payment.findMany({
      where: {
        status: 'failed',
        created_at: { gte: sevenDaysAgo },
        ...branchFilter,
      },
      select: {
        id: true,
        member_id: true,
        amount: true,
        branch_id: true,
        created_at: true,
        member: { select: { full_name: true, member_code: true } },
      },
      take: 30,
      orderBy: { created_at: 'desc' },
    });
    return payments.map((p) => ({
      id: `payment_failed:${p.id}`,
      kind: 'payment_failed' as ActionKind,
      severity: 'high' as ActionSeverity,
      title: `Payment failed — ${p.member?.full_name ?? 'Member'}`,
      reason: `₹${Number(p.amount).toLocaleString()} · ${this.timeAgo(p.created_at, now)}`,
      impact_amount: Number(p.amount),
      currency: '₹',
      cta_label: 'Retry / contact',
      cta_href: `/payments/${p.id}`,
      refs: { payment_id: p.id, member_id: p.member_id, branch_id: p.branch_id },
      generated_at: now.toISOString(),
    }));
  }

  /** Rule: class sessions in next 24h above 90% capacity — open waitlist or add session. */
  private async ruleClassOverfill(
    branchFilter: BranchFilter,
    now: Date,
    trainerStaffId: string | null = null,
  ): Promise<ActionItem[]> {
    const horizon = new Date(now.getTime() + 24 * 3600000);
    const trainerScope = trainerStaffId ? { trainer_id: trainerStaffId } : {};
    const sessions = await this.tenant.client.classSession.findMany({
      where: {
        status: 'scheduled',
        start_time: { gte: now, lte: horizon },
        ...branchFilter,
        ...trainerScope,
      },
      select: {
        id: true,
        name: true,
        capacity: true,
        enrolled_count: true,
        waitlist_count: true,
        start_time: true,
        branch_id: true,
      },
      take: 50,
    });
    const items: ActionItem[] = [];
    for (const s of sessions) {
      if (s.capacity <= 0) continue;
      const fillRate = s.enrolled_count / s.capacity;
      if (fillRate < 0.9 && s.waitlist_count === 0) continue;
      items.push({
        id: `class_overfill:${s.id}`,
        kind: 'class_overfill',
        severity: fillRate >= 1 ? 'high' : 'medium',
        title: `${s.name} is ${Math.round(fillRate * 100)}% full`,
        reason: `${s.enrolled_count}/${s.capacity}${s.waitlist_count > 0 ? ` · ${s.waitlist_count} on waitlist` : ''} · ${this.shortDateTime(s.start_time)}`,
        cta_label: 'Open class',
        cta_href: `/classes/sessions/${s.id}`,
        refs: { session_id: s.id, branch_id: s.branch_id },
        generated_at: now.toISOString(),
      });
    }
    return items;
  }

  /** Rule: scheduled session that started >15 min ago with 0 attendance and not cancelled. */
  private async ruleTrainerNoShow(
    branchFilter: BranchFilter,
    now: Date,
    trainerStaffId: string | null = null,
  ): Promise<ActionItem[]> {
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600000);
    const trainerScope = trainerStaffId ? { trainer_id: trainerStaffId } : {};
    const sessions = await this.tenant.client.classSession.findMany({
      where: {
        status: 'scheduled',
        start_time: { gte: twoHoursAgo, lte: fifteenMinAgo },
        ...branchFilter,
        ...trainerScope,
      },
      select: {
        id: true,
        name: true,
        start_time: true,
        trainer_id: true,
        branch_id: true,
        trainer: { select: { full_name: true } },
        attendance: { select: { id: true }, take: 1 },
      },
      take: 20,
    });
    return sessions
      .filter((s) => s.attendance.length === 0)
      .map((s) => ({
        id: `trainer_no_show:${s.id}`,
        kind: 'trainer_no_show' as ActionKind,
        severity: 'high' as ActionSeverity,
        title: `${s.trainer?.full_name ?? 'Trainer'} — ${s.name} appears to have no-showed`,
        reason: `Started ${this.timeAgo(s.start_time, now)}, zero check-ins`,
        cta_label: 'Reach out',
        cta_href: `/staff/${s.trainer_id}`,
        refs: { session_id: s.id, branch_id: s.branch_id },
        generated_at: now.toISOString(),
      }));
  }

  /** Rule: leads with no activity in >48h, status ∈ {new, contacted}. */
  private async ruleLeadCold(
    branchFilter: BranchFilter,
    now: Date,
  ): Promise<ActionItem[]> {
    const fortyEightHrsAgo = new Date(now.getTime() - 48 * 3600000);
    const leadBranchFilter = branchFilter.branch_id
      ? { branch_id: branchFilter.branch_id }
      : {};
    const leads = await this.tenant.client.lead.findMany({
      where: {
        status: { in: ['new', 'contacted'] },
        updated_at: { lte: fortyEightHrsAgo },
        ...leadBranchFilter,
      },
      select: {
        id: true,
        full_name: true,
        lead_source: true,
        updated_at: true,
        branch_id: true,
      },
      take: 25,
      orderBy: { updated_at: 'asc' },
    });
    return leads.map((l) => ({
      id: `lead_cold:${l.id}`,
      kind: 'lead_cold' as ActionKind,
      severity: 'medium' as ActionSeverity,
      title: `Cold lead: ${l.full_name}`,
      reason: `Source: ${l.lead_source ?? 'unknown'} · last touched ${this.timeAgo(l.updated_at, now)}`,
      cta_label: 'Follow up',
      cta_href: `/leads/${l.id}`,
      refs: { lead_id: l.id, branch_id: l.branch_id ?? undefined },
      generated_at: now.toISOString(),
    }));
  }

  /** Rule: active members with no check-in in 14+ days — pre-churn warning. */
  private async ruleInactiveMember(
    branchFilter: BranchFilter,
    now: Date,
  ): Promise<ActionItem[]> {
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
    const members = await this.tenant.client.member.findMany({
      where: {
        status: 'active',
        ...branchFilter,
        check_ins: { none: { checked_in_at: { gte: fourteenDaysAgo } } },
      },
      select: {
        id: true,
        full_name: true,
        member_code: true,
        branch_id: true,
      },
      take: 15,
    });
    return members.map((m) => ({
      id: `inactive_member:${m.id}`,
      kind: 'inactive_member' as ActionKind,
      severity: 'low' as ActionSeverity,
      title: `${m.full_name} hasn't checked in in 14+ days`,
      reason: 'Pre-churn signal — reach out before the membership lapses.',
      cta_label: 'Open profile',
      cta_href: `/members/${m.id}`,
      refs: { member_id: m.id, branch_id: m.branch_id },
      generated_at: now.toISOString(),
    }));
  }

  // ── Trainer-scoped rule variants ─────────────────────────────────

  /**
   * Renewals among the trainer's own clients (members who attended any of
   * this trainer's classes in the last 60 days). When no class data exists
   * yet, this falls back gracefully to an empty list.
   */
  private async ruleRenewalAtRiskForTrainer(
    branchFilter: BranchFilter,
    now: Date,
    trainerStaffId: string | null,
  ): Promise<ActionItem[]> {
    if (!trainerStaffId) return [];
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);
    const horizon = new Date(now.getTime() + 7 * 86400000);

    // Find members who attended this trainer's sessions in the last 60d.
    const attendances = await this.tenant.client.classAttendance.findMany({
      where: {
        session: {
          trainer_id: trainerStaffId,
          start_time: { gte: sixtyDaysAgo },
        },
      },
      select: { member_id: true },
      take: 500,
    });
    const memberIds = Array.from(
      new Set(attendances.map((a) => a.member_id).filter(Boolean)),
    );
    if (memberIds.length === 0) return [];

    const memberships = await this.tenant.client.memberMembership.findMany({
      where: {
        status: 'active',
        member_id: { in: memberIds },
        end_date: { gte: now, lte: horizon },
        ...branchFilter,
      },
      select: {
        id: true,
        member_id: true,
        end_date: true,
        branch_id: true,
        plan: { select: { price: true, name: true } },
        member: { select: { full_name: true, member_code: true } },
      },
      take: 50,
      orderBy: { end_date: 'asc' },
    });

    return memberships
      .filter((m) => m.end_date)
      .map((m) => {
        const daysLeft = Math.ceil(
          (new Date(m.end_date as Date).getTime() - now.getTime()) / 86400000,
        );
        const imminent = daysLeft <= 3;
        const isoDate = new Date(m.end_date as Date).toISOString().slice(0, 10);
        return {
          id: `${imminent ? 'renewal_imminent' : 'renewal_at_risk'}:${m.member_id}:${isoDate}`,
          kind: imminent ? 'renewal_imminent' : 'renewal_at_risk',
          severity: (imminent ? 'high' : 'medium') as ActionSeverity,
          title: `${m.member?.full_name ?? 'Client'} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
          reason: m.plan?.name
            ? `Your client · Plan: ${m.plan.name}`
            : 'Your client — reach out before they lapse.',
          impact_amount: Number(m.plan?.price ?? 0),
          currency: '₹',
          cta_label: 'Reach out',
          cta_href: `/members/${m.member_id}`,
          refs: { member_id: m.member_id, branch_id: m.branch_id ?? undefined },
          generated_at: now.toISOString(),
        } as ActionItem;
      });
  }

  /** Inactive members among the trainer's own clients. */
  private async ruleInactiveMemberForTrainer(
    _branchFilter: BranchFilter,
    now: Date,
    trainerStaffId: string | null,
  ): Promise<ActionItem[]> {
    if (!trainerStaffId) return [];
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);

    const attendances = await this.tenant.client.classAttendance.findMany({
      where: {
        session: {
          trainer_id: trainerStaffId,
          start_time: { gte: sixtyDaysAgo },
        },
      },
      select: { member_id: true },
      take: 500,
    });
    const memberIds = Array.from(
      new Set(attendances.map((a) => a.member_id).filter(Boolean)),
    );
    if (memberIds.length === 0) return [];

    const members = await this.tenant.client.member.findMany({
      where: {
        id: { in: memberIds },
        status: 'active',
        check_ins: { none: { checked_in_at: { gte: fourteenDaysAgo } } },
      },
      select: {
        id: true,
        full_name: true,
        member_code: true,
        branch_id: true,
      },
      take: 15,
    });
    return members.map((m) => ({
      id: `inactive_member:${m.id}`,
      kind: 'inactive_member' as ActionKind,
      severity: 'low' as ActionSeverity,
      title: `${m.full_name} hasn't been in for 14+ days`,
      reason: 'Your client — a quick check-in keeps them engaged.',
      cta_label: 'Open profile',
      cta_href: `/members/${m.id}`,
      refs: { member_id: m.id, branch_id: m.branch_id },
      generated_at: now.toISOString(),
    }));
  }

  // ── Ranking ──────────────────────────────────────────────────────

  private rank(items: ActionItem[]): ActionItem[] {
    const severityRank: Record<ActionSeverity, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };
    return [...items].sort((a, b) => {
      const sev = severityRank[a.severity] - severityRank[b.severity];
      if (sev !== 0) return sev;
      return (b.impact_amount ?? 0) - (a.impact_amount ?? 0);
    });
  }

  // ── State persistence (raw SQL — no Prisma client dependency) ────

  private async loadStates(studioId?: string): Promise<ActionState[]> {
    if (!studioId) return [];
    try {
      const rows = await this.tenant.client.$queryRawUnsafe<ActionState[]>(
        `SELECT action_id, state, snoozed_until
         FROM dashboard_action_states
         WHERE gym_id = $1::uuid
           AND (state = 'dismissed' OR (state = 'snoozed' AND snoozed_until > NOW()))`,
        studioId,
      );
      return rows;
    } catch (err) {
      this.logger.warn(
        `loadStates failed (table missing?): ${(err as Error)?.message ?? err}`,
      );
      return [];
    }
  }

  private async upsertState(
    studioId: string,
    actionId: string,
    state: 'dismissed' | 'snoozed',
    snoozedUntil: Date | null,
    userId?: string,
    branchId?: string,
  ): Promise<void> {
    try {
      await this.tenant.client.$executeRawUnsafe(
        `INSERT INTO dashboard_action_states
           (gym_id, branch_id, action_id, state, snoozed_until, updated_by_user_id, updated_at)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid, NOW())
         ON CONFLICT (gym_id, action_id) DO UPDATE SET
           state = EXCLUDED.state,
           snoozed_until = EXCLUDED.snoozed_until,
           updated_by_user_id = EXCLUDED.updated_by_user_id,
           updated_at = NOW()`,
        studioId,
        branchId ?? null,
        actionId,
        state,
        snoozedUntil,
        userId ?? null,
      );
    } catch (err) {
      this.logger.warn(
        `upsertState failed: ${(err as Error)?.message ?? err}`,
      );
      throw err;
    }
  }

  private async logReceipt(
    user: JwtPayload,
    actionId: string,
    actionKind: string,
    receiptType: 'resolved' | 'dismissed' | 'snoozed' | 'bulk_resolved',
    branchId?: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    if (!user?.studio_id) return;
    try {
      await this.tenant.client.$executeRawUnsafe(
        `INSERT INTO dashboard_action_receipts
           (gym_id, branch_id, action_id, action_kind, receipt_type, actor_user_id, actor_role, payload)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid, $7, $8::jsonb)`,
        user.studio_id,
        branchId ?? null,
        actionId,
        actionKind,
        receiptType,
        user.user_id ?? null,
        user.role ?? null,
        payload ? JSON.stringify(payload) : null,
      );
    } catch (err) {
      this.logger.warn(
        `logReceipt failed (non-fatal): ${(err as Error)?.message ?? err}`,
      );
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private getBranchFilter(
    user?: JwtPayload,
    explicitBranchId?: string,
  ): BranchFilter {
    return resolveBranchScope(user, explicitBranchId).branchFilter as BranchFilter;
  }

  private kindFromId(id: string): string {
    return id.split(':')[0] ?? 'unknown';
  }

  private timeAgo(date: Date | string | null, now: Date): string {
    if (!date) return 'unknown';
    const d = typeof date === 'string' ? new Date(date) : date;
    const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }

  private shortDateTime(date: Date | string | null): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    });
  }
}
