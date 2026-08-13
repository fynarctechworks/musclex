import {
  DAY_MS,
  classifyPlanChange,
  computeProration,
  cycleDays,
} from './proration.util';

describe('cycleDays', () => {
  it('matches SubscriptionPolicyService.computeNextPeriod conventions', () => {
    expect(cycleDays('monthly')).toBe(30);
    expect(cycleDays('quarterly')).toBe(90);
    expect(cycleDays('annual')).toBe(365);
    // Unknown cycles fall back to monthly, same as computeNextPeriod.
    expect(cycleDays('weird')).toBe(30);
  });
});

describe('computeProration', () => {
  const now = new Date('2026-07-01T00:00:00.000Z');
  const daysFromNow = (d: number) => new Date(now.getTime() + d * DAY_MS);

  it('charges only the difference mid-cycle (textbook 999 → 1999, 15 of 30 days left)', () => {
    const r = computeProration({
      current_price: 999,
      target_price: 1999,
      billing_cycle: 'monthly',
      period_end: daysFromNow(15),
      now,
    });
    expect(r.total_days).toBe(30);
    expect(r.remaining_days).toBe(15);
    expect(r.unused_credit).toBe(499.5);
    expect(r.remaining_cost).toBe(999.5);
    expect(r.subtotal).toBe(500);
  });

  it('handles the real Starter → Pro monthly upgrade (999 → 2499)', () => {
    const r = computeProration({
      current_price: 999,
      target_price: 2499,
      billing_cycle: 'monthly',
      period_end: daysFromNow(15),
      now,
    });
    expect(r.unused_credit).toBe(499.5);
    expect(r.remaining_cost).toBe(1249.5);
    expect(r.subtotal).toBe(750);
  });

  it('prorates annual cycles over 365 days', () => {
    // 9990 → 24990 with 273 days (~9 months) remaining.
    const r = computeProration({
      current_price: 9990,
      target_price: 24990,
      billing_cycle: 'annual',
      period_end: daysFromNow(273),
      now,
    });
    expect(r.total_days).toBe(365);
    expect(r.remaining_days).toBe(273);
    expect(r.unused_credit).toBe(+((9990 * 273) / 365).toFixed(2));
    expect(r.remaining_cost).toBe(+((24990 * 273) / 365).toFixed(2));
    expect(r.subtotal).toBe(+(r.remaining_cost - r.unused_credit).toFixed(2));
  });

  it('gives zero credit when upgrading from a free plan', () => {
    const r = computeProration({
      current_price: 0,
      target_price: 2499,
      billing_cycle: 'monthly',
      period_end: daysFromNow(10),
      now,
    });
    expect(r.unused_credit).toBe(0);
    expect(r.subtotal).toBe(833);
  });

  it('clamps remaining_days to zero when the period has already ended', () => {
    const r = computeProration({
      current_price: 999,
      target_price: 2499,
      billing_cycle: 'monthly',
      period_end: daysFromNow(-3),
      now,
    });
    expect(r.remaining_days).toBe(0);
    expect(r.unused_credit).toBe(0);
    expect(r.remaining_cost).toBe(0);
    expect(r.subtotal).toBe(0);
  });

  it('clamps remaining_days to the cycle length (credit can never exceed one full cycle)', () => {
    // e.g. reward-engine extended period end beyond a nominal 30-day month
    const r = computeProration({
      current_price: 999,
      target_price: 1999,
      billing_cycle: 'monthly',
      period_end: daysFromNow(45),
      now,
    });
    expect(r.remaining_days).toBe(30);
    expect(r.unused_credit).toBe(999);
    expect(r.remaining_cost).toBe(1999);
    expect(r.subtotal).toBe(1000);
  });

  it('rounds up partial days (customer-favourable on credit and charge alike)', () => {
    const r = computeProration({
      current_price: 999,
      target_price: 1999,
      billing_cycle: 'monthly',
      period_end: new Date(now.getTime() + 14.2 * DAY_MS),
      now,
    });
    expect(r.remaining_days).toBe(15);
  });

  it('never returns a negative subtotal on a downgrade (no mid-cycle refunds)', () => {
    const r = computeProration({
      current_price: 2499,
      target_price: 999,
      billing_cycle: 'monthly',
      period_end: daysFromNow(20),
      now,
    });
    expect(r.unused_credit).toBeGreaterThan(r.remaining_cost);
    expect(r.subtotal).toBe(0);
  });
});

describe('classifyPlanChange', () => {
  const base = {
    current_price: 999,
    target_price: 2499,
    cycle_changed: false,
    in_active_paid_period: true,
    remaining_days: 15,
  };

  it('routes mid-period upgrades to immediate proration', () => {
    expect(classifyPlanChange(base)).toBe('immediate_prorated');
  });

  it('schedules downgrades for the period boundary', () => {
    expect(
      classifyPlanChange({ ...base, current_price: 2499, target_price: 999 }),
    ).toBe('scheduled');
  });

  it('schedules equal-price lateral moves', () => {
    expect(
      classifyPlanChange({ ...base, current_price: 999, target_price: 999 }),
    ).toBe('scheduled');
  });

  it('schedules any cycle switch, even a more expensive one', () => {
    expect(
      classifyPlanChange({ ...base, cycle_changed: true, target_price: 9990 }),
    ).toBe('scheduled');
  });

  it('falls back to the renewal flow outside an active paid period', () => {
    expect(classifyPlanChange({ ...base, in_active_paid_period: false })).toBe(
      'renewal_due',
    );
  });

  it('falls back to the renewal flow when the period ends today', () => {
    expect(classifyPlanChange({ ...base, remaining_days: 0 })).toBe('renewal_due');
  });
});
