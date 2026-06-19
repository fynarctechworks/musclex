/**
 * Entitlement / upsell analytics events (audit Deliverable 11).
 *
 * Dependency-free + side-effect-light: each event is dispatched as a CustomEvent on
 * `window` AND forwarded to an optional global sink (`window.__musclexTrack`) if a host
 * page has installed one. With no sink installed this is effectively a no-op beyond the
 * DOM event, so it never pulls an analytics SDK into the bundle and is safe to call from
 * anywhere. Wire a real sink (PostHog/GA) later by assigning `window.__musclexTrack`.
 */

export type UpsellEvent =
  | 'feature_viewed'
  | 'locked_feature_opened'
  | 'upgrade_modal_opened'
  | 'upgrade_clicked'
  | 'trial_started'
  | 'feature_requested';

export interface UpsellEventPayload {
  feature?: string;
  current_plan?: string;
  required_plan?: string;
  source?: string;
  [k: string]: unknown;
}

declare global {
  interface Window {
    __musclexTrack?: (event: string, payload?: Record<string, unknown>) => void;
  }
}

export function trackUpsell(event: UpsellEvent, payload: UpsellEventPayload = {}): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(`upsell:${event}`, { detail: payload }),
    );
    window.__musclexTrack?.(`upsell_${event}`, payload);
  } catch {
    // Analytics must never break the UI.
  }
}
