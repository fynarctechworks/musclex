import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { SubscriptionPolicyService } from '../common/services/subscription-policy.service';
import { SubscriptionGateway } from './subscription.gateway';
import { CronLockService } from '../common/services/cron-lock.service';
import { QueueService } from '../queue/queue.service';
import {
  REFERRAL_EVENTS,
  TrialCompletedPayload,
} from '../referrals/events/domain-events';

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_OFFSETS_DAYS = [7, 3, 1, 0] as const; // days before expiry

/**
 * Daily subscription lifecycle reconciliation.
 *
 * Runs at 02:00 UTC every day:
 *   1. Recomputes lifecycle_status for every studio (covers status drift,
 *      missed transitions, manual DB edits, clock skew).
 *   2. On transitions, ledger event already written by policy.recomputeForStudio;
 *      we additionally push a WS event and queue a notification.
 *   3. Queues reminder emails at T-7, T-3, T-1, T-0 (expiry day).
 *
 * Uses pg advisory lock so only one replica runs the work — same pattern as
 * MetricsAggregationJob.
 *
 * Idempotent: re-running on the same day does no extra work because the
 * policy.recomputeForStudio is idempotent and reminders use a dedup metadata
 * key in SubscriptionEvent.
 */
@Injectable()
export class SubscriptionCron {
  private readonly logger = new Logger(SubscriptionCron.name);

