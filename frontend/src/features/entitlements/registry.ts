/**
 * FEATURE REGISTRY — single source of truth for upgrade *metadata/copy*.
 *
 * IMPORTANT separation of concerns (see docs/subscription-visibility-audit/AUDIT_REPORT.md §8, R4):
 *   - This registry holds PRESENTATION data only: human name, why-it-matters, benefits,
 *     the plan that unlocks it, an icon, and how to preview it.
 *   - It NEVER decides access. Whether a tenant *has* a feature comes from the live
 *     `GET /settings/account` payload (`features: Record<featureKey, boolean>`), which is
 *     computed by the backend from the studio's plan. Client and server therefore agree
 *     because they read the same truth — the registry only describes the locked state.
 *
 * Feature keys mirror backend/src/common/plan-configs.ts → PLAN_CONFIGS[*].features.
 * Keep this list in sync with that file. Keys present here but absent there will simply
 * resolve to "available" (no flag → not gated), which is safe.
 */

export type PlanName = 'free' | 'starter' | 'pro' | 'enterprise';

/** All gateable feature keys. Mirrors the backend feature map. */
export type FeatureKey =
  | 'member_management'
  | 'check_in'
  | 'manual_payments'
  | 'basic_reports'
  | 'multi_branch'
  | 'staff_management'
  | 'trainer_management'
  | 'class_scheduling'
  | 'payment_gateway'
  | 'marketing_campaigns'
  | 'ai_advisor'
  | 'api_access'
  | 'whatsapp_notifications'
  | 'email_campaigns'
  | 'custom_roles'
  | 'audit_logs';

export type PreviewKind = 'none' | 'screenshots' | 'sample_data' | 'walkthrough';

export interface FeatureMeta {
  /** Human-facing feature name shown in nav/cards/modals. */
  name: string;
  /** One-line description of what it does. */
  description: string;
  /** Why it's valuable — used as the headline benefit in UpgradeModal. */
  why: string;
  /** The lowest plan that unlocks this feature (drives the "Available in …" copy). */
  requiredPlan: PlanName;
  /** Bullet benefits unlocked, shown in the upgrade modal. */
  benefits: string[];
  /** Lucide icon name (resolved by the consuming component) — kept as a string to avoid
   *  importing the icon library into this data module. */
  icon: string;
  /** Optional preview affordance (State 3 in the audit). 'none' = no preview offered. */
  previewKind: PreviewKind;
}

/**
 * Plan rank for "does plan X reach requiredPlan Y?" comparisons and for sorting.
 * Higher = more capable.
 */
export const PLAN_RANK: Record<PlanName, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export const PLAN_DISPLAY_NAME: Record<PlanName, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

/**
 * The registry. Copy here is marketing/presentation and is expected to evolve with design —
 * it intentionally lives in code (not the DB) so it ships with the UI and needs no migration.
 */
