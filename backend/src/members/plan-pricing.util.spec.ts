import { Decimal } from '@prisma/client/runtime/library';
import { resolvePlanPrice } from './plan-pricing.util';

describe('resolvePlanPrice', () => {
  const HOME = '00000000-0000-0000-0000-000000000001';
  const PREMIUM = '00000000-0000-0000-0000-000000000002';

  it('returns base price when no overrides set', () => {
    const price = resolvePlanPrice({ price: new Decimal('999') }, HOME);
    expect(price.toString()).toBe('999');
  });

  it('returns base price when overrides is empty object', () => {
    const price = resolvePlanPrice(
      { price: new Decimal('999'), branch_price_overrides: {} },
      HOME,
    );
    expect(price.toString()).toBe('999');
  });

  it('returns override when present for the target branch', () => {
    const price = resolvePlanPrice(
      {
        price: new Decimal('999'),
        branch_price_overrides: { [PREMIUM]: 1499 },
      },
      PREMIUM,
    );
    expect(price.toString()).toBe('1499');
  });

  it('falls back to base price for branches without an override', () => {
    const price = resolvePlanPrice(
      {
        price: new Decimal('999'),
        branch_price_overrides: { [PREMIUM]: 1499 },
      },
      HOME,
    );
    expect(price.toString()).toBe('999');
  });

  it('accepts stringified decimal overrides (common in JSONB round-trips)', () => {
    const price = resolvePlanPrice(
      {
        price: new Decimal('999'),
        branch_price_overrides: { [PREMIUM]: '1499.50' },
      },
      PREMIUM,
    );
    expect(price.toString()).toBe('1499.5');
  });

  it('ignores garbage overrides and falls back to base', () => {
    const price = resolvePlanPrice(
      {
        price: new Decimal('999'),
        branch_price_overrides: { [PREMIUM]: 'not-a-number' },
      },
      PREMIUM,
    );
    expect(price.toString()).toBe('999');
  });

  it('ignores negative overrides (likely typo) and falls back to base', () => {
    const price = resolvePlanPrice(
      {
        price: new Decimal('999'),
        branch_price_overrides: { [PREMIUM]: -50 },
      },
      PREMIUM,
    );
    expect(price.toString()).toBe('999');
  });

  it('treats override of 0 as a valid free-tier price', () => {
    const price = resolvePlanPrice(
      {
        price: new Decimal('999'),
        branch_price_overrides: { [PREMIUM]: 0 },
      },
      PREMIUM,
    );
    expect(price.toString()).toBe('0');
  });

  it('handles array-shaped overrides defensively (returns base)', () => {
    const price = resolvePlanPrice(
      {
        price: new Decimal('999'),
        branch_price_overrides: [1499] as any,
      },
      PREMIUM,
    );
    expect(price.toString()).toBe('999');
  });

  it('handles numeric base price', () => {
    const price = resolvePlanPrice(
      { price: 1200 as any, branch_price_overrides: {} },
      HOME,
    );
    expect(price.toString()).toBe('1200');
  });
});
