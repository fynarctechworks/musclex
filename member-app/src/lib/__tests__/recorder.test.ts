import {
  accept,
  ACCURACY_LIMIT_M,
  avgSpeedMps,
  clock,
  encodePolyline,
  haversineM,
  newRecording,
  pacePerKm,
  pause,
  resume,
  simplify,
  type GeoSample,
} from '../recorder';

/**
 * These filters are the difference between a tracker people trust and one they
 * delete. "It said 12 km and I ran 10" is not a rounding complaint — it is a
 * recorder that counted GPS noise as running.
 */

const S = 1_700_000_000_000; // fixed epoch; no clock reads in tests

const at = (secs: number) => S + secs * 1000;

/** ~1.11 m per 0.00001° of latitude, near enough for fixtures. */
const north = (lat: number, metres: number) => lat + metres / 111_320;

const fix = (over: Partial<GeoSample> & { at: number }): GeoSample => ({
  lat: 17.7,
  lng: 83.3,
  accuracy: 5,
  ...over,
});

describe('haversineM', () => {
  it('is zero for the same point', () => {
    expect(haversineM(fix({ at: at(0) }), fix({ at: at(1) }))).toBe(0);
  });

  it('measures a short hop to within a metre', () => {
    const a = fix({ at: at(0) });
    const b = fix({ at: at(1), lat: north(17.7, 100) });
    expect(haversineM(a, b)).toBeGreaterThan(99);
    expect(haversineM(a, b)).toBeLessThan(101);
  });
});

describe('accept — the accuracy filter', () => {
  it('ignores a fix the phone itself calls vague', () => {
    // Standing under a roof, consecutive bad fixes scatter and silently
    // accumulate kilometres.
    let st = newRecording(S);
    st = accept(st, fix({ at: at(0) }));
    st = accept(st, fix({ at: at(1), lat: north(17.7, 50), accuracy: ACCURACY_LIMIT_M + 1 }));
    expect(st.points).toHaveLength(1);
    expect(st.distanceM).toBe(0);
  });

  it('accepts a fix with no accuracy reported rather than dropping it', () => {
    let st = newRecording(S);
    st = accept(st, fix({ at: at(0), accuracy: null }));
    expect(st.points).toHaveLength(1);
  });
});

describe('accept — plausibility', () => {
  it('does not credit a teleport as distance', () => {
    let st = newRecording(S);
    st = accept(st, fix({ at: at(0) }));
    // 5 km in one second.
    st = accept(st, fix({ at: at(1), lat: north(17.7, 5000) }));
    expect(st.distanceM).toBe(0);
  });

  it('still anchors on the jumped-to fix, so the track continues', () => {
    let st = newRecording(S);
    st = accept(st, fix({ at: at(0) }));
    st = accept(st, fix({ at: at(1), lat: north(17.7, 5000) }));
    expect(st.points).toHaveLength(2);
  });

  it('ignores an out-of-order fix instead of producing negative time', () => {
    let st = newRecording(S);
    st = accept(st, fix({ at: at(10) }));
    st = accept(st, fix({ at: at(5), lat: north(17.7, 20) }));
    expect(st.points).toHaveLength(1);
    expect(st.elapsedMs).toBe(0);
  });

  it('ignores a duplicate timestamp', () => {
    let st = newRecording(S);
    st = accept(st, fix({ at: at(3) }));
    st = accept(st, fix({ at: at(3), lat: north(17.7, 5) }));
    expect(st.points).toHaveLength(1);
  });
});

describe('accept — distance and speed', () => {
  it('sums a steady run', () => {
    let st = newRecording(S);
    let lat = 17.7;
    st = accept(st, fix({ at: at(0), lat }));
    for (let i = 1; i <= 10; i++) {
      lat = north(lat, 30); // 30 m per 10 s = 3 m/s
      st = accept(st, fix({ at: at(i * 10), lat }));
    }
    expect(st.distanceM).toBeGreaterThan(297);
    expect(st.distanceM).toBeLessThan(303);
    expect(st.movingMs).toBe(100_000);
  });

  it('remembers the fastest segment', () => {
    let st = newRecording(S);
    st = accept(st, fix({ at: at(0) }));
    st = accept(st, fix({ at: at(10), lat: north(17.7, 30) }));   // 3 m/s
    st = accept(st, fix({ at: at(20), lat: north(17.7, 130) }));  // 10 m/s
    expect(st.maxSpeedMps).toBeGreaterThan(9);
    expect(st.maxSpeedMps).toBeLessThan(11);
  });
});

