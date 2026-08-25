import { arcPath, donutSegments, extent, pointsToPath, scaleY, seriesToPoints } from '../charts/geometry';

describe('scaleY', () => {
  it('inverts the axis — larger values sit higher on screen', () => {
    expect(scaleY(10, 0, 10, 100)).toBeLessThan(scaleY(0, 0, 10, 100));
  });

  it('centres a flat series instead of returning NaN', () => {
    // Every gym has days where a metric does not move. Dividing by a zero
    // span would blank the whole chart.
    const y = scaleY(5, 5, 5, 100);
    expect(Number.isNaN(y)).toBe(false);
    expect(y).toBe(50);
  });

  it('respects padding', () => {
    expect(scaleY(10, 0, 10, 100, 10)).toBe(10);
    expect(scaleY(0, 0, 10, 100, 10)).toBe(90);
  });
});

describe('seriesToPoints', () => {
  it('spaces points evenly across the width', () => {
    const pts = seriesToPoints([1, 2, 3], 100, 50, 0);
    expect(pts.map((p) => Math.round(p.x))).toEqual([0, 50, 100]);
  });

  it('centres a single point rather than dividing by zero', () => {
    const pts = seriesToPoints([7], 100, 50, 0);
    expect(pts).toHaveLength(1);
    expect(pts[0].x).toBe(50);
  });

  it('returns nothing for an empty series', () => {
    expect(seriesToPoints([], 100, 50)).toEqual([]);
  });
});

describe('extent', () => {
  it('finds min and max', () => {
    expect(extent([3, 1, 4, 1, 5])).toEqual({ min: 1, max: 5 });
  });
  it('is safe on empty input', () => {
    expect(extent([])).toEqual({ min: 0, max: 0 });
  });
});

describe('pointsToPath', () => {
  it('starts with a move and continues with lines', () => {
    const d = pointsToPath([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(d.startsWith('M')).toBe(true);
    expect(d).toContain('L');
  });
  it('is empty for no points', () => {
    expect(pointsToPath([])).toBe('');
  });
});

describe('donutSegments', () => {
  it('divides the full circle proportionally', () => {
    const segs = donutSegments([1, 1, 2]);
    expect(segs).toHaveLength(3);
    expect(segs[0].end - segs[0].start).toBeCloseTo(90);
    expect(segs[2].end).toBeCloseTo(360);
  });

  it('returns nothing when the total is zero', () => {
    // A donut of all-zeros must render nothing, not a full ring implying 100%.
    expect(donutSegments([0, 0])).toEqual([]);
  });

  it('ignores negative values rather than inverting the ring', () => {
    const segs = donutSegments([-5, 5]);
    expect(segs[0].end - segs[0].start).toBe(0);
  });
});

describe('arcPath', () => {
  it('produces a closed ring segment', () => {
    const d = arcPath(50, 50, 40, 25, 0, 90);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).toContain('A');
  });

  it('clamps a full circle so start and end never coincide', () => {
    // A 360° arc collapses to a point in SVG; it must be nudged under 360.
    expect(arcPath(50, 50, 40, 25, 0, 360)).not.toContain('NaN');
  });
});
