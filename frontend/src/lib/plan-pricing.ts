/**
 * Mirror of backend `resolvePlanPrice` so UIs that show a plan price
 * surface the same number the user will actually be charged.
 *
 * Returns the per-branch override when `branchId` is provided and the
 * override exists + is valid; otherwise the plan's base price. Same
 * normalization rules as the backend: ignores non-finite values and
 * negative overrides, treats 0 as a valid free-tier price.
 *
 * When `branchId` is null/undefined we always return the base price —
 * appropriate for plan-table list views, comparison grids, and public
 * pricing pages that don't have a branch context yet.
 *
 * Accepts any structural plan-like shape (price + optional overrides)
 * so this works with both `@/types`'s MembershipPlan and the various
 * locally-defined interfaces scattered through pages.
 */
export interface PlanLike {
  price: number | string | { toString?: () => string } | null | undefined;
  branch_price_overrides?: unknown;
}

export function resolvePlanPrice(
  plan: PlanLike | null | undefined,
  branchId: string | null | undefined,
): number {
  if (!plan) return 0;

  if (branchId && plan.branch_price_overrides) {
    const overrides = plan.branch_price_overrides as Record<string, unknown>;
    if (typeof overrides === 'object' && !Array.isArray(overrides)) {
      const raw = overrides[branchId];
      const parsed = coerceNumber(raw);
      if (parsed !== null && parsed >= 0) return parsed;
    }
  }

  return coerceNumber(plan.price) ?? 0;
}

/**
 * Convenience for "from ₹X" displays — returns the minimum of the
 * base price and any branch overrides. Useful on landing pages and
 * comparison grids where we don't know which branch the visitor will
 * pick yet.
 */
export function planMinPrice(plan: PlanLike | null | undefined): number {
  if (!plan) return 0;
  const base = coerceNumber(plan.price) ?? 0;
  const overrides = plan.branch_price_overrides;
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return base;
  }
  let min = base;
  for (const v of Object.values(overrides as Record<string, unknown>)) {
    const n = coerceNumber(v);
    if (n !== null && n >= 0 && n < min) min = n;
  }
  return min;
}

/** Returns true if the plan has at least one per-branch override. */
export function planHasBranchPricing(
  plan: { branch_price_overrides?: unknown } | null | undefined,
): boolean {
  const o = plan?.branch_price_overrides;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  return Object.values(o as Record<string, unknown>).some((v) => {
    const n = coerceNumber(v);
    return n !== null && n >= 0;
  });
}

function coerceNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') return null;
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
