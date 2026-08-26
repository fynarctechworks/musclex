import type { Product } from '@/api/types';

/**
 * Stock levels, read carefully.
 *
 * The distinction that matters: a product with NO inventory row is not a
 * product with zero stock. The seeded shop had exactly that — eight products,
 * no inventory rows — and every sale failed with "insufficient stock" while
 * the shop screen looked perfectly stocked. "Not tracked" and "sold out" must
 * never render the same way.
 */

export type StockState =
  | { kind: 'untracked' }
  | { kind: 'out' }
  | { kind: 'low'; available: number; reorderLevel: number }
  | { kind: 'ok'; available: number };

export function stockFor(product: Product): StockState {
  const rows = product.inventory ?? [];
  if (rows.length === 0) return { kind: 'untracked' };

  // Sum across branches: the list endpoint returns a row per branch, and a
  // gym-wide view should say how much exists in total.
  let onHand = 0;
  let reserved = 0;
  let reorder = 0;
  for (const r of rows) {
    onHand += r.stock_quantity ?? 0;
    reserved += r.reserved_quantity ?? 0;
    reorder = Math.max(reorder, r.reorder_level ?? 0);
  }

  // Reserved stock is spoken for. Counting it as available is how a shop
  // promises the same tub of protein to two people.
  const available = Math.max(0, onHand - reserved);

  if (available <= 0) return { kind: 'out' };
  if (reorder > 0 && available <= reorder) {
    return { kind: 'low', available, reorderLevel: reorder };
  }
  return { kind: 'ok', available };
}

export function describeStock(state: StockState): string {
  switch (state.kind) {
    case 'untracked': return 'Stock not tracked';
    case 'out': return 'Out of stock';
    case 'low': return `${state.available} left`;
    case 'ok': return `${state.available} in stock`;
  }
}

export function stockVariant(
  state: StockState,
): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (state.kind) {
    case 'untracked': return 'secondary';
    case 'out': return 'destructive';
    case 'low': return 'warning';
    case 'ok': return 'success';
  }
}
