import { FEATURE_REGISTRY, featureState, requiredPlanFor } from '../rbac/entitlements';

describe('entitlements', () => {
  it('unlocks everything at or below the current plan', () => {
    expect(featureState('class_scheduling', 'starter')).toBe('available');
    expect(featureState('manual_payments', 'free')).toBe('available');
    expect(featureState('ai_advisor', 'enterprise')).toBe('available');
  });

  it('locks features above the current plan', () => {
    expect(featureState('ai_advisor', 'free')).toBe('locked');
    expect(featureState('marketing_campaigns', 'starter')).toBe('locked');
  });

  it('treats a missing or unknown plan as free', () => {
    expect(featureState('class_scheduling', undefined)).toBe('locked');
    expect(featureState('member_management', 'nonsense')).toBe('available');
  });

  it('is case-insensitive about the plan name', () => {
    expect(featureState('class_scheduling', 'STARTER')).toBe('available');
  });

  it('treats an unknown feature as available, never locked', () => {
    // A typo must not silently hide working functionality behind a paywall.
    // @ts-expect-error deliberately invalid key
    expect(featureState('not_a_feature', 'free')).toBe('available');
  });

  it('matches the web registry plan tiers', () => {
    // These exact tiers drive upsell copy on both clients; drift means the
    // apps disagree about what a gym has paid for.
    expect(requiredPlanFor('check_in')).toBe('free');
    expect(requiredPlanFor('whatsapp_notifications')).toBe('starter');
    expect(requiredPlanFor('multi_branch')).toBe('pro');
    expect(Object.keys(FEATURE_REGISTRY)).toHaveLength(16);
  });
});
