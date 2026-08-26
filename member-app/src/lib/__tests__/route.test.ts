import { MIN_SHAPE_POINTS, decodePolyline, projectRoute, projectRoutes, routePath } from '../route';
import { encodePolyline, simplify } from '../recorder';

/**
 * A route preview is the only place in the app where a silent failure looks
 * exactly like a correct result: a wrong projection still draws a plausible
 * squiggle. So these tests check the PROPERTIES that make the squiggle the
 * right one — round-trip fidelity, aspect ratio, and the degenerate cases
 * that produce NaN coordinates and an invisible path.
 */
describe('decodePolyline', () => {
  it('round-trips what the recorder encodes', () => {
    const track = [
      { lat: 17.6868, lng: 83.2185 },
      { lat: 17.6871, lng: 83.2189 },
      { lat: 17.688, lng: 83.2201 },
    ];
    const back = decodePolyline(encodePolyline(track));
    expect(back).toHaveLength(3);
    back.forEach((p, i) => {
      expect(p.lat).toBeCloseTo(track[i].lat, 5);
      expect(p.lng).toBeCloseTo(track[i].lng, 5);
    });
  });

  it('round-trips across the equator and the meridian, where the signs flip', () => {
    const track = [
      { lat: -0.0012, lng: -0.0034 },
      { lat: 0.0021, lng: 0.0007 },
    ];
    const back = decodePolyline(encodePolyline(track));
    expect(back[0].lat).toBeCloseTo(-0.0012, 5);
    expect(back[0].lng).toBeCloseTo(-0.0034, 5);
    expect(back[1].lat).toBeCloseTo(0.0021, 5);
  });

  it('round-trips a long thinned track', () => {
    const track = Array.from({ length: 1200 }, (_, i) => ({
      lat: 17.6868 + i * 0.0001,
      lng: 83.2185 + Math.sin(i / 40) * 0.001,
    }));
    const thinned = simplify(track);
    const back = decodePolyline(encodePolyline(thinned));
    expect(back).toHaveLength(thinned.length);
    expect(back[back.length - 1].lat).toBeCloseTo(track[track.length - 1].lat, 5);
  });

  it('returns nothing for an empty string rather than throwing', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('projectRoute', () => {
  const square = [
    { lat: 17.68, lng: 83.21 },
    { lat: 17.69, lng: 83.21 },
    { lat: 17.69, lng: 83.22 },
    { lat: 17.68, lng: 83.22 },
    { lat: 17.68, lng: 83.21 },
  ];

  it('keeps every point inside the box', () => {
    const p = projectRoute(square, 200, 100)!;
    for (const pt of p.points) {
      expect(pt.x).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeLessThanOrEqual(200);
      expect(pt.y).toBeGreaterThanOrEqual(0);
      expect(pt.y).toBeLessThanOrEqual(100);
    }
  });

  it('does not stretch a route to fill the box', () => {
    // A north-south line in a wide box must stay a line, not fan out.
    const line = [
      { lat: 17.68, lng: 83.21 },
      { lat: 17.7, lng: 83.21 },
    ];
    const p = projectRoute(line, 300, 100)!;
    expect(p.points[0].x).toBeCloseTo(p.points[1].x, 5);
  });

  it('centres a route that cannot fill the box', () => {
    const line = [
      { lat: 17.68, lng: 83.21 },
      { lat: 17.7, lng: 83.21 },
    ];
    const p = projectRoute(line, 300, 100)!;
    // Horizontal span is zero, so the line should sit at the horizontal centre.
    expect(p.points[0].x).toBeCloseTo(150, 0);
  });

  it('puts north at the top', () => {
    const p = projectRoute(
      [{ lat: 17.68, lng: 83.21 }, { lat: 17.69, lng: 83.215 }],
      100,
      100,
    )!;
    // Second point is further north, so its y must be SMALLER on screen.
    expect(p.points[1].y).toBeLessThan(p.points[0].y);
  });

  it('projects in Mercator, not raw degrees', () => {
    /*
      At 17.7°N a degree of longitude covers ~1060 m of ground while a degree
      of latitude covers ~1106 m, so a square measured in DEGREES is really
      slightly taller than it is wide. Mercator preserves that by stretching y
      by sec(latitude) ≈ 1.05.

      A flat-degrees projection would render it exactly square (ratio 1.0), and
      mixing units — degrees on x, log-tangent on y — would render it ~57×
      taller. Both look like plausible squiggles on a real track, which is why
      this is asserted numerically rather than by eye.
    */
    const p = projectRoute(square, 400, 400, 0)!;
    const w = Math.max(...p.points.map((q) => q.x)) - Math.min(...p.points.map((q) => q.x));
    const h = Math.max(...p.points.map((q) => q.y)) - Math.min(...p.points.map((q) => q.y));
    expect(h).toBeGreaterThan(w);
    expect(h / w).toBeCloseTo(1 / Math.cos((17.685 * Math.PI) / 180), 2);
  });

  it('reports a span roughly matching the real ground distance', () => {
    // 0.01° of latitude is about 1.1 km.
    const p = projectRoute(square, 200, 200)!;
    expect(p.spanM).toBeGreaterThan(900);
    expect(p.spanM).toBeLessThan(1300);
  });

  describe('the cases that draw an invisible path', () => {
    it('refuses a single point', () => {
      expect(projectRoute([{ lat: 17.68, lng: 83.21 }], 100, 100)).toBeNull();
    });

    it('refuses an empty track', () => {
      expect(projectRoute([], 100, 100)).toBeNull();
    });

    it('refuses a track that never moved', () => {
      const still = [
        { lat: 17.68, lng: 83.21 },
        { lat: 17.68, lng: 83.21 },
      ];
      expect(projectRoute(still, 100, 100)).toBeNull();
    });

    it('refuses a zero-sized box', () => {
      expect(projectRoute(square, 0, 100)).toBeNull();
    });

    it('never emits NaN', () => {
      const p = projectRoute(square, 137, 61)!;
      for (const pt of p.points) {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      }
    });
  });
});

describe('MIN_SHAPE_POINTS', () => {
  it('is above the two points the maths needs, because the maths is not the point', () => {
    // projectRoute only needs two points to be defined. The floor exists so a
    // three-fix track is not drawn as a confident route across a whole card.
    expect(MIN_SHAPE_POINTS).toBeGreaterThan(2);
  });

  it('still projects a short track when asked directly', () => {
    // The floor belongs to the component, not the geometry: a caller that
    // wants coordinates for three points should get them.
    const short = [
      { lat: 17.68, lng: 83.21 },
      { lat: 17.685, lng: 83.215 },
      { lat: 17.69, lng: 83.212 },
    ];
    expect(projectRoute(short, 100, 100)).not.toBeNull();
  });
});

describe('routePath', () => {
  it('starts with a move and continues with lines', () => {
    const d = routePath([{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }]);
    expect(d).toBe('M1.0,2.0 L3.0,4.0 L5.0,6.0');
  });

  it('is empty for no points, not the string "undefined"', () => {
    expect(routePath([])).toBe('');
  });
});

describe('projectRoutes', () => {
  const near = (n = 30, dLat = 0, dLng = 0) =>
    Array.from({ length: n }, (_, i) => ({
      lat: 17.686 + dLat + 0.003 * Math.sin((i / n) * 2 * Math.PI),
      lng: 83.218 + dLng + 0.004 * Math.cos((i / n) * 2 * Math.PI),
    }));

  it('returns one path per track, in order', () => {
    const r = projectRoutes([near(), near(30, 0.01), near(30, 0.02)], 200, 200)!;
    expect(r.paths).toHaveLength(3);
    expect(r.paths[0]).toHaveLength(30);
  });

  it('puts every track on ONE shared scale', () => {
    // A small loop and a loop twice its size must come out at different
    // drawn sizes. Per-route framing would render them identically.
    const small = near(30);
    const big = small.map((p) => ({
      lat: 17.686 + (p.lat - 17.686) * 2,
      lng: 83.218 + (p.lng - 83.218) * 2,
    }));
    const r = projectRoutes([small, big], 300, 300)!;
    const w = (pts: { x: number }[]) =>
      Math.max(...pts.map((q) => q.x)) - Math.min(...pts.map((q) => q.x));
    expect(w(r.paths[1]) / w(r.paths[0])).toBeCloseTo(2, 1);
  });

  it('does not let one distant outlier squash everything else', () => {
    // A single run 8 degrees away — roughly Visakhapatnam to Delhi. Framing to
    // it would render a year of local training as a single pixel.
    const holiday = near(30, 8, 8);
    const r = projectRoutes([...Array.from({ length: 20 }, () => near(30)), holiday], 300, 300)!;
    const homePts = r.paths.slice(0, 20).flat();
    const spread = Math.max(...homePts.map((q) => q.x)) - Math.min(...homePts.map((q) => q.x));
    // The local cluster should fill the frame, not survive in a corner of it.
    expect(spread).toBeGreaterThan(250);
  });

  it('reports a span for the framed area, not the outlier', () => {
    const r = projectRoutes(
      [...Array.from({ length: 20 }, () => near(30)), near(30, 8, 8)],
      300,
      300,
    )!;
    // The local loop is under a kilometre across; the outlier is ~900 km away.
    expect(r.spanM).toBeLessThan(2000);
  });

  it('frames both clusters when training is genuinely split between two', () => {
    // Ten routes here, ten there: neither is an outlier, and hiding half a
    // member's training because they moved city would be wrong.
    const r = projectRoutes(
      [...Array.from({ length: 10 }, () => near(30)),
       ...Array.from({ length: 10 }, () => near(30, 0.5, 0.5))],
      300,
      300,
    )!;
    expect(r.clipped).toBe(0);
  });

  it('counts the tracks it framed out instead of hiding them', () => {
    const r = projectRoutes(
      [...Array.from({ length: 20 }, () => near(30)), near(30, 8, 8)],
      300,
      300,
    )!;
    expect(r.clipped).toBe(1);
  });

  it('reports nothing clipped when every route is in view', () => {
    const r = projectRoutes([near(), near(30, 0.002)], 300, 300)!;
    expect(r.clipped).toBe(0);
  });

  it('refuses an empty set rather than drawing an empty frame', () => {
    expect(projectRoutes([], 200, 200)).toBeNull();
    expect(projectRoutes([[]], 200, 200)).toBeNull();
  });

  it('refuses a set where nothing moved', () => {
    const still = [{ lat: 17.68, lng: 83.21 }, { lat: 17.68, lng: 83.21 }];
    expect(projectRoutes([still], 200, 200)).toBeNull();
  });

  it('never emits NaN', () => {
    const r = projectRoutes([near(), near(30, 0.01)], 137, 61)!;
    for (const q of r.paths.flat()) {
      expect(Number.isFinite(q.x)).toBe(true);
      expect(Number.isFinite(q.y)).toBe(true);
    }
  });
});