export const FEATURE_REGISTRY: Record<FeatureKey, FeatureMeta> = {
  member_management: {
    name: 'Member Management',
    description: 'Profiles, memberships, and member lifecycle.',
    why: 'The core of running your gym — included on every plan.',
    requiredPlan: 'free',
    benefits: ['Unlimited member profiles', 'Membership tracking', 'Member CRM'],
    icon: 'Users',
    previewKind: 'none',
  },
  check_in: {
    name: 'Check-ins',
    description: 'QR, biometric, and manual member check-in.',
    why: 'Verified attendance is the heartbeat of your gym.',
    requiredPlan: 'free',
    benefits: ['QR check-in', 'Face check-in', 'Visit history'],
    icon: 'UserCheck',
    previewKind: 'none',
  },
  manual_payments: {
    name: 'Payments',
    description: 'Record and track member payments.',
    why: 'Keep your books clean from day one.',
    requiredPlan: 'free',
    benefits: ['Manual payment entry', 'Invoices', 'Payment history'],
    icon: 'DollarSign',
    previewKind: 'none',
  },
  basic_reports: {
    name: 'Reports',
    description: 'Core operational reports.',
    why: 'Understand revenue, attendance, and growth at a glance.',
    requiredPlan: 'free',
    benefits: ['Revenue reports', 'Attendance reports', 'Export to CSV'],
    icon: 'BarChart3',
    previewKind: 'none',
  },
  staff_management: {
    name: 'Staff Management',
    description: 'Add staff, assign roles, manage access.',
    why: 'Delegate confidently with role-based access.',
    requiredPlan: 'free',
    benefits: ['Staff accounts', 'Role assignment', 'Branch assignment'],
    icon: 'UserCog',
    previewKind: 'none',
  },
  trainer_management: {
    name: 'Trainer Management',
    description: 'Manage trainers, clients, and sessions.',
    why: 'Match trainers to members and track their book.',
    requiredPlan: 'free',
    benefits: ['Trainer profiles', 'Client assignment', 'Session tracking'],
    icon: 'UserCog',
    previewKind: 'none',
  },
  class_scheduling: {
    name: 'Class Scheduling',
    description: 'Group classes, bookings, and a live schedule.',
    why: 'Fill classes and let members book the sessions they love.',
    requiredPlan: 'starter',
    benefits: [
      'Weekly class calendar',
      'Member self-booking',
      'Capacity & waitlist management',
      'Instructor assignment',
    ],
    icon: 'CalendarDays',
    previewKind: 'screenshots',
  },
  payment_gateway: {
    name: 'Online Payments',
    description: 'Collect payments online via a payment gateway.',
    why: 'Get paid faster with automated online collection.',
    requiredPlan: 'starter',
    benefits: ['Card & UPI collection', 'Automated receipts', 'Reconciliation'],
    icon: 'CreditCard',
    previewKind: 'screenshots',
  },
  multi_branch: {
    name: 'Multi-Branch',
    description: 'Run multiple locations from one account.',
    why: 'Scale to a chain without losing a single source of truth.',
    requiredPlan: 'pro',
    benefits: [
      'Unlimited branches',
      'Per-branch reporting',
      'Cross-branch member access',
      'Branch-level staff scoping',
    ],
    icon: 'Building2',
    previewKind: 'screenshots',
  },
  marketing_campaigns: {
    name: 'Marketing',
    description: 'Campaigns, referrals, and member outreach.',
    why: 'Turn members into a growth engine.',
    requiredPlan: 'pro',
    benefits: [
      'Campaign builder',
      'Referral program',
      'Segmented outreach',
      'Conversion tracking',
    ],
    icon: 'Megaphone',
    previewKind: 'screenshots',
  },
  ai_advisor: {
    name: 'AI Advisor',
    description: 'AI-powered insights and recommendations.',
    why: 'Get an analyst that never sleeps — churn risk, upsell, and ops insights.',
    requiredPlan: 'pro',
    benefits: [
      'Churn-risk detection',
      'Revenue insights',
      'Natural-language reporting',
      'Actionable recommendations',
    ],
    icon: 'Bot',
    previewKind: 'walkthrough',
  },
  whatsapp_notifications: {
    name: 'WhatsApp Notifications',
    description: 'Reach members where they already are.',
    why: 'WhatsApp messages get opened — reminders and renewals that land.',
    requiredPlan: 'starter',
    benefits: ['Renewal reminders', 'Class reminders', 'Broadcast messages'],
    icon: 'Megaphone',
    previewKind: 'screenshots',
  },
  email_campaigns: {
    name: 'Email Campaigns',
    description: 'Branded email campaigns to your members.',
    why: 'Nurture and re-engage members at scale.',
    requiredPlan: 'pro',
    benefits: ['Email builder', 'Segmentation', 'Open/click tracking'],
    icon: 'Megaphone',
    previewKind: 'screenshots',
  },
  custom_roles: {
    name: 'Custom Roles',
    description: 'Define granular permission sets.',
    why: 'Give every team member exactly the access they need — nothing more.',
    requiredPlan: 'pro',
    benefits: ['Custom permission sets', 'Per-module access', 'Least-privilege control'],
    icon: 'UserCog',
    previewKind: 'screenshots',
  },
  audit_logs: {
    name: 'Audit Logs',
    description: 'A tamper-evident record of every action.',
    why: 'Know who did what, when — essential for trust and compliance.',
    requiredPlan: 'starter',
    benefits: ['Full action history', 'Actor attribution', 'Exportable logs'],
    icon: 'Activity',
    previewKind: 'screenshots',
  },
  api_access: {
    name: 'API Access',
    description: 'Programmatic access to your gym data.',
    why: 'Integrate MuscleX with the rest of your stack.',
    requiredPlan: 'pro',
    benefits: ['REST API keys', 'Webhooks', 'Custom integrations'],
    icon: 'Activity',
    previewKind: 'walkthrough',
  },
};

/** Safe lookup — returns undefined for unknown keys so callers can no-op. */
export function getFeatureMeta(key: string): FeatureMeta | undefined {
  return (FEATURE_REGISTRY as Record<string, FeatureMeta>)[key];
}