  constructor(
    private readonly pub: PublicPrismaService,
    private readonly policy: SubscriptionPolicyService,
    private readonly gateway: SubscriptionGateway,
    private readonly cronLock: CronLockService,
    private readonly queue: QueueService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Daily reconciliation — 02:00 UTC.
   * Production: change to a sensible local hour for the target market.
   */
  @Cron('0 2 * * *')
  async dailyReconcile(): Promise<void> {
    await this.cronLock.withLock('cron:subscription_reconcile', async () => {
      const now = new Date();
      this.logger.log(
        `Subscription reconciliation starting at ${now.toISOString()}`,
      );

      const studios = await this.pub.studio.findMany({
        select: { id: true, email: true, billing_email: true, name: true },
      });

      let transitioned = 0;
      let reminded = 0;

      for (const studio of studios) {
        try {
          // 1. Recompute lifecycle status
          const result = await this.policy.recomputeForStudio(studio.id, now);
          if (result.transitioned) {
            transitioned++;
            // Push WS event so any open admin tab updates instantly
            const subscription = await this.policy.getContext(studio.id);
            this.gateway.pushStatusChange(studio.id, {
              previous_status: result.previous,
              subscription,
              reason: 'cron_recompute',
            });

            // Queue notification on entering grace / locked / suspended
            await this.queueLifecycleNotification(
              studio,
              result.computed.status,
            );
          }

          // 2. Send pre-expiry reminders (T-7, T-3, T-1, T-0)
          const sentReminder = await this.maybeSendReminder(studio, now);
          if (sentReminder) reminded++;

          // 3. Detect trial completion → fire the referral reward event.
          // Only credits the referrer's reward if the referred gym made it
          // past their trial without cancelling. Idempotency lives on the
          // referral row (idempotency_key) so re-running the cron is safe.
          await this.maybeEmitTrialCompleted(studio.id, now);
        } catch (err) {
          this.logger.error(
            `Reconcile failed for studio ${studio.id}: ${
              (err as Error).message
            }`,
          );
        }
      }

      this.logger.log(
        `Subscription reconciliation done. studios=${studios.length} ` +
          `transitioned=${transitioned} reminders=${reminded}`,
      );
    });
  }

  /**
   * Hourly heartbeat — push the current subscription context to every
   * connected client. Cheap (no DB transitions), self-healing if a WS
   * dropped earlier in the day.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async heartbeatPush(): Promise<void> {
    await this.cronLock.withLock(
      'cron:subscription_heartbeat',
      async () => {
        // Only push to studios with non-ACTIVE state — there's nothing to
        // urge an ACTIVE customer about.
        const studios = await this.pub.studio.findMany({
          where: { lifecycle_status: { not: 'active' } },
          select: { id: true },
        });
        for (const s of studios) {
          try {
            const context = await this.policy.getContext(s.id);
            this.gateway.pushHeartbeat(s.id, context);
          } catch {
            /* skip */
          }
        }
      },
    );
  }

  // ────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────

  /**
   * Fire REFERRAL_EVENTS.TRIAL_COMPLETED for a studio that just completed
   * its trial. Conditions:
   *   • trial_ends_at is set and is in the past
   *   • lifecycle_status is `active` (didn't cancel during trial)
   *   • we haven't already fired for this specific trial_ends_at
   *
   * Dedup uses a SubscriptionEvent row with type `trial_completed_emitted` —
   * the same pattern as reminder dedup. Idempotent across cron runs.
   */
  private async maybeEmitTrialCompleted(studioId: string, now: Date): Promise<void> {
    const studio = await this.pub.studio.findUnique({
      where: { id: studioId },
      select: {
        id: true,
        trial_ends_at: true,
        lifecycle_status: true,
        subscription_plan: true,
        billing_cycle: true,
        next_billing_date: true,
        currency: true,
      },
    });

    if (!studio) return;
    if (!studio.trial_ends_at) return;
    if (studio.trial_ends_at.getTime() > now.getTime()) return;     // trial still running
    if (studio.lifecycle_status !== 'active') return;               // cancelled / locked / suspended

    // Dedup — one emission per trial_ends_at value.
    const dedupKey = `trial_completed_${studio.trial_ends_at.toISOString().slice(0, 10)}`;
    const existing = await this.pub.subscriptionEvent.findFirst({
      where: {
        studio_id: studioId,
        event_type: 'trial_completed_emitted',
        metadata: { path: ['dedup_key'], equals: dedupKey },
      },
      select: { id: true },
    });
    if (existing) return;

    // Only fire if there's actually a pending referral to reward — skips
    // the noisy "no-op" event for non-referred studios.
    const referral = await this.pub.referral.findUnique({
      where: { referred_studio_id: studioId },
      select: { id: true, status: true },
    });
    if (!referral) return;
    if (['rewarded', 'fraud', 'reversed', 'expired'].includes(referral.status)) return;

    // Resolve the plan id for the rule engine. Best-effort — if the plan
    // can't be found we still emit with the plan name so listeners can decide.
    const plan = await this.pub.subscriptionPlan
      .findFirst({ where: { name: studio.subscription_plan, is_active: true }, select: { id: true, monthly_price: true, annual_price: true } })
      .catch(() => null);

    const billingCycle = (studio.billing_cycle as 'monthly' | 'annual') ?? 'monthly';
    const amountPaid = plan
      ? Number(billingCycle === 'annual' ? plan.annual_price : plan.monthly_price)
      : 0;

    const payload: TrialCompletedPayload = {
      studioId,
      planId:         plan?.id ?? studio.subscription_plan,
      planName:       studio.subscription_plan,
      billingCycle,
      amountPaid,
      currency:       studio.currency ?? 'INR',
      idempotencyKey: `trial_${studioId}_${studio.trial_ends_at.toISOString()}`,
      trialEndedAt:   studio.trial_ends_at,
    };

    this.eventEmitter.emit(REFERRAL_EVENTS.TRIAL_COMPLETED, payload);

    // Stamp the dedup so we don't re-fire on the next cron pass.
    await this.pub.subscriptionEvent.create({
      data: {
        studio_id: studioId,
        event_type: 'trial_completed_emitted',
        actor_type: 'system',
        metadata: {
          dedup_key: dedupKey,
          trial_ended_at: studio.trial_ends_at.toISOString(),
          referral_id: referral.id,
        },
      },
    });

    this.logger.log(
      `TRIAL_COMPLETED emitted for studio ${studioId} (referral ${referral.id})`,
    );
  }

  private async maybeSendReminder(
    studio: { id: string; email: string | null; billing_email: string | null; name: string },
    now: Date,
  ): Promise<boolean> {
    const s = await this.pub.studio.findUnique({
      where: { id: studio.id },
      select: { next_billing_date: true, lifecycle_status: true },
    });
    if (!s?.next_billing_date) return false;
    if (s.lifecycle_status === 'locked' || s.lifecycle_status === 'suspended') {
      return false; // separate lifecycle event already notified
    }

    const daysUntil = Math.ceil(
      (s.next_billing_date.getTime() - now.getTime()) / DAY_MS,
    );

    if (!REMINDER_OFFSETS_DAYS.includes(daysUntil as any)) return false;

    // Dedup: have we already sent THIS reminder offset for THIS billing cycle?
    const dedupKey = `expiry_reminder_${daysUntil}d_${s.next_billing_date
      .toISOString()
      .slice(0, 10)}`;
    const existing = await this.pub.subscriptionEvent.findFirst({
      where: {
        studio_id: studio.id,
        event_type: 'reminder_sent',
        metadata: { path: ['dedup_key'], equals: dedupKey },
      },
      select: { id: true },
    });
    if (existing) return false;

    const recipient = studio.billing_email || studio.email;
    if (recipient) {
      await this.queue
        .enqueueEmail({
          to: recipient,
          subject:
            daysUntil <= 0
              ? `Your ${studio.name} subscription expires today`
              : `Your ${studio.name} subscription expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          template: this.reminderTemplate(daysUntil),
          variables: {
            studio_name: studio.name,
            days_until_expiry: String(daysUntil),
            expiry_date: s.next_billing_date.toISOString().slice(0, 10),
          },
        })
        .catch((err: Error) => {
          this.logger.warn(`Reminder email failed: ${err.message}`);
        });
    }

    await this.pub.subscriptionEvent.create({
      data: {
        studio_id: studio.id,
        event_type: 'reminder_sent',
        actor_type: 'system',
        metadata: {
          dedup_key: dedupKey,
          channel: 'email',
          days_until_expiry: daysUntil,
          recipient,
        },
      },
    });

    return true;
  }

  private async queueLifecycleNotification(
    studio: { id: string; email: string | null; billing_email: string | null; name: string },
    status: 'active' | 'grace_period' | 'locked' | 'suspended',
  ): Promise<void> {
    if (status === 'active') return; // unlock notification handled by renewal flow

    const recipient = studio.billing_email || studio.email;
    if (!recipient) return;

    const subject =
      status === 'grace_period'
        ? `${studio.name}: your subscription has expired — grace period started`
        : status === 'locked'
          ? `${studio.name}: your account is now locked`
          : `${studio.name}: account suspended`;

    await this.queue
      .enqueueEmail({
        to: recipient,
        subject,
        template: this.lifecycleTemplate(status),
        variables: {
          studio_name: studio.name,
          status,
        },
      })
      .catch((err: Error) => {
        this.logger.warn(`Lifecycle email failed: ${err.message}`);
      });
  }

  private reminderTemplate(daysUntil: number): string {
    const headline =
      daysUntil <= 0
        ? 'Your subscription expires today'
        : `Your subscription expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
    return `
      <div style="max-width:560px;margin:0 auto;font-family:'Inter',Arial,sans-serif;padding:32px;">
        <h1 style="font-size:22px;color:#1a1a1a;margin:0 0 16px;">${headline}</h1>
        <p style="font-size:14px;color:#333;margin:0 0 16px;">
          Hi {{ studio_name }} team — your subscription expires on {{ expiry_date }}.
          Renew now to avoid interruption to your gym operations.
        </p>
        <p style="font-size:13px;color:#666;">
          After expiry, you enter a short grace period during which you can still
          use the app. Once that ends, your account becomes read-only until renewal.
        </p>
      </div>
    `;
  }

  private lifecycleTemplate(status: string): string {
    if (status === 'grace_period') {
      return `
        <div style="max-width:560px;margin:0 auto;font-family:'Inter',Arial,sans-serif;padding:32px;">
          <h1 style="font-size:22px;color:#b45309;margin:0 0 16px;">Grace period started</h1>
          <p style="font-size:14px;color:#333;">
            Hi {{ studio_name }} team — your subscription has expired. You're now
            in a short grace period and can still add members, take payments, and
            run operations normally. Please renew to avoid your account becoming
            read-only.
          </p>
        </div>
      `;
    }
    if (status === 'locked') {
      return `
        <div style="max-width:560px;margin:0 auto;font-family:'Inter',Arial,sans-serif;padding:32px;">
          <h1 style="font-size:22px;color:#b91c1c;margin:0 0 16px;">Account locked</h1>
          <p style="font-size:14px;color:#333;">
            Hi {{ studio_name }} team — your grace period has ended. Your account
            is now read-only: you can still view members, reports, and history,
            but new writes are blocked until you renew.
          </p>
        </div>
      `;
    }
    return `
      <div style="max-width:560px;margin:0 auto;font-family:'Inter',Arial,sans-serif;padding:32px;">
        <h1 style="font-size:22px;color:#b91c1c;margin:0 0 16px;">Account suspended</h1>
        <p style="font-size:14px;color:#333;">
          Your account has been suspended by an administrator. Please contact support.
        </p>
      </div>
    `;
  }
}
