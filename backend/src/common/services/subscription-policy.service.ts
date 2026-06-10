import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SccSyncService } from './scc-sync.service';
import { PLAN_CONFIGS } from '../plan-configs';
import {
  SubscriptionContext,
  SubscriptionLifecycleStatus,
} from '../decorators/current-user.decorator';

const DAY_MS = 24 * 60 * 60 * 1000;

interface StudioLifecycleFields {
  id: string;
  subscription_plan: string;
  subscription_status: string;
  billing_cycle: string;
  next_billing_date: Date | null;
  trial_ends_at: Date | null;
  lifecycle_status: string;
  grace_until: Date | null;
  locked_at: Date | null;
  suspended_at: Date | null;
}

export interface ComputedStatus {
  status: SubscriptionLifecycleStatus;
  grace_until: Date | null;
  locked_at: Date | null;
  days_until_expiry: number | null;
  grace_days_remaining: number | null;
}

/**
 * Single source of truth for subscription lifecycle.
 *
 * - computeStatus()      : pure function (date, plan, studio) → status
 * - recomputeForStudio() : recompute + persist + emit ledger on transition
 * - getContext()         : build the SubscriptionContext attached to requests
 * - renew()              : strict continuity — next period starts from prior expiry,
 *                          NOT from payment date, even if locked
 *
 * All dates are UTC. Caller is responsible for tenant context.
 */
@Injectable()
export class SubscriptionPolicyService {
  private readonly logger = new Logger(SubscriptionPolicyService.name);

  // Per-tenant context cache to avoid hammering the studios table.
  // 60-second TTL — short enough that a renewal in another tab is reflected
  // quickly, long enough to absorb burst traffic from a single user.
  private readonly contextCache = new Map<
    string,
    { expires: number; context: SubscriptionContext }
  >();
  private static readonly CACHE_TTL_MS = 60_000;

  // Whitelist of suspended_at -> SUSPENDED beats locked.
  // Order of precedence: SUSPENDED > LOCKED > GRACE_PERIOD > ACTIVE.

  constructor(
    private readonly prisma: PrismaService,
    private readonly sccSync: SccSyncService,
  ) {}

  // ────────────────────────────────────────────────────────────
  // PURE LOGIC
  // ────────────────────────────────────────────────────────────

  /**
   * Resolve grace_days for a plan name from DB (preferred) or in-memory fallback.
   * Caller passes a pre-loaded map for batch jobs; otherwise we look it up.
   */
  async getGraceDays(planName: string): Promise<number> {
    const dbPlan = await this.prisma.subscriptionPlan
      .findUnique({ where: { name: planName }, select: { grace_days: true } })
      .catch(() => null);
    if (dbPlan?.grace_days != null) return dbPlan.grace_days;
    // Fallback to per-tier defaults baked into PLAN_CONFIGS (none today — use 3)
    if (PLAN_CONFIGS[planName]) return 3;
    this.logger.warn(`Unknown plan "${planName}" — defaulting grace_days=3`);
    return 3;
  }

  /**
   * Pure compute: given a studio's billing fields + plan grace_days + now,
   * derive lifecycle_status and the transition-relevant timestamps.
   *
   * SUSPENDED (manual) always wins.
   * Trials extend ACTIVE via trial_ends_at.
   */
  computeStatus(
    studio: Pick<
      StudioLifecycleFields,
      | 'next_billing_date'
      | 'trial_ends_at'
      | 'suspended_at'
      | 'grace_until'
      | 'locked_at'
    >,
    graceDays: number,
    now: Date = new Date(),
  ): ComputedStatus {
    // Manual suspension overrides everything.
    if (studio.suspended_at) {
      return {
        status: 'suspended',
        grace_until: null,
        locked_at: studio.locked_at, // preserve original lock if it was set
        days_until_expiry: null,
        grace_days_remaining: null,
      };
    }

    // Trial period — always ACTIVE until trial_ends_at.
    if (studio.trial_ends_at && studio.trial_ends_at.getTime() > now.getTime()) {
      return {
        status: 'active',
        grace_until: null,
        locked_at: null,
        days_until_expiry: Math.ceil(
          (studio.trial_ends_at.getTime() - now.getTime()) / DAY_MS,
        ),
        grace_days_remaining: null,
      };
    }

    // No billing date set yet — treat as ACTIVE (new studio, free tier, etc).
    if (!studio.next_billing_date) {
      return {
        status: 'active',
        grace_until: null,
        locked_at: null,
        days_until_expiry: null,
        grace_days_remaining: null,
      };
    }

    const expiry = studio.next_billing_date.getTime();
    const nowMs = now.getTime();

    if (nowMs <= expiry) {
      // Still within paid period.
      return {
        status: 'active',
        grace_until: null,
        locked_at: null,
        days_until_expiry: Math.ceil((expiry - nowMs) / DAY_MS),
        grace_days_remaining: null,
      };
    }

    // Past expiry — within grace?
    const graceUntil = new Date(expiry + graceDays * DAY_MS);
    if (nowMs <= graceUntil.getTime()) {
      return {
        status: 'grace_period',
        grace_until: graceUntil,
        locked_at: null,
        days_until_expiry: 0,
        grace_days_remaining: Math.ceil((graceUntil.getTime() - nowMs) / DAY_MS),
      };
    }

    // Past grace → LOCKED. locked_at = end of grace (deterministic, not now()).
    return {
      status: 'locked',
      grace_until: graceUntil,
      locked_at: studio.locked_at ?? graceUntil,
      days_until_expiry: 0,
      grace_days_remaining: 0,
    };
  }

