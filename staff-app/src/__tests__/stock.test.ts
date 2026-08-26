import { describeStock, stockFor, stockVariant } from '@/lib/stock';
import type { Product } from '@/api/types';

const p = (inventory?: Product['inventory']): Product =>
  ({ id: 'x', product_name: 'Creatine', price: '1400', inventory } as Product);

/**
 * The distinction this exists for: a product with NO inventory row is not a
 * product with zero stock. The seeded shop had exactly that — every sale
 * failed with "insufficient stock" while the shop screen looked fully stocked.
 */
describe('stockFor', () => {
  it('reports UNTRACKED when there is no inventory row', () => {
    expect(stockFor(p()).kind).toBe('untracked');
    expect(stockFor(p([])).kind).toBe('untracked');
  });

  it('does not confuse untracked with out of stock', () => {
    expect(stockFor(p()).kind).not.toBe('out');
    expect(describeStock(stockFor(p()))).toBe('Stock not tracked');
    expect(describeStock(stockFor(p([{ stock_quantity: 0 }])))).toBe('Out of stock');
  });

  it('reports plain stock', () => {
    expect(stockFor(p([{ stock_quantity: 8, reorder_level: 5 }])))
      .toEqual({ kind: 'ok', available: 8 });
  });

  it('subtracts RESERVED stock, which is already spoken for', () => {
    // Counting reserved as available promises the same tub to two people.
    expect(stockFor(p([{ stock_quantity: 8, reserved_quantity: 3 }])))
      .toEqual({ kind: 'ok', available: 5 });
  });

  it('flags low stock at or below the reorder level', () => {
    expect(stockFor(p([{ stock_quantity: 5, reorder_level: 5 }])).kind).toBe('low');
    expect(stockFor(p([{ stock_quantity: 4, reorder_level: 5 }])).kind).toBe('low');
    expect(stockFor(p([{ stock_quantity: 6, reorder_level: 5 }])).kind).toBe('ok');
  });

  it('does not flag low when no reorder level is set', () => {
    // Without a threshold there is no such thing as "low" — inventing one
    // would nag about every product a gym stocks lightly on purpose.
    expect(stockFor(p([{ stock_quantity: 1 }])).kind).toBe('ok');
  });

  it('sums across branches', () => {
    expect(stockFor(p([{ stock_quantity: 3 }, { stock_quantity: 4 }])))
      .toEqual({ kind: 'ok', available: 7 });
  });

  it('never reports negative availability', () => {
    // Over-reservation is a data problem; "-2 in stock" is not a useful answer.
    expect(stockFor(p([{ stock_quantity: 2, reserved_quantity: 5 }])).kind).toBe('out');
  });

  it('treats a missing quantity as zero rather than throwing', () => {
    expect(stockFor(p([{ reorder_level: 5 }])).kind).toBe('out');
  });
});

describe('stockVariant', () => {
  it('paints out-of-stock as the problem it is', () => {
    expect(stockVariant(stockFor(p([{ stock_quantity: 0 }])))).toBe('destructive');
  });

  it('paints untracked NEUTRALLY, not as an error', () => {
    // Not tracking stock is a legitimate choice, not a fault.
    expect(stockVariant(stockFor(p()))).toBe('secondary');
  });

  it('warns on low', () => {
    expect(stockVariant(stockFor(p([{ stock_quantity: 2, reorder_level: 5 }])))).toBe('warning');
  });
});
