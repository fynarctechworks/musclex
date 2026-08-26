import { describeDuration, monthlyEquivalent } from '@/lib/plans';
import type { MembershipPlan } from '@/api/types';

const plan = (over: Partial<MembershipPlan>): MembershipPlan =>
  ({ id: 'p', name: 'Plan', price: 2400, ...over } as MembershipPlan);

describe('describeDuration', () => {
  it('says a year, not 365 days', () => {
    // Nobody sells an annual membership as "365 days".
    expect(describeDuration(plan({ duration_days: 365 }))).toBe('1 year');
  });

  it('handles a leap year', () => {
    expect(describeDuration(plan({ duration_days: 366 }))).toBe('1 year');
  });

  it('converts clean 30-day multiples to months', () => {
    expect(describeDuration(plan({ duration_days: 30 }))).toBe('1 month');
    expect(describeDuration(plan({ duration_days: 180 }))).toBe('6 months');
  });

  it('prefers duration_months when the plan carries it', () => {
    expect(describeDuration(plan({ duration_months: 3 }))).toBe('3 months');
    expect(describeDuration(plan({ duration_months: 12 }))).toBe('1 year');
  });

  it('handles weeks', () => {
    expect(describeDuration(plan({ duration_days: 7 }))).toBe('1 week');
    expect(describeDuration(plan({ duration_days: 14 }))).toBe('2 weeks');
  });

  it('falls back to plain days for an awkward length', () => {
    expect(describeDuration(plan({ duration_days: 45 }))).toBe('45 days');
  });

  it('does not invent a duration it was not given', () => {
    expect(describeDuration(plan({}))).toBe('—');
  });
});

describe('monthlyEquivalent', () => {
  it('answers "so how much a month?"', () => {
    expect(monthlyEquivalent(plan({ price: 24000, duration_days: 360 }))).toBe(2000);
  });

  it('uses duration_months when present', () => {
    expect(monthlyEquivalent(plan({ price: 6000, duration_months: 3 }))).toBe(2000);
  });

  it('accepts a Decimal string price', () => {
    expect(monthlyEquivalent(plan({ price: '14000', duration_days: 180 }))).toBeCloseTo(2333.33, 1);
  });

  it('returns null rather than inventing a figure with no duration', () => {
    expect(monthlyEquivalent(plan({ price: 2400 }))).toBeNull();
  });

  it('returns null for a free or nonsensical price', () => {
    expect(monthlyEquivalent(plan({ price: 0, duration_days: 30 }))).toBeNull();
    expect(monthlyEquivalent(plan({ price: 'free' as never, duration_days: 30 }))).toBeNull();
  });
});
