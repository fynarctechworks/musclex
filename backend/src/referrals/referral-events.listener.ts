import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ReferralsService } from './referrals.service';
import { MemberReferralsService } from './member-referrals.service';
import {
  REFERRAL_EVENTS,
  SubscriptionActivatedPayload,
  SubscriptionRefundedPayload,
  TrialCompletedPayload,
  MemberReferralCodeUsedPayload,
  MemberReferralPaymentCompletedPayload,
  MemberReferralMembershipActivePayload,
  MemberReferralCancelledPayload,
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

  constructor(
    private readonly referralsService: ReferralsService,
    private readonly memberReferralsService: MemberReferralsService,
  ) {}

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

  @OnEvent(REFERRAL_EVENTS.TRIAL_COMPLETED, { async: true })
  async onTrialCompleted(payload: TrialCompletedPayload): Promise<void> {
    this.logger.log(
      `Event received: ${REFERRAL_EVENTS.TRIAL_COMPLETED} ` +
      `[studio=${payload.studioId}, trial_ended_at=${payload.trialEndedAt.toISOString()}]`,
    );

    try {
      await this.referralsService.handleTrialCompleted(payload);
    } catch (err) {
      this.logger.error(
        `Failed to credit trial-completion reward for studio ${payload.studioId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  @OnEvent(REFERRAL_EVENTS.SUBSCRIPTION_REFUNDED, { async: true })
  async onSubscriptionRefunded(payload: SubscriptionRefundedPayload): Promise<void> {
    this.logger.log(
      `Event received: ${REFERRAL_EVENTS.SUBSCRIPTION_REFUNDED} ` +
      `[studio=${payload.studioId}, reason="${payload.refundReason}"]`,
    );

    try {
      await this.referralsService.handleSubscriptionRefunded(payload);
    } catch (err) {
      this.logger.error(
        `Failed to claw back referral reward for studio ${payload.studioId}: ${(err as Error).message}`,
        (err as Error).stack,
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

  // ── B2C member-referral handlers ────────────────────────────────

  @OnEvent(REFERRAL_EVENTS.MEMBER_REFERRAL_CODE_USED, { async: true })
  async onMemberCodeUsed(payload: MemberReferralCodeUsedPayload): Promise<void> {
    try {
      await this.memberReferralsService.onCodeUsed(payload);
    } catch (err) {
      this.logger.error(`onMemberCodeUsed failed: ${(err as Error).message}`);
    }
  }

  @OnEvent(REFERRAL_EVENTS.MEMBER_REFERRAL_PAYMENT_COMPLETED, { async: true })
  async onMemberPaymentCompleted(payload: MemberReferralPaymentCompletedPayload): Promise<void> {
    try {
      await this.memberReferralsService.onPaymentCompleted(payload);
    } catch (err) {
      this.logger.error(`onMemberPaymentCompleted failed: ${(err as Error).message}`);
    }
  }

  @OnEvent(REFERRAL_EVENTS.MEMBER_REFERRAL_MEMBERSHIP_ACTIVE, { async: true })
  async onMemberMembershipActive(payload: MemberReferralMembershipActivePayload): Promise<void> {
    try {
      await this.memberReferralsService.onMembershipActive(payload);
    } catch (err) {
      this.logger.error(`onMemberMembershipActive failed: ${(err as Error).message}`);
    }
  }

  @OnEvent(REFERRAL_EVENTS.MEMBER_REFERRAL_CANCELLED, { async: true })
  async onMemberCancelled(payload: MemberReferralCancelledPayload): Promise<void> {
    try {
      await this.memberReferralsService.onCancelled(payload);
    } catch (err) {
      this.logger.error(`onMemberCancelled failed: ${(err as Error).message}`);
    }
  }
}