describe('accept — auto-pause', () => {
  it('engages after standing still long enough', () => {
    let st = newRecording(S);
    let lat = 17.7;
    st = accept(st, fix({ at: at(0), lat }));
    // Barely moving for 15 s.
    for (let i = 1; i <= 5; i++) {
      lat = north(lat, 0.5);
      st = accept(st, fix({ at: at(i * 3), lat }));
    }
    expect(st.autoPaused).toBe(true);
  });

  it('does not bill paused time to moving time', () => {
    let st = newRecording(S);
    let lat = 17.7;
    st = accept(st, fix({ at: at(0), lat }));
    for (let i = 1; i <= 6; i++) {
      lat = north(lat, 0.5);
      st = accept(st, fix({ at: at(i * 5), lat }));
    }
    // Elapsed keeps running; moving stops. A coffee stop must not wreck pace.
    expect(st.elapsedMs).toBeGreaterThan(st.movingMs);
  });

  it('releases only once genuinely moving again, not on a twitch', () => {
    let st = newRecording(S);
    let lat = 17.7;
    st = accept(st, fix({ at: at(0), lat }));
    for (let i = 1; i <= 5; i++) {
      lat = north(lat, 0.5);
      st = accept(st, fix({ at: at(i * 3), lat }));
    }
    expect(st.autoPaused).toBe(true);
    // 0.8 m/s — above "still" but below "moving". Hysteresis holds the pause.
    lat = north(lat, 4);
    st = accept(st, fix({ at: at(20), lat }));
    expect(st.autoPaused).toBe(true);
    // 3 m/s — clearly going again.
    lat = north(lat, 15);
    st = accept(st, fix({ at: at(25), lat }));
    expect(st.autoPaused).toBe(false);
  });
});

describe('accept — elevation', () => {
  it('ignores altitude jitter at rest', () => {
    // GPS altitude wanders metres while standing still; counting it turns a
    // flat park run into 300 m of climbing.
    let st = newRecording(S);
    st = accept(st, fix({ at: at(0), altitude: 30 }));
    for (let i = 1; i <= 20; i++) {
      st = accept(st, fix({ at: at(i * 5), lat: north(17.7, i * 20), altitude: 30 + (i % 2) }));
    }
    expect(st.elevationGainM).toBe(0);
  });

  it('counts a real climb', () => {
    let st = newRecording(S);
    let lat = 17.7;
    st = accept(st, fix({ at: at(0), lat, altitude: 30 }));
    for (let i = 1; i <= 10; i++) {
      lat = north(lat, 50);
      st = accept(st, fix({ at: at(i * 20), lat, altitude: 30 + i * 5 }));
    }
    expect(st.elevationGainM).toBeCloseTo(50, 0);
  });

  it('does not count the descent, and measures the next climb from the bottom', () => {
    let st = newRecording(S);
    let lat = 17.7;
    st = accept(st, fix({ at: at(0), lat, altitude: 100 }));
    lat = north(lat, 200);
    st = accept(st, fix({ at: at(60), lat, altitude: 50 }));   // down 50
    lat = north(lat, 200);
    st = accept(st, fix({ at: at(120), lat, altitude: 80 }));  // up 30
    expect(st.elevationGainM).toBeCloseTo(30, 0);
  });
});

describe('pause and resume', () => {
  it('a paused recorder ignores fixes entirely', () => {
    let st = newRecording(S);
    st = accept(st, fix({ at: at(0) }));
    st = pause(st);
    st = accept(st, fix({ at: at(30), lat: north(17.7, 200) }));
    expect(st.distanceM).toBe(0);
    expect(st.points).toHaveLength(1);
  });

  it('does not bill the paused gap to the next segment', () => {
    // Without dropping the anchor, ten minutes at a crossing would land on the
    // first segment after resuming and destroy the pace.
    let st = newRecording(S);
    st = accept(st, fix({ at: at(0) }));
    st = pause(st);
    st = resume(st);
    st = accept(st, fix({ at: at(600), lat: north(17.7, 30) }));
    st = accept(st, fix({ at: at(610), lat: north(17.7, 60) }));
    expect(st.elapsedMs).toBe(10_000);
  });
});

describe('pace', () => {
  it('is seconds per kilometre', () => {
    expect(pacePerKm(1000, 300_000)).toBe(300);
  });

  it('is null before enough distance to mean anything', () => {
    expect(pacePerKm(5, 60_000)).toBeNull();
    expect(pacePerKm(0, 0)).toBeNull();
  });

  it('avgSpeedMps is null with no moving time rather than Infinity', () => {
    expect(avgSpeedMps(500, 0)).toBeNull();
  });
});

describe('encodePolyline', () => {
  it('matches the reference encoding from the Google spec', () => {
    const out = encodePolyline([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
    expect(out).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  });

  it('encodes an empty track as an empty string', () => {
    expect(encodePolyline([])).toBe('');
  });
});

describe('simplify', () => {
  it('leaves a short track alone', () => {
    const pts = Array.from({ length: 10 }, (_, i) => i);
    expect(simplify(pts, 400)).toHaveLength(10);
  });

  it('thins a long track towards the cap', () => {
    const pts = Array.from({ length: 11_000 }, (_, i) => i);
    expect(simplify(pts, 400).length).toBeLessThanOrEqual(401);
  });

  it('always keeps the finish', () => {
    // Clipping the last point draws a route that stops short of where the
    // member actually stopped.
    const pts = Array.from({ length: 11_000 }, (_, i) => i);
    const out = simplify(pts, 400);
    expect(out[out.length - 1]).toBe(10_999);
  });
});

describe('clock', () => {
  it('drops the hour until there is one', () => {
    expect(clock(461_000)).toBe('7:41');
  });

  it('shows hours with padded minutes', () => {
    expect(clock(3_852_000)).toBe('1:04:12');
  });

  it('never renders negative time', () => {
    expect(clock(-5000)).toBe('0:00');
  });
});
