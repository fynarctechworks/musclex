import {
  PAYMENT_PAID, PAYMENT_PENDING, paymentVariant, statusParam,
} from '@/lib/payment-status';

/**
 * The bug this encodes: the Money screen filtered on `status=completed`, a
 * value the product has never written. It looked correct because the seeded
 * test data used the same invented status, so the two agreed with each other.
 * Fixing the seeder to 'paid' is what revealed that the screen returned 0 of
 * 30 payments and tinted every real one as a warning.
 */
describe('payment status vocabulary', () => {
  it('uses the value the API actually stores', () => {
    expect(PAYMENT_PAID).toBe('paid');
    expect(PAYMENT_PAID).not.toBe('completed');
  });

  it('sends no status param for "all"', () => {
    expect(statusParam('all')).toBeUndefined();
  });

  it('sends the status verbatim otherwise', () => {
    expect(statusParam(PAYMENT_PAID)).toBe('paid');
    expect(statusParam(PAYMENT_PENDING)).toBe('pending');
  });

  it('tints a paid payment as success', () => {
    expect(paymentVariant('paid')).toBe('success');
  });

  it('does NOT tint a real payment as a warning', () => {
    // The regression: every paid row rendered warning-toned.
    expect(paymentVariant('paid')).not.toBe('warning');
  });

  it('treats a refund as neutral, not an error', () => {
    // Refunding somebody is a normal thing a gym does, not a mistake.
    expect(paymentVariant('refunded')).toBe('secondary');
  });

  it('marks a failed payment as destructive — the one genuinely bad outcome', () => {
    expect(paymentVariant('failed')).toBe('destructive');
  });

  it('falls back rather than throwing on an unknown status', () => {
    expect(paymentVariant('chargeback')).toBe('secondary');
    expect(paymentVariant(null)).toBe('secondary');
  });
});
