/**
 * Plan entitlements — mirrors frontend/src/features/entitlements/registry.ts.
 *
 * THE RULE THAT MUST NOT INVERT (from the web app's app-layout.tsx):
 *
 *   Role-based restriction  -> HIDE the item.
 *   Plan-based restriction  -> SHOW it LOCKED, with an upgrade path.
 *
 * A staffer must never see a module their role cannot access. But a gym on a
 * lower plan SHOULD see what it is missing — that locked item is the upsell.
 * Getting this backwards either leaks modules across roles or silently deletes
 * the revenue path.
 */

export type PlanName = 'free' | 'starter' | 'pro' | 'enterprise';

export const PLAN_RANK: Record<PlanName, number> = {
  free: 0, starter: 1, pro: 2, enterprise: 3,
};

export type FeatureKey =
  | 'member_management' | 'check_in' | 'manual_payments' | 'basic_reports'
  | 'staff_management' | 'trainer_management' | 'class_scheduling'
  | 'payment_gateway' | 'multi_branch' | 'marketing_campaigns' | 'ai_advisor'
  | 'whatsapp_notifications' | 'email_campaigns' | 'custom_roles'
  | 'audit_logs' | 'api_access';

export type FeatureMeta = { name: string; requiredPlan: PlanName };

/** Copy is intentionally short here — the web registry owns the marketing text. */
export const FEATURE_REGISTRY: Record<FeatureKey, FeatureMeta> = {
  member_management:      { name: 'Member Management',      requiredPlan: 'free' },
  check_in:               { name: 'Check-ins',              requiredPlan: 'free' },
  manual_payments:        { name: 'Payments',               requiredPlan: 'free' },
  basic_reports:          { name: 'Reports',                requiredPlan: 'free' },
  staff_management:       { name: 'Staff Management',       requiredPlan: 'free' },
  trainer_management:     { name: 'Trainer Management',     requiredPlan: 'free' },
  class_scheduling:       { name: 'Class Scheduling',       requiredPlan: 'starter' },
  payment_gateway:        { name: 'Online Payments',        requiredPlan: 'starter' },
  whatsapp_notifications: { name: 'WhatsApp Notifications', requiredPlan: 'starter' },
  audit_logs:             { name: 'Audit Logs',             requiredPlan: 'starter' },
  multi_branch:           { name: 'Multi-Branch',           requiredPlan: 'pro' },
  marketing_campaigns:    { name: 'Marketing',              requiredPlan: 'pro' },
  ai_advisor:             { name: 'AI Advisor',             requiredPlan: 'pro' },
  email_campaigns:        { name: 'Email Campaigns',        requiredPlan: 'pro' },
  custom_roles:           { name: 'Custom Roles',           requiredPlan: 'pro' },
  api_access:             { name: 'API Access',             requiredPlan: 'pro' },
};

export type EntitlementState = 'available' | 'locked';

function normalisePlan(plan: string | undefined | null): PlanName {
  const p = (plan ?? 'free').toLowerCase();
  return (p in PLAN_RANK ? p : 'free') as PlanName;
}

export function featureState(feature: FeatureKey, plan: string | undefined | null): EntitlementState {
  const meta = FEATURE_REGISTRY[feature];
  // Unknown feature keys are treated as available rather than locked: a typo
  // must not silently hide working functionality behind a paywall.
  if (!meta) return 'available';
  return PLAN_RANK[normalisePlan(plan)] >= PLAN_RANK[meta.requiredPlan] ? 'available' : 'locked';
}

export function requiredPlanFor(feature: FeatureKey): PlanName | null {
  return FEATURE_REGISTRY[feature]?.requiredPlan ?? null;
}
