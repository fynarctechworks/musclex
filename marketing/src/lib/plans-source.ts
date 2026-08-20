import {
  UNLIMITED_AT,
  plans as fallbackPlans,
  type FeatureFlag,
  type Plan,
  type PlanId,
} from './plans';

/**
 * Live plan catalogue, read from the SaaS Control Center.
 *
 * The SCC's Plans screen edits `public.subscription_plans`; this reads the same
 * rows, so a price or limit an admin changes there appears here on the next
 * revalidation. There is no second copy of pricing to keep in sync.
 *
 * SERVER ONLY: it uses the shared ingest secret, which must never reach the
 * browser. Guarded at runtime below rather than with the `server-only` package,
 * to avoid adding a dependency.
 *
 * If the SCC is unreachable, misconfigured, or returns something unusable, this
 * falls back to the hardcoded catalogue in `plans.ts`. A pricing page that
 * renders slightly stale prices is recoverable; one that renders an error or
 * nothing is not.
 */

// Hard stop if this is ever pulled into a client component: the module reads
// MARKETING_INGEST_SECRET, and bundling it would ship the secret to the browser.
if (typeof window !== 'undefined') {
  throw new Error('plans-source.ts is server-only and must not be imported by a client component.');
}

/** How long a fetched catalogue is reused before refetching, in seconds. */
const REVALIDATE_SECONDS = 300;

/** Shape returned by GET /plans/marketing on the SCC. */
interface SccPlan {
  name: string;
  display_name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  effective_monthly_price: number;
  effective_annual_price: number;
  is_discount_active: boolean;
  discount_label: string | null;
  max_branches: number;
  max_members: number;
  max_staff: number;
  storage_limit_gb: number;
  features: Record<string, boolean>;
  is_featured: boolean;
  sort_order: number;
}

export interface PlansResult {
  plans: Plan[];
  /** 'live' = from the SCC; 'fallback' = the built-in catalogue. */
  origin: 'live' | 'fallback';
}

/**
 * Presentation that belongs to marketing, not to the database: the CTA wording.
 * Keyed by plan name, with a sensible default so a plan added in the SCC still
 * renders correctly without a code change.
 */
const CTA_BY_NAME: Record<string, string> = {
  free: 'Get started free',
  enterprise: 'Contact sales',
};

function ctaFor(plan: SccPlan): string {
  return CTA_BY_NAME[plan.name] ?? (plan.effective_monthly_price === 0 ? 'Get started free' : 'Start free trial');
}

/**
 * "Unlimited" only at the field's own sentinel — members use 99999 while
 * branches/staff use 999, so a shared threshold would mislabel a large but
 * finite plan.
 */
function limitLabel(value: number, unlimitedAt: number, noun: string): string {
  return value >= unlimitedAt
    ? `Unlimited ${noun}`
    : `Up to ${value.toLocaleString('en-IN')} ${noun}`;
}

/**
 * Card bullets, derived from the plan's own limits and flags so a plan created
 * in the SCC gets meaningful highlights without anyone editing marketing copy.
 */
function highlightsFor(plan: SccPlan): string[] {
  const f = plan.features ?? {};
  const out: string[] = [limitLabel(plan.max_members, UNLIMITED_AT.members, 'members')];

  out.push(
    plan.max_branches >= UNLIMITED_AT.branches
      ? 'Unlimited branches'
      : `${plan.max_branches} branch${plan.max_branches === 1 ? '' : 'es'} · ${
          plan.max_staff >= UNLIMITED_AT.staff ? 'unlimited' : `up to ${plan.max_staff}`
        } staff`,
  );

  if (f.class_scheduling) out.push('Class scheduling & waitlists');
  if (f.payment_gateway) out.push('Online payments (Razorpay)');
  if (f.whatsapp_notifications) out.push('WhatsApp notifications');
  if (f.marketing_campaigns) out.push('Marketing campaigns & email');
  if (f.ai_advisor) out.push('AI business advisor');
  if (f.custom_roles || f.api_access) out.push('Custom roles & API access');
  if (!f.class_scheduling && !f.payment_gateway) out.push('Check-in & attendance');
  out.push(`${plan.storage_limit_gb} GB storage`);

  return out.slice(0, 6);
}

/** Every flag the comparison table renders, defaulted to false when absent. */
const ALL_FLAGS: FeatureFlag[] = [
  'member_management',
  'check_in',
  'manual_payments',
  'basic_reports',
  'staff_management',
  'trainer_management',
  'class_scheduling',
  'payment_gateway',
  'whatsapp_notifications',
  'audit_logs',
  'multi_branch',
  'marketing_campaigns',
  'email_campaigns',
  'ai_advisor',
  'custom_roles',
  'api_access',
];

function toMarketingPlan(p: SccPlan): Plan {
  const features = Object.fromEntries(
    ALL_FLAGS.map((flag) => [flag, Boolean(p.features?.[flag])]),
  ) as Record<FeatureFlag, boolean>;

  return {
    id: p.name as PlanId,
    name: p.display_name || p.name,
    description: p.description ?? '',
    // Effective prices, so an admin-set discount is what the visitor sees.
    monthlyPrice: Number(p.effective_monthly_price),
    annualPrice: Number(p.effective_annual_price),
    maxBranches: p.max_branches,
    maxMembers: p.max_members,
    maxStaff: p.max_staff,
    storageGb: p.storage_limit_gb,
    features,
    highlights: highlightsFor(p),
    cta: ctaFor(p),
    featured: p.is_featured,
  };
}

export async function getPlans(): Promise<PlansResult> {
  const base = process.env.SCC_API_URL?.replace(/\/$/, '');
  const secret = process.env.MARKETING_INGEST_SECRET;

  if (!base || !secret) {
    // Not an error: a preview deploy without SCC credentials should still
    // render correct-looking pricing.
    return { plans: fallbackPlans, origin: 'fallback' };
  }

  try {
    const res = await fetch(`${base}/plans/marketing`, {
      headers: { 'x-ingest-secret': secret },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.error(`[plans] SCC returned ${res.status}; using fallback catalogue.`);
      return { plans: fallbackPlans, origin: 'fallback' };
    }

    const body = (await res.json()) as { data?: SccPlan[] };
    const rows = body.data;

    if (!Array.isArray(rows) || rows.length === 0) {
      console.error('[plans] SCC returned no plans; using fallback catalogue.');
      return { plans: fallbackPlans, origin: 'fallback' };
    }

    return {
      plans: rows.sort((a, b) => a.sort_order - b.sort_order).map(toMarketingPlan),
      origin: 'live',
    };
  } catch (error) {
    console.error('[plans] SCC fetch failed:', (error as Error).name);
    return { plans: fallbackPlans, origin: 'fallback' };
  }
}
