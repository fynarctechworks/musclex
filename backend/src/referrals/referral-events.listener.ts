import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ReferralsService } from './referrals.service';
import {
  REFERRAL_EVENTS,
  SubscriptionActivatedPayload,
} from './events/domain-events';

/**
 * Listens for domain events and delegates to the referral reward pipeline.
 * This is the ONLY entry point into reward processing from external services.
 * Services like AuthService and BillingService just emit events — they are
 * completely decoupled from the referral system.
 */
@Injectable()
export class ReferralEventsListener {
  private readonly logger = new Logger(ReferralEventsListener.name);

  constructor(private readonly referralsService: ReferralsService) {}

  @OnEvent(REFERRAL_EVENTS.SUBSCRIPTION_ACTIVATED, { async: true })
  async onSubscriptionActivated(payload: SubscriptionActivatedPayload): Promise<void> {
    this.logger.log(
      `Event received: ${REFERRAL_EVENTS.SUBSCRIPTION_ACTIVATED} ` +
      `[studio=${payload.studioId}, plan=${payload.planId}, key=${payload.idempotencyKey}]`,
    );

    try {
      await this.referralsService.handleSubscriptionActivated(payload);
    } catch (err) {
      // Never let event handler errors crash the caller.
      // BullMQ retry handles re-delivery if Redis is enabled.
      this.logger.error(
        `Failed to process referral reward for studio ${payload.studioId}: ${err.message}`,
        err.stack,
      );
    }
  }

  @OnEvent(REFERRAL_EVENTS.SUBSCRIPTION_RENEWED, { async: true })
  async onSubscriptionRenewed(payload: SubscriptionActivatedPayload): Promise<void> {
    this.logger.log(
      `Event received: ${REFERRAL_EVENTS.SUBSCRIPTION_RENEWED} [studio=${payload.studioId}]`,
    );
    // Hook for renewal-based reward rules (e.g. reward referrer on each renewal)
    // Currently referrals are rewarded only once (first activation).
    // Extend here to add multi-renewal reward tiers.
  }
}
