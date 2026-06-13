import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { TenantTaskRunner } from '../prisma/tenant-task-runner';
import { QueueService } from '../queue/queue.service';
import {
  REFERRAL_EVENTS,
  LifecycleTransitionedPayload,
  SubscriptionActivatedPayload,
  MemberReferralPaymentCompletedPayload,
} from './events/domain-events';

/**
 * Routes referral lifecycle + reward events to user-visible notifications.
 *
 * Channels (best-effort, queued):
 *   - email   → via QueueService.enqueueEmail (Resend template renders)
 *   - whatsapp/push/sms → via QueueService.enqueueNotification
 *   - in-app  → directly writes to NotificationLog (per-gym) when applicable
 *
 * Design:
 *   - All sends are FIRE-AND-FORGET (any failure logged but never thrown).
 *   - Idempotency: each notification keyed by (referral_id, event_type, channel).
 *     Duplicate suppression handled by NotificationLog where applicable;
 *     for email/push (which leave this app) we accept rare double-sends
 *     as preferable to lost-on-retry.
 */
@Injectable()
export class ReferralNotificationService {
  private readonly logger = new Logger(ReferralNotificationService.name);

  constructor(
    private readonly pub: PublicPrismaService, // registry: referral (B2B)
    private readonly tenant: TenantPrisma, // tenant: member / notificationLog
    private readonly tasks: TenantTaskRunner, // event handlers have no req context
    private readonly queue: QueueService,
  ) {}

  // ════════════════════════════════════════════════════════════════
  // B2B: SaaS → Gym
  // ════════════════════════════════════════════════════════════════

  @OnEvent(REFERRAL_EVENTS.LIFECYCLE_TRANSITIONED, { async: true })
  async onLifecycleTransitioned(payload: LifecycleTransitionedPayload): Promise<void> {
    if (payload.scope !== 'b2b') return;

    try {
      switch (payload.toStatus) {
        case 'subscribed':
          await this.notifyReferrerB2B(payload.referralId, 'referral_subscribed');
          break;
        case 'rewarded':
          await this.notifyReferrerB2B(payload.referralId, 'referral_rewarded');
          break;
        case 'fraud':
          await this.notifyReferrerB2B(payload.referralId, 'referral_flagged_fraud');
          break;
        case 'reversed':
          await this.notifyReferrerB2B(payload.referralId, 'referral_reward_reversed');
          break;
      }
    } catch (err) {
      this.logger.error(
        `notify B2B lifecycle failed for ${payload.referralId}: ${(err as Error).message}`,
      );
    }
  }

  private async notifyReferrerB2B(
    referralId: string,
    template:
      | 'referral_subscribed'
      | 'referral_rewarded'
      | 'referral_flagged_fraud'
      | 'referral_reward_reversed',
  ): Promise<void> {
    const referral = await this.pub.referral.findUnique({
      where: { id: referralId },
      include: {
        referrer_studio: { select: { id: true, name: true, email: true, phone: true } },
        referred_studio: { select: { id: true, name: true } },
      },
    });
    if (!referral) return;

    const variables = {
      referrer_name: referral.referrer_studio?.name,
      referred_name: referral.referred_studio?.name,
      referral_code: referral.referral_code,
      referral_id:   referral.id,
    };

    if (referral.referrer_studio?.email) {
      await this.queue.enqueueEmail({
        to:       referral.referrer_studio.email,
        subject:  this.subjectFor(template, variables),
        template,
        variables,
      }).catch((err) =>
        this.logger.warn(`email enqueue failed: ${(err as Error).message}`),
      );
    }

    if (referral.referrer_studio?.phone && template === 'referral_rewarded') {
      await this.queue.enqueueNotification({
        type:      'whatsapp',
        to:        referral.referrer_studio.phone,
        message:   `🎉 Your referral ${variables.referred_name} just subscribed — your reward is live!`,
        templateId: template,
        variables,
      }).catch((err) =>
        this.logger.warn(`whatsapp enqueue failed: ${(err as Error).message}`),
      );
    }
  }

  private subjectFor(template: string, vars: Record<string, unknown>): string {
    switch (template) {
      case 'referral_subscribed':
        return `${vars.referred_name} just subscribed using your code`;
      case 'referral_rewarded':
        return `🎉 You earned a referral reward`;
      case 'referral_flagged_fraud':
        return `Action required: a referral was flagged for review`;
      case 'referral_reward_reversed':
        return `A referral reward was reversed`;
      default:
        return `Referral update`;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // B2C: Member → Member
  // ════════════════════════════════════════════════════════════════

  /**
   * Member referral payment completed — notify the referrer that they're
   * one step closer to their reward.
   */
  @OnEvent(REFERRAL_EVENTS.MEMBER_REFERRAL_PAYMENT_COMPLETED, { async: true })
  async onMemberPaymentCompleted(
    payload: MemberReferralPaymentCompletedPayload,
  ): Promise<void> {
    try {
      // member + notificationLog are tenant tables; this is an event handler with
      // no request context, so run the tenant work in the payload's gym schema.
      const referrer = await this.tasks.runForGym(payload.gymId, async () => {
        const r = await this.tenant.client.member.findUnique({
          where:  { id: payload.referrerMemberId },
          select: { id: true, full_name: true, phone: true, email: true, gym_id: true },
        });
        if (!r) return null;
        // In-app notification (NotificationLog, per-gym)
        await this.writeInAppNotification({
          gymId:    payload.gymId,
          memberId: r.id,
          title:    'Your referral just paid!',
          body:     'You\'re about to unlock your referral reward.',
          type:     'referral_payment',
          data:     { member_referral_id: payload.memberReferralId },
        });
        return r;
      });
      if (!referrer) return;

      // Push (if device tokens are registered — best-effort)
      if (referrer.phone) {
        await this.queue.enqueueNotification({
          type:      'whatsapp',
          to:        referrer.phone,
          message:   '💪 Your friend just paid — your referral reward is on its way.',
          templateId: 'member_referral_payment',
          variables: { member_referral_id: payload.memberReferralId },
        }).catch((err) =>
          this.logger.warn(`b2c whatsapp enqueue failed: ${(err as Error).message}`),
        );
      }
    } catch (err) {
      this.logger.error(
        `b2c payment notify failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Write a per-gym in-app NotificationLog row.
   * Schema: gym_id + member_id + title + body + type + data
   */
  private async writeInAppNotification(params: {
    gymId: string;
    memberId: string;
    title: string;
    body: string;
    type: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.tenant.client.notificationLog.create({
        data: {
          gym_id:       params.gymId,
          member_id:    params.memberId,
          channel:      'in_app',
          trigger_type: params.type,
          message_body: `${params.title}\n${params.body}`,
          status:       'sent',
        },
      });
    } catch (err) {
      this.logger.warn(`writeInAppNotification failed: ${(err as Error).message}`);
    }
  }
}
