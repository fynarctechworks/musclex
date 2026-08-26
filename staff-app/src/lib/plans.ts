import type { MembershipPlan } from '@/api/types';

/**
 * How long a plan runs, said the way a gym says it.
 *
 * The API stores `duration_days` OR `duration_months` and a given plan carries
 * one or the other, so both have to be handled. Days are converted where they
 * land on a clean month or year, because "365 days" is not how anyone sells an
 * annual membership.
 */
export function describeDuration(plan: MembershipPlan): string {
  const months = plan.duration_months ?? null;
  if (months) return months === 12 ? '1 year' : `${months} month${months === 1 ? '' : 's'}`;

  const days = plan.duration_days ?? null;
  if (!days) return '—';

  if (days === 365 || days === 366) return '1 year';
  if (days % 365 === 0) return `${days / 365} years`;
  // 30-day months are the convention these plans are written in.
  if (days % 30 === 0) {
    const m = days / 30;
    return m === 12 ? '1 year' : `${m} month${m === 1 ? '' : 's'}`;
  }
  if (days === 7) return '1 week';
  if (days % 7 === 0) return `${days / 7} weeks`;
  return `${days} day${days === 1 ? '' : 's'}`;
}

/**
 * Price per month, so plans of different lengths can be compared.
 *
 * This is the number a member actually asks for ("so how much a month?") and
 * the one a desk needs to answer whether the annual plan is worth it. Returns
 * null when the duration is unknown — an invented monthly price is worse than
 * none.
 */
export function monthlyEquivalent(plan: MembershipPlan): number | null {
  const price = Number(plan.price);
  if (!Number.isFinite(price) || price <= 0) return null;

  const months =
    plan.duration_months ??
    (plan.duration_days ? plan.duration_days / 30 : null);

  if (!months || months <= 0) return null;
  return price / months;
}
