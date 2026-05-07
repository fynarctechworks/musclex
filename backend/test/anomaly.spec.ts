import { AnomalyService } from '../src/dashboard/anomaly.service';

describe('AnomalyService', () => {
  const svc = new AnomalyService();

  it('returns null when fewer than 8 baseline points', () => {
    const result = svc.detect({
      series_14d: [10, 10, 10, 10, 10, 10, 10],
      today_value: 5,
      metric: 'check_ins',
    });
    expect(result).toBeNull();
  });

  it('returns null when baseline is too sparse (<7 non-zero days)', () => {
    const result = svc.detect({
      series_14d: [0, 0, 0, 10, 10, 10, 10, 10, 10, 0, 0, 0, 0, 5],
      today_value: 5,
      metric: 'check_ins',
    });
    // 6 non-zero baseline days → too sparse
    expect(result).toBeNull();
  });

  it('returns null when delta_pct is below 25% threshold', () => {
    // baseline ~50, today 55 → +10% (under threshold)
    const series = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 55];
    const result = svc.detect({
      series_14d: series,
      today_value: 55,
      metric: 'check_ins',
    });
    expect(result).toBeNull();
  });

  it('flags a sharp drop with high severity', () => {
    // baseline mean ~100, stdev ~10, today 30 → -70%
    const series = [
      90, 100, 110, 95, 105, 100, 90, 110, 95, 105, 100, 90, 110, 30,
    ];
    const result = svc.detect({
      series_14d: series,
      today_value: 30,
      metric: 'check_ins',
    });
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('check_ins_low');
    expect(result!.severity).toBe('high');
    expect(result!.delta_pct).toBeLessThan(-25);
    expect(result!.why).toContain('Check-ins');
  });

  it('flags a sharp spike as high anomaly', () => {
    // baseline mean ~50, stdev ~5, today 200 → +300%
    const series = [
      45, 50, 55, 48, 52, 50, 47, 53, 49, 51, 50, 46, 54, 200,
    ];
    const result = svc.detect({
      series_14d: series,
      today_value: 200,
      metric: 'revenue',
    });
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('revenue_high');
    expect(result!.severity).toBe('high');
  });

  it('emits a why-string referencing the actual numbers', () => {
    const series = [
      80, 80, 90, 100, 110, 100, 90, 80, 90, 100, 110, 100, 90, 30,
    ];
    const result = svc.detect({
      series_14d: series,
      today_value: 30,
      metric: 'check_ins',
    });
    expect(result).not.toBeNull();
    expect(result!.why).toMatch(/today/i);
    expect(result!.why).toMatch(/baseline|mean/i);
    expect(result!.why).toMatch(/z=/);
  });

  it('returns null when stdev is zero (perfectly flat baseline)', () => {
    // Baseline is all 100s — stdev = 0; today = 200 → undefined z-score.
    // The service should detect this and bail rather than crash.
    const series = [
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 200,
    ];
    const result = svc.detect({
      series_14d: series,
      today_value: 200,
      metric: 'check_ins',
    });
    // stdev=0 → bail
    expect(result).toBeNull();
  });

  it('rounds z-score and delta_pct to 2 decimal places', () => {
    const series = [
      80, 90, 100, 110, 80, 90, 100, 110, 80, 90, 100, 110, 80, 30,
    ];
    const result = svc.detect({
      series_14d: series,
      today_value: 30,
      metric: 'check_ins',
    });
    expect(result).not.toBeNull();
    expect(Number.isFinite(result!.z_score)).toBe(true);
    expect(Math.round(result!.z_score * 100)).toBe(result!.z_score * 100);
  });
});
