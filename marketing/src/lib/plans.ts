/**
 * Public pricing data.
 *
 * SOURCE OF TRUTH: `backend/src/common/plan-configs.ts` (PLAN_CONFIGS) — the
 * same prices, limits and feature flags the resource-limit service actually
 * enforces. There is no public pricing API to read them from yet (see
 * DEBT.md), so this file is a hand-mirror. If PLAN_CONFIGS changes, change
 * this too — a mismatch here is a pricing claim the product won't honour.
 *
 * Verified against plan-configs.ts on 2026-08-17.
 */

export type PlanId = 'free' | 'starter' | 'pro' | 'enterprise';

/** The 16 entitlement flags carried on every plan in PLAN_CONFIGS.features. */
export type FeatureFlag =
  | 'member_management'
  | 'check_in'
  | 'manual_payments'
  | 'basic_reports'
  | 'staff_management'
  | 'trainer_management'
  | 'class_scheduling'
  | 'payment_gateway'
  | 'whatsapp_notifications'
  | 'audit_logs'
  | 'multi_branch'
  | 'marketing_campaigns'
  | 'email_campaigns'
  | 'ai_advisor'
  | 'custom_roles'
  | 'api_access';

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  /** Rupees per month on the monthly cycle. */
  monthlyPrice: number;
  /** Rupees per year on the annual cycle. */
  annualPrice: number;
  maxBranches: number;
  maxMembers: number;
  maxStaff: number;
  storageGb: number;
  features: Record<FeatureFlag, boolean>;
  /** Headline bullets shown on the pricing card. */
  highlights: string[];
  cta: string;
  /** Highlighted tier — rendered with the accent glow and a "Popular" badge. */
  featured?: boolean;
}

export const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Basic gym management for a single location.',
    monthlyPrice: 0,
    annualPrice: 0,
    maxBranches: 1,
    maxMembers: 50,
    maxStaff: 3,
    storageGb: 1,
    features: {
      member_management: true,
      check_in: true,
      manual_payments: true,
      basic_reports: true,
      staff_management: true,
      trainer_management: true,
      class_scheduling: false,
      payment_gateway: false,
      whatsapp_notifications: false,
      audit_logs: false,
      multi_branch: false,
      marketing_campaigns: false,
      email_campaigns: false,
      ai_advisor: false,
      custom_roles: false,
      api_access: false,
    },
    highlights: [
      'Up to 50 members',
      '1 branch · up to 3 staff',
      'Check-in & attendance',
      'Manual payments & invoices',
      'Basic reports',
    ],
    cta: 'Get started free',
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'Growing gyms with staff and class management.',
    monthlyPrice: 999,
    annualPrice: 9990,
    maxBranches: 1,
    maxMembers: 200,
    maxStaff: 10,
    storageGb: 5,
    features: {
      member_management: true,
      check_in: true,
      manual_payments: true,
      basic_reports: true,
      staff_management: true,
      trainer_management: true,
      class_scheduling: true,
      payment_gateway: true,
      whatsapp_notifications: true,
      audit_logs: true,
      multi_branch: false,
      marketing_campaigns: false,
      email_campaigns: false,
      ai_advisor: false,
      custom_roles: false,
      api_access: false,
    },
    highlights: [
      'Up to 200 members',
      '1 branch · up to 10 staff',
      'Class scheduling & waitlists',
      'Online payments (Razorpay)',
      'WhatsApp notifications',
      'Audit logs',
    ],
    cta: 'Start free trial',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Multi-branch fitness chains with advanced features.',
    monthlyPrice: 2499,
    annualPrice: 24990,
    maxBranches: 5,
    maxMembers: 1000,
    maxStaff: 50,
    storageGb: 25,
    features: {
      member_management: true,
      check_in: true,
      manual_payments: true,
      basic_reports: true,
      staff_management: true,
      trainer_management: true,
      class_scheduling: true,
      payment_gateway: true,
      whatsapp_notifications: true,
      audit_logs: true,
      multi_branch: true,
      marketing_campaigns: true,
      email_campaigns: true,
      ai_advisor: true,
      custom_roles: true,
      api_access: true,
    },
    highlights: [
      'Up to 1,000 members',
      'Up to 5 branches · 50 staff',
      'Marketing campaigns & email',
      'AI business advisor',
      'Custom roles & API access',
      'Everything in Starter',
    ],
    cta: 'Start free trial',
    featured: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited scale for large fitness organizations.',
    monthlyPrice: 4999,
    annualPrice: 49990,
    maxBranches: 999,
    maxMembers: 99999,
    maxStaff: 999,
    storageGb: 100,
    features: {
      member_management: true,
      check_in: true,
      manual_payments: true,
      basic_reports: true,
      staff_management: true,
      trainer_management: true,
      class_scheduling: true,
      payment_gateway: true,
      whatsapp_notifications: true,
      audit_logs: true,
      multi_branch: true,
      marketing_campaigns: true,
      email_campaigns: true,
      ai_advisor: true,
      custom_roles: true,
      api_access: true,
    },
    highlights: [
      'Unlimited members & branches',
      '100 GB storage',
      'Full API access',
      'Priority support',
      'Everything in Pro',
    ],
    cta: 'Contact sales',
  },
];

