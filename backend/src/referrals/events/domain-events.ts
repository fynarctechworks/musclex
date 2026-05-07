/**
 * Referral System — Domain Events
 *
 * All business events that trigger reward evaluation.
 * Emitted by other services, consumed by ReferralEventsListener.
 * Event payloads carry everything needed for rule evaluation;
 * listeners must NOT make extra DB calls for context they could have received here.
 */

export const REFERRAL_EVENTS = {
  /** Emitted when a studio activates (or upgrades) its SaaS subscription plan */
  SUBSCRIPTION_ACTIVATED: 'referral.subscription.activated',
  /** Emitted when a studio renews a paid subscription (future: tiered renewal rewards) */
  SUBSCRIPTION_RENEWED: 'referral.subscription.renewed',
} as const;

export type ReferralEventName =
  (typeof REFERRAL_EVENTS)[keyof typeof REFERRAL_EVENTS];

// ── Event Payloads ────────────────────────────────────────────────

export interface SubscriptionActivatedPayload {
  /** The studio that just activated / upgraded */
  studioId: string;
  /** DB id of the SubscriptionPlan record */
  planId: string;
  /** Plan slug e.g. "pro", "ultra" — for logging only; rule engine uses planId */
  planName: string;
  billingCycle: 'monthly' | 'annual';
  /** Amount actually paid in the studio's currency */
  amountPaid: number;
  currency: string;
  /** Invoice or payment id used as idempotency anchor */
  idempotencyKey: string;
  activatedAt: Date;
}

export interface SubscriptionRenewedPayload extends SubscriptionActivatedPayload {
  renewalNumber: number; // 1 = first renewal, 2 = second, etc.
}
