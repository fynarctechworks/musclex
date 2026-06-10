/**
 * Referral System — Domain Events
 *
 * All business events that trigger reward evaluation or lifecycle transitions.
 * Emitted by other services, consumed by ReferralEventsListener.
 *
 * Event payloads carry everything needed for rule evaluation;
 * listeners must NOT make extra DB calls for context they could have received here.
 */

export const REFERRAL_EVENTS = {
  // ── B2B: SaaS-level (Studio → Studio) ────────────────────────────
  /**
   * Referred studio activated a paid plan (first payment recorded). Moves the
   * referral to `payment_verified` but does NOT credit the reward — under the
   * trial-completion model, rewards only credit after the referred gym sticks
   * around past trial. Without that gate, a fraud loop could pay during trial,
   * trigger the reward, then trial-cancel for a refund.
   */
  SUBSCRIPTION_ACTIVATED: 'referral.subscription.activated',
  SUBSCRIPTION_RENEWED:   'referral.subscription.renewed',
  PAYMENT_VERIFIED:       'referral.payment.verified',
  /**
   * Referred studio's trial period ended while still on a paid plan
   * (i.e. they didn't cancel during trial). This is the trigger that actually
   * credits the referrer's reward — emitted by the subscription cron once it
   * observes trial_ends_at has passed and lifecycle_status is `active`.
   */
  TRIAL_COMPLETED:        'referral.trial.completed',
  SUBSCRIPTION_REFUNDED:  'referral.subscription.refunded',
  LIFECYCLE_TRANSITIONED: 'referral.lifecycle.transitioned',

  // ── B2C: Per-gym (Member → Member) ───────────────────────────────
  MEMBER_REFERRAL_CODE_USED:          'member_referral.code.used',
  MEMBER_REFERRAL_REGISTERED:         'member_referral.registered',
  MEMBER_REFERRAL_PAYMENT_COMPLETED:  'member_referral.payment.completed',
  MEMBER_REFERRAL_MEMBERSHIP_ACTIVE:  'member_referral.membership.active',
  MEMBER_REFERRAL_CANCELLED:          'member_referral.cancelled',
} as const;

export type ReferralEventName =
  (typeof REFERRAL_EVENTS)[keyof typeof REFERRAL_EVENTS];

// =================================================================
// B2B EVENT PAYLOADS
// =================================================================

export interface SubscriptionActivatedPayload {
  studioId: string;
  planId: string;
  planName: string;
  billingCycle: 'monthly' | 'annual';
  amountPaid: number;
  currency: string;
  /** Invoice or payment id used as the idempotency anchor */
  idempotencyKey: string;
  activatedAt: Date;
  /** Optional fingerprint for fraud signal collection */
  fraudContext?: {
    ip?: string;
    deviceFingerprint?: string;
    userAgent?: string;
  };
}

export interface SubscriptionRenewedPayload extends SubscriptionActivatedPayload {
  renewalNumber: number;
}

export interface PaymentVerifiedPayload {
  studioId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  idempotencyKey: string;
  verifiedAt: Date;
}

/**
 * Emitted when a referred gym's trial period ends with them still on a paid
 * plan. Carries enough context for the rule engine to evaluate without an
 * extra studio lookup — mirrors the SUBSCRIPTION_ACTIVATED payload shape so
 * the existing reward pipeline can be reused unchanged.
 */
export interface TrialCompletedPayload {
  studioId: string;
  planId: string;
  planName: string;
  billingCycle: 'monthly' | 'annual';
  amountPaid: number;
  currency: string;
  /**
   * Idempotency anchor. For trial-completion we use the studio id + the trial
   * end date so re-running the cron on the same day can't double-credit.
   */
  idempotencyKey: string;
  trialEndedAt: Date;
}

export interface SubscriptionRefundedPayload {
  studioId: string;
  originalIdempotencyKey: string;
  refundReason: string;
  refundedAt: Date;
}

// =================================================================
// LIFECYCLE EVENT (audit trail)
// =================================================================

export interface LifecycleTransitionedPayload {
  scope: 'b2b' | 'b2c';
  referralId: string;
  gymId?: string;          // present for b2c
  fromStatus: string | null;
  toStatus: string;
  actorType: 'system' | 'admin' | 'webhook' | 'gym_owner' | 'member';
  actorId?: string;
  payload?: Record<string, unknown>;
}

// =================================================================
// B2C EVENT PAYLOADS
// =================================================================

export interface MemberReferralCodeUsedPayload {
  gymId: string;
  referrerMemberId: string;
  referredMemberCandidate: {
    phone?: string;
    email?: string;
    deviceFingerprint?: string;
  };
  /** Idempotency anchor — typically the registration session id */
  idempotencyKey: string;
  occurredAt: Date;
}

export interface MemberReferralRegisteredPayload {
  gymId: string;
  memberReferralId: string;
  referrerMemberId: string;
  referredMemberId: string;
  idempotencyKey: string;
  occurredAt: Date;
}

export interface MemberReferralPaymentCompletedPayload {
  gymId: string;
  memberReferralId: string;
  referrerMemberId: string;
  referredMemberId: string;
  membershipPlanId: string;
  amountPaid: number;
  currency: string;
  paymentId: string;
  idempotencyKey: string;
  occurredAt: Date;
}

export interface MemberReferralMembershipActivePayload {
  gymId: string;
  memberReferralId: string;
  referrerMemberId: string;
  referredMemberId: string;
  membershipId: string;
  idempotencyKey: string;
  occurredAt: Date;
}

export interface MemberReferralCancelledPayload {
  gymId: string;
  memberReferralId: string;
  reason: string;
  occurredAt: Date;
}
