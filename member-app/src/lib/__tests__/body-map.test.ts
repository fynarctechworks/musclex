import { MUSCLE_REGION, neglected, REGIONS, regionTotals, shade } from '../body-map';

/**
 * The map's job is to tell somebody what they have been neglecting. Every bug
 * here is one that lies in a flattering direction — lighting a muscle they did
 * not train, or hiding one they did.
 */
describe('regionTotals', () => {
  it('folds several muscles into the region they share', () => {
    const out = regionTotals([
      { muscle: 'upper_chest', sets: 4 },
      { muscle: 'mid_chest', sets: 6 },
      { muscle: 'lower_chest', sets: 2 },
    ]);
    expect(out.get('chest')).toBe(12);
  });

  it('drops a muscle it does not recognise rather than guessing', () => {
    // A wrongly-lit region tells someone they trained something they did not.
    const out = regionTotals([{ muscle: 'gizzard', sets: 9 }]);
    expect(out.size).toBe(0);
  });

  it('keeps coarse groups working, since the catalogue has gaps', () => {
    expect(regionTotals([{ muscle: 'back', sets: 3 }]).get('upper_back')).toBe(3);
    expect(regionTotals([{ muscle: 'legs', sets: 5 }]).get('quads')).toBe(5);
  });

  it('handles an empty or missing tally', () => {
    expect(regionTotals([]).size).toBe(0);
    expect(regionTotals(undefined as any).size).toBe(0);
  });

  it('puts triceps on the back and biceps on the front', () => {
    // They are drawn on different sides of the body; swapping them would look
    // plausible and be wrong.
    expect(MUSCLE_REGION.triceps).toBe('arms_back');
    expect(MUSCLE_REGION.biceps).toBe('arms');
  });
});

describe('shade', () => {
  it('is 0 for a muscle with no work', () => {
    expect(shade(0, 20)).toBe(0);
  });

  it('is full for the hardest-worked muscle', () => {
    expect(shade(20, 20)).toBe(4);
  });

  it('scales relative to the member\'s own maximum', () => {
    // Relative on purpose: a fixed scale lights a beginner's whole body dimly
    // and tells them nothing.
    expect(shade(10, 20)).toBe(3);
    expect(shade(5, 20)).toBe(2);
    expect(shade(1, 20)).toBe(1);
  });

  it('never divides by zero', () => {
    expect(shade(5, 0)).toBe(0);
  });
});

describe('neglected', () => {
  it('lists every region with no work', () => {
    const totals = regionTotals([{ muscle: 'chest', sets: 10 }]);
    const out = neglected(totals).map((r) => r.key);
    expect(out).not.toContain('chest');
    expect(out).toContain('hamstrings');
  });

  it('is everything when nothing has been logged', () => {
    expect(neglected(new Map())).toHaveLength(REGIONS.length);
  });
});

describe('REGIONS', () => {
  it('has no duplicate keys', () => {
    const keys = REGIONS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('maps every muscle in the table onto a region that exists', () => {
    // A muscle pointing at a region nobody draws is silently invisible.
    const keys = new Set(REGIONS.map((r) => r.key));
    for (const [muscle, region] of Object.entries(MUSCLE_REGION)) {
      expect({ muscle, region, drawn: keys.has(region) }).toEqual({
        muscle, region, drawn: true,
      });
    }
  });

  it('keeps every region inside the viewBox', () => {
    for (const r of REGIONS) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y + r.h).toBeLessThanOrEqual(220);
    }
  });
});