  // ────────────────────────────────────────────────────────────
  // PERSISTED STATE + LEDGER
  // ────────────────────────────────────────────────────────────

  /**
   * Recompute lifecycle_status for one studio. If it changed, persist and
   * append a SubscriptionEvent. Returns the computed result either way.
   *
   * Idempotent: calling twice without a real transition only updates
   * last_status_computed_at and writes no event.
   */
  async recomputeForStudio(
    studioId: string,
    now: Date = new Date(),
  ): Promise<{ computed: ComputedStatus; transitioned: boolean; previous: SubscriptionLifecycleStatus }> {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: {
        id: true,
        subscription_plan: true,
        subscription_status: true,
        billing_cycle: true,
        next_billing_date: true,
        trial_ends_at: true,
        lifecycle_status: true,
        grace_until: true,
        locked_at: true,
        suspended_at: true,
      },
    });
    if (!studio) {
      throw new Error(`Studio ${studioId} not found`);
    }

    const graceDays = await this.getGraceDays(studio.subscription_plan);
    const computed = this.computeStatus(studio, graceDays, now);
    const previous = studio.lifecycle_status as SubscriptionLifecycleStatus;

    const transitioned = previous !== computed.status;

    await this.prisma.studio.update({
      where: { id: studioId },
      data: {
        lifecycle_status: computed.status,
        grace_until: computed.grace_until,
        locked_at: computed.locked_at,
        last_status_computed_at: now,
      },
    });

    if (transitioned) {
      const eventType = this.eventForTransition(previous, computed.status);
      await this.prisma.subscriptionEvent.create({
        data: {
          studio_id: studioId,
          event_type: eventType,
          from_status: previous,
          to_status: computed.status,
          plan_name: studio.subscription_plan,
          billing_cycle: studio.billing_cycle,
          period_start: null,
          period_end: studio.next_billing_date,
          actor_type: 'system',
          metadata: { computed_at: now.toISOString() },
        },
      });
      this.logger.log(
        `Studio ${studioId}: ${previous} → ${computed.status} (event=${eventType})`,
      );
      this.invalidateCache(studioId);
    }

    return { computed, transitioned, previous };
  }

  private eventForTransition(
    from: SubscriptionLifecycleStatus,
    to: SubscriptionLifecycleStatus,
  ): string {
    if (to === 'grace_period') return 'entered_grace';
    if (to === 'locked')       return 'locked';
    if (to === 'suspended')    return 'suspended';
    if (from === 'locked'     && to === 'active') return 'unlocked';
    if (from === 'grace_period' && to === 'active') return 'unlocked';
    if (from === 'suspended'  && to === 'active') return 'reactivated';
    return `transition_${from}_to_${to}`;
  }

  // ────────────────────────────────────────────────────────────
  // CONTEXT (used by JwtAuthGuard + /auth/me)
  // ────────────────────────────────────────────────────────────

  /**
   * Build the SubscriptionContext attached to every authenticated request.
   * Cached per studio_id for CACHE_TTL_MS to keep guard overhead minimal.
   */
  async getContext(studioId: string): Promise<SubscriptionContext> {
    const cached = this.contextCache.get(studioId);
    if (cached && cached.expires > Date.now()) {
      return cached.context;
    }

    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: {
        subscription_plan: true,
        billing_cycle: true,
        next_billing_date: true,
        trial_ends_at: true,
        lifecycle_status: true,
        grace_until: true,
        locked_at: true,
        suspended_at: true,
      },
    });

    if (!studio) {
      // Defensive default — treat unknown as active to avoid breaking
      // newly-onboarding users. Cron will correct on next pass.
      const fallback: SubscriptionContext = {
        status: 'active',
        plan: 'free',
        billing_cycle: 'monthly',
        expires_at: null,
        grace_until: null,
        locked_at: null,
        days_until_expiry: null,
        grace_days_remaining: null,
        can_mutate: true,
      };
      return fallback;
    }

    const graceDays = await this.getGraceDays(studio.subscription_plan);
    const computed = this.computeStatus(studio, graceDays);

    const context: SubscriptionContext = {
      status: computed.status,
      plan: studio.subscription_plan,
      billing_cycle: studio.billing_cycle,
      expires_at: studio.next_billing_date?.toISOString() ?? null,
      grace_until: computed.grace_until?.toISOString() ?? null,
      locked_at: computed.locked_at?.toISOString() ?? null,
      days_until_expiry: computed.days_until_expiry,
      grace_days_remaining: computed.grace_days_remaining,
      can_mutate: computed.status === 'active',
    };

    this.contextCache.set(studioId, {
      expires: Date.now() + SubscriptionPolicyService.CACHE_TTL_MS,
      context,
    });

    return context;
  }

  invalidateCache(studioId: string): void {
    this.contextCache.delete(studioId);
  }

  // ────────────────────────────────────────────────────────────
  // CONTINUITY LOGIC — strict (per founder decision)
  // ────────────────────────────────────────────────────────────

  /**
   * Compute the next billing period's [start, end] given the *prior*
   * expiry and billing cycle. Customer who pays late LOSES the gap days
   * — new period starts from previous expiry, not from payment date.
   *
   * Edge cases:
   *  - prior_expiry is null (first payment ever) → start from `now`
   *  - billing_cycle is annual → +365 days; monthly → +30 days;
   *    quarterly (future) → +90 days
   */
  computeNextPeriod(
    priorExpiry: Date | null,
    billingCycle: string,
    now: Date = new Date(),
  ): { period_start: Date; period_end: Date } {
    const days =
      billingCycle === 'annual'
        ? 365
        : billingCycle === 'quarterly'
          ? 90
          : 30;

    // First payment ever or no prior — start from now.
    const start = priorExpiry ?? now;
    const end = new Date(start.getTime() + days * DAY_MS);

    return { period_start: start, period_end: end };
  }

  /**
   * Record a successful renewal: extend next_billing_date using strict
   * continuity, transition lifecycle_status back to ACTIVE, append events.
   *
   * Wrapped in a single transaction so the ledger and studio row move
   * together.
   */
  async recordRenewal(params: {
    studio_id: string;
    actor_id?: string;
    actor_type?: 'user' | 'webhook' | 'admin' | 'system';
    amount?: number;
    currency?: string;
    metadata?: Record<string, unknown>;
    now?: Date;
    /**
     * Optional plan switch. If provided AND different from current, the studio's
     * subscription_plan is updated atomically with this renewal, and a
     * `plan_changed` event is appended to the ledger. The new period is
     * computed using the NEW billing_cycle if also provided.
     *
     * Continuity rule still applies: period_start = prior next_billing_date.
     * The customer doesn't get "fresh days" by switching plans.
     */
    new_plan?: string;
    new_billing_cycle?: string;
  }): Promise<{
    period_start: Date;
    period_end: Date;
    previous_status: SubscriptionLifecycleStatus;
    invoice_number: string;
    invoice_id: string;
    plan_changed: boolean;
    plan: string;
    billing_cycle: string;
    slug: string;
  }> {
    const now = params.now ?? new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const studio = await tx.studio.findUnique({
        where: { id: params.studio_id },
        select: {
          id: true,
          slug: true,
          subscription_plan: true,
          billing_cycle: true,
          next_billing_date: true,
          trial_ends_at: true,
          lifecycle_status: true,
        },
      });
      if (!studio) throw new Error(`Studio ${params.studio_id} not found`);

      // Resolve target plan + billing cycle (defaults to current).
      const targetPlan = params.new_plan ?? studio.subscription_plan;
      const targetCycle = params.new_billing_cycle ?? studio.billing_cycle;
      const planChanged = targetPlan !== studio.subscription_plan;
      const cycleChanged = targetCycle !== studio.billing_cycle;

      const { period_start, period_end } = this.computeNextPeriod(
        studio.next_billing_date,
        targetCycle,
        now,
      );

      const previous = studio.lifecycle_status as SubscriptionLifecycleStatus;

      // Clear stale trial_ends_at — once they pay, the trial concept is over.
      // Keep it only if the trial is genuinely still in the future.
      const clearTrial =
        studio.trial_ends_at && studio.trial_ends_at.getTime() < now.getTime();

      await tx.studio.update({
        where: { id: studio.id },
        data: {
          subscription_plan: targetPlan,
          billing_cycle: targetCycle,
          next_billing_date: period_end,
          subscription_start: studio.next_billing_date ?? period_start,
          subscription_status: 'active',
          lifecycle_status: 'active',
          grace_until: null,
          locked_at: null,
          last_status_computed_at: now,
          ...(clearTrial ? { trial_ends_at: null } : {}),
        },
      });

      // Plan/cycle change event — emitted BEFORE payment + renewal events so
      // the ledger reads chronologically as: "plan changed → paid → renewed".
      if (planChanged || cycleChanged) {
        await tx.subscriptionEvent.create({
          data: {
            studio_id: studio.id,
            event_type: 'plan_changed',
            from_status: previous,
            to_status: 'active',
            plan_name: targetPlan,
            billing_cycle: targetCycle,
            actor_id: params.actor_id,
            actor_type: params.actor_type ?? 'user',
            metadata: {
              previous_plan: studio.subscription_plan,
              previous_billing_cycle: studio.billing_cycle,
              new_plan: targetPlan,
              new_billing_cycle: targetCycle,
            },
          },
        });
      }

      // Create a real Invoice row — durable billing artifact the user can see
      // on /settings/invoices and export.
      const invoice_number = await this.generateInvoiceNumber(tx, now);
      const invoice = await tx.invoice.create({
        data: {
          studio_id: studio.id,
          invoice_number,
          amount: (params.amount ?? 0) as unknown as any, // Prisma Decimal accepts number/string
          currency: params.currency ?? 'INR',
          status: 'paid',
          billing_period_start: period_start,
          billing_period_end: period_end,
          paid_at: now,
        },
        select: { id: true, invoice_number: true },
      });

      // Two events: payment_recorded (financial) + renewed (lifecycle).
      // Audit trail makes the cause and effect both queryable.
      await tx.subscriptionEvent.create({
        data: {
          studio_id: studio.id,
          event_type: 'payment_recorded',
          plan_name: targetPlan,
          billing_cycle: targetCycle,
          amount: (params.amount ?? 0) as unknown as any,
          currency: params.currency ?? 'INR',
          period_start,
          period_end,
          actor_id: params.actor_id,
          actor_type: params.actor_type ?? 'user',
          metadata: {
            ...(params.metadata ?? {}),
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
          },
        },
      });

      await tx.subscriptionEvent.create({
        data: {
          studio_id: studio.id,
          event_type: 'renewed',
          from_status: previous,
          to_status: 'active',
          plan_name: targetPlan,
          billing_cycle: targetCycle,
          period_start,
          period_end,
          actor_id: params.actor_id,
          actor_type: params.actor_type ?? 'user',
          metadata: {
            ...(params.metadata ?? {}),
            continuity_mode: 'strict',
            prior_expiry: studio.next_billing_date?.toISOString() ?? null,
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            trial_cleared: clearTrial ?? false,
            plan_changed: planChanged,
            ...(planChanged ? { previous_plan: studio.subscription_plan } : {}),
          },
        },
      });

      this.invalidateCache(studio.id);
      return {
        period_start,
        period_end,
        previous_status: previous,
        invoice_number: invoice.invoice_number,
        invoice_id: invoice.id,
        plan_changed: planChanged,
        plan: targetPlan,
        billing_cycle: targetCycle,
        slug: studio.slug,
      };
    });

    // Mirror this SaaS billing invoice into the Control Center (scc.payments)
    // so the SCC /billing page reflects EVERY paid renewal — not just the first
    // onboarding payment. This is the single chokepoint where invoices are
    // created, so syncing here covers onboarding, renewals, and plan-change
    // payments alike. Runs AFTER the transaction commits (never inside it) so a
    // rolled-back renewal never leaks a phantom payment into SCC. upsertPayment
    // is non-fatal — it swallows its own errors and never breaks billing.
    await this.sccSync.upsertPayment({
      id: result.invoice_id,
      studio_slug: result.slug,
      amount: params.amount ?? 0,
      currency: params.currency ?? 'INR',
      status: 'paid',
      invoice_number: result.invoice_number,
      paid_at: now,
    });

    return result;
  }

  /**
   * Generate INV-YYYYMMDD-XXXX, where XXXX is the next sequence for this day.
   * Uses a count + retry loop to handle the unique constraint on invoice_number
   * without taking a heavy lock — collisions are rare and bounded.
   */
  private async generateInvoiceNumber(
    tx: any,
    now: Date,
  ): Promise<string> {
    const datePart =
      now.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `INV-${datePart}-`;

    // Start the sequence from today's existing count.
    const todayCount = await tx.invoice.count({
      where: { invoice_number: { startsWith: prefix } },
    });

    for (let i = 0; i < 25; i++) {
      const candidate = `${prefix}${String(todayCount + 1 + i).padStart(4, '0')}`;
      const existing = await tx.invoice.findUnique({
        where: { invoice_number: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
    }
    // Vanishingly unlikely fallback: append random suffix
    return `${prefix}${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
  }
}