/** Comparison-table rows, in the order they should render. */
export const featureLabels: { flag: FeatureFlag; label: string; group: string }[] = [
  { flag: 'member_management', label: 'Member management', group: 'Core' },
  { flag: 'check_in', label: 'Check-in & attendance', group: 'Core' },
  { flag: 'manual_payments', label: 'Manual payments & invoices', group: 'Core' },
  { flag: 'basic_reports', label: 'Reports', group: 'Core' },
  { flag: 'staff_management', label: 'Staff management', group: 'Core' },
  { flag: 'trainer_management', label: 'Trainer management', group: 'Core' },
  { flag: 'class_scheduling', label: 'Class scheduling', group: 'Operations' },
  { flag: 'payment_gateway', label: 'Online payment gateway', group: 'Operations' },
  { flag: 'whatsapp_notifications', label: 'WhatsApp notifications', group: 'Operations' },
  { flag: 'audit_logs', label: 'Audit logs', group: 'Operations' },
  { flag: 'multi_branch', label: 'Multi-branch', group: 'Scale' },
  { flag: 'marketing_campaigns', label: 'Marketing campaigns', group: 'Scale' },
  { flag: 'email_campaigns', label: 'Email campaigns', group: 'Scale' },
  { flag: 'ai_advisor', label: 'AI business advisor', group: 'Scale' },
  { flag: 'custom_roles', label: 'Custom roles & permissions', group: 'Scale' },
  { flag: 'api_access', label: 'API access', group: 'Scale' },
];

/** ₹1,23,456 — Indian digit grouping, matching the product's own formatting. */
export function formatRupees(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

/**
 * Sentinel values that mean "no practical ceiling". They differ per field:
 * PLAN_CONFIGS uses 999 for branches/staff but 99999 for members, so a blanket
 * `>= 999` check would render a legitimate 1,500-member plan as "Unlimited".
 */
export const UNLIMITED_AT = {
  members: 99999,
  branches: 999,
  staff: 999,
} as const;

/** Human limit label. Pass the sentinel for the field being formatted. */
export function formatLimit(value: number, unlimitedAt: number): string {
  return value >= unlimitedAt ? 'Unlimited' : value.toLocaleString('en-IN');
}

/**
 * Months saved by paying annually, e.g. Starter ₹9,990/yr vs ₹11,988 monthly.
 * Returns null for free tiers so the UI can skip the badge.
 */
export function annualSavingMonths(plan: Plan): number | null {
  if (plan.monthlyPrice === 0) return null;
  const saved = plan.monthlyPrice * 12 - plan.annualPrice;
  return Math.round(saved / plan.monthlyPrice);
}
