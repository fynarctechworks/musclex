import { Decimal } from '@prisma/client/runtime/library';

/**
 * Branch-tier pricing (Phase 6).
 *
 * Plans may override their base `price` per-branch via the JSON column
 * `branch_price_overrides` (shape: `{ "<branch_id>": 1499.00 }`). This
 * helper returns the override when present and valid, otherwise the
 * plan's base price.
 *
 * Why a helper:
 *   - Single source of truth for the lookup (assign + renew + invoice).
 *   - Trivially unit-testable.
 *   - Strings, numbers, and stringified Decimals all coexist in JSONB —
 *     normalize once instead of at every call site.
 */
export function resolvePlanPrice(
  plan: {
    price: Decimal | number | string;
    branch_price_overrides?: unknown;
  },
  branchId: string,
): Decimal {
  const overrides = plan.branch_price_overrides;
  if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
    const raw = (overrides as Record<string, unknown>)[branchId];
    const decimal = toDecimal(raw);
    if (decimal && decimal.gte(0)) return decimal;
  }
  return toDecimal(plan.price) ?? new Decimal(0);
}

function toDecimal(value: unknown): Decimal | null {
  if (value === null || value === undefined) return null;
  try {
    if (value instanceof Decimal) return value;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Decimal(value);
    }
    if (typeof value === 'string' && value.trim() !== '') {
      return new Decimal(value);
    }
  } catch {
    return null;
  }
  return null;
}
