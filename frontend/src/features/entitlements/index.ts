/**
 * Entitlements — central feature-gate system (audit Deliverable: central architecture).
 *
 * Plan-TIER gating (which modules a plan includes). Distinct from the billing-STATE lock
 * in features/subscription (paid vs unpaid). The two compose.
 *
 * Single import location for everything entitlement-related.
 */

export {
  EntitlementProvider,
  useEntitlements,
  useEntitlement,
  useUsageLimit,
} from './entitlement-provider';

export { FeatureGate } from './components/FeatureGate';
export { LockedFeatureCard } from './components/LockedFeatureCard';
export { UpgradeModal } from './components/UpgradeModal';
export { UpgradeButton } from './components/UpgradeButton';
export { PremiumTag } from './components/PremiumTag';
export { PremiumUpsellStrip } from './components/PremiumUpsellStrip';

export {
  FEATURE_REGISTRY,
  getFeatureMeta,
  PLAN_RANK,
  PLAN_DISPLAY_NAME,
} from './registry';
export type { FeatureKey, FeatureMeta, PlanName, PreviewKind } from './registry';

export {
  resolvePlan,
  featureState,
  isAvailable,
  requiredPlanFor,
  usageStatus,
} from './engine';
export type {
  AccountPayload,
  FeatureState,
  ResolvedPlan,
  UsageResource,
  UsageStatus,
} from './engine';

export { trackUpsell } from './analytics';
export type { UpsellEvent, UpsellEventPayload } from './analytics';
