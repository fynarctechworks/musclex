/**
 * EntitlementEngine + PlanResolver + UsageLimitEngine — pure, framework-free logic.
 *
 * The provider (entitlement-provider.tsx) supplies the live account payload; everything
 * here is a pure function of that payload so it's trivially testable and SSR-safe.
 *
 * Access truth = `account.features` (server-computed). The registry only adds copy.
 */

import {
  FeatureKey,
  PlanName,
  PLAN_RANK,
  getFeatureMeta,
} from './registry';

/** Subset of GET /settings/account that we depend on. */
export interface AccountPayload {
  subscription: { plan: string };
  features: Record<string, boolean>;
  usage: {
    branches: { current: number; max: number };
    members: { current: number; max: number };
    staff: { current: number; max: number };
    storage_limit_gb?: number;
    api_access?: boolean;
  };
}

export type FeatureState = 'available' | 'locked';

export interface ResolvedPlan {
  plan: PlanName;
  /** Raw plan string as returned by the server (may be a custom plan name). */
  rawPlan: string;
  features: Record<string, boolean>;
}

/** Coerce an arbitrary server plan string into a known PlanName, defaulting to 'free'. */
function normalizePlan(raw: string | undefined): PlanName {
  if (raw === 'starter' || raw === 'pro' || raw === 'enterprise' || raw === 'free') {
    return raw;
  }
  return 'free';
}

export function resolvePlan(account: AccountPayload | null | undefined): ResolvedPlan {
  const rawPlan = account?.subscription?.plan ?? 'free';
  return {
    plan: normalizePlan(rawPlan),
    rawPlan,
    features: account?.features ?? {},
  };
}

/**
 * The single access decision. A feature is `available` when the server's feature map
 * has it `true`. Anything else (false or absent-but-known-gateable) is `locked`.
 *
 * Unknown keys (not in the registry AND not in the feature map) resolve to `available`
 * so we never accidentally lock something that was never meant to be gated.
 */
export function featureState(
  account: AccountPayload | null | undefined,
  key: string,
): FeatureState {
  const features = account?.features ?? {};
  // Explicit grant.
  if (features[key] === true) return 'available';
  // Explicitly withheld by the plan.
  if (features[key] === false) return 'locked';
  // Not in the map: only treat as locked if the registry knows it's a gateable feature
  // AND it's not a free-tier-always feature. Otherwise default open.
  const meta = getFeatureMeta(key);
  if (meta && PLAN_RANK[meta.requiredPlan] > PLAN_RANK.free) return 'locked';
  return 'available';
}

export function isAvailable(
  account: AccountPayload | null | undefined,
  key: string,
): boolean {
  return featureState(account, key) === 'available';
}

/** The plan a user must reach to unlock `key`, from the registry (for upsell copy). */
export function requiredPlanFor(key: string): PlanName | null {
  return getFeatureMeta(key)?.requiredPlan ?? null;
}

// ── Usage limits ───────────────────────────────────────────────
export type UsageResource = 'members' | 'branches' | 'staff';

export interface UsageStatus {
  current: number;
  max: number;
  percent: number;
  atLimit: boolean;
  nearLimit: boolean; // ≥ 80%
}

export function usageStatus(
  account: AccountPayload | null | undefined,
  resource: UsageResource,
): UsageStatus | null {
  const u = account?.usage?.[resource];
  if (!u || typeof u.max !== 'number' || u.max <= 0) return null;
  const percent = Math.min(100, Math.round((u.current / u.max) * 100));
  return {
    current: u.current,
    max: u.max,
    percent,
    atLimit: u.current >= u.max,
    nearLimit: percent >= 80,
  };
}

export type { FeatureKey, PlanName };
