import { chartSeries, splitsFrom, zoneDistribution, type ZoneBand } from './activity-analysis';

/**
 * These numbers get read closely — a runner knows what their kilometre splits
 * should be and will spot a wrong one instantly. Worse, every failure mode
 * here produces a plausible number rather than an error, so the tests pin the
 * arithmetic against hand-computable cases and then attack it with the ragged
 * input real GPS produces.
 */

/** An even run: `pace` seconds per km, one sample every `every` metres. */
const evenRun = (totalM: number, pacePerKm: number, every = 10) => {
  const distance: number[] = [];
  const time: number[] = [];
  for (let d = 0; d <= totalM; d += every) {
    distance.push(d);
    time.push((d / 1000) * pacePerKm);
  }
  return { distance, time };
};

describe('splitsFrom', () => {
  it('splits an even 5k into five equal kilometres', () => {
    const { distance, time } = evenRun(5000, 300);
    const splits = splitsFrom(distance, time);
    expect(splits).toHaveLength(5);
    for (const s of splits) {
      expect(s.distanceM).toBe(1000);
      expect(s.seconds).toBe(300);
      expect(s.pacePerKm).toBe(300);
      expect(s.complete).toBe(true);
    }
  });

  it('reports the trailing part-kilometre and marks it incomplete', () => {
    const { distance, time } = evenRun(5400, 300);
    const splits = splitsFrom(distance, time);
    expect(splits).toHaveLength(6);
    const tail = splits[5];
    expect(tail.complete).toBe(false);
    expect(tail.distanceM).toBe(400);
    expect(tail.seconds).toBe(120);
  });

  it('does not invent a split for a few stray metres past the line', () => {
    // 5.02 km is a 5k, not a 5k plus a split.
    const { distance, time } = evenRun(5020, 300);
    expect(splitsFrom(distance, time)).toHaveLength(5);
  });

  it('interpolates the boundary instead of snapping to the nearest sample', () => {
    // Samples every 400 m never land on a kilometre. Snapping would give
    // splits of 480 s and 120 s; interpolation gives 300 s each.
    const { distance, time } = evenRun(2000, 300, 400);
    const splits = splitsFrom(distance, time);
    expect(splits[0].seconds).toBe(300);
    expect(splits[1].seconds).toBe(300);
  });

  it('catches a genuinely faster kilometre', () => {
    // 1 km at 5:00, then 1 km at 4:00.
    const distance = [0, 1000, 2000];
    const time = [0, 300, 540];
    const splits = splitsFrom(distance, time);
    expect(splits[0].seconds).toBe(300);
    expect(splits[1].seconds).toBe(240);
  });

  it('averages heart rate within each split, not across the run', () => {
    const distance = [0, 500, 1000, 1500, 2000];
    const time = [0, 150, 300, 450, 600];
    const heartrate = [120, 120, 120, 180, 180];
    const splits = splitsFrom(distance, time, { heartrate });
    expect(splits[0].avgHeartRate).toBe(120);
    expect(splits[1].avgHeartRate).toBeGreaterThan(150);
  });

  it('counts climb per split, ignoring metre-scale GPS wander', () => {
    const distance = [0, 500, 1000];
    const time = [0, 150, 300];
    // +50 m of real climb, plus sub-2 m jitter that must not accumulate.
    const altitude = [10, 10.9, 60];
    const splits = splitsFrom(distance, time, { altitude });
    expect(splits[0].elevationGainM).toBe(50);
  });

  describe('the ragged input real GPS produces', () => {
    it('survives distance wandering backwards', () => {
      // A single backward step would otherwise create one absurdly fast split
      // and one absurdly slow one.
      const distance = [0, 400, 380, 800, 1200, 1600, 2000];
      const time = [0, 120, 125, 240, 360, 480, 600];
      const splits = splitsFrom(distance, time);
      expect(splits).toHaveLength(2);
      for (const s of splits) expect(s.seconds).toBeGreaterThan(0);
    });

    it('uses only as much as the shorter stream when lengths disagree', () => {
      const { distance, time } = evenRun(3000, 300);
      expect(() => splitsFrom(distance, time.slice(0, 50))).not.toThrow();
    });

    it('returns nothing for an activity with no distance', () => {
      expect(splitsFrom([], [])).toEqual([]);
      expect(splitsFrom([0, 0, 0], [0, 10, 20])).toEqual([]);
    });

    it('returns nothing rather than throwing on rubbish', () => {
      expect(splitsFrom(null, undefined)).toEqual([]);
      expect(splitsFrom('not an array', 42)).toEqual([]);
      expect(splitsFrom([1, 'x', null], [0, 1, 2])).toEqual([]);
    });

    it('handles a run shorter than one kilometre', () => {
      const { distance, time } = evenRun(600, 300);
      const splits = splitsFrom(distance, time);
      expect(splits).toHaveLength(1);
      expect(splits[0].complete).toBe(false);
    });
  });

  it('splits by mile when asked', () => {
    // 3300 m, not 3218: the generator steps in 10 m, so it stops at the last
    // multiple below the total and two miles would not quite fit.
    const { distance, time } = evenRun(3300, 300);
    const splits = splitsFrom(distance, time, { unitM: 1609 });
    expect(splits.filter((s) => s.complete)).toHaveLength(2);
    expect(splits[0].seconds).toBe(Math.round((1609 / 1000) * 300));
  });
});

describe('zoneDistribution', () => {
  const bands: ZoneBand[] = [
    { zone: 1, name: 'Recovery', fromBpm: 100, toBpm: 120 },
    { zone: 2, name: 'Endurance', fromBpm: 120, toBpm: 140 },
    { zone: 3, name: 'Tempo', fromBpm: 140, toBpm: 160 },
    { zone: 4, name: 'Threshold', fromBpm: 160, toBpm: 180 },
    { zone: 5, name: 'Maximum', fromBpm: 180, toBpm: 200 },
  ];

  it('credits each interval to the zone it ended in', () => {
    const time = [0, 10, 20, 30];
    const hr = [0, 110, 130, 150];
    const { zones } = zoneDistribution(hr, time, bands);
    expect(zones[0].seconds).toBe(10);
    expect(zones[1].seconds).toBe(10);
    expect(zones[2].seconds).toBe(10);
  });

  it('adds up to the elapsed time', () => {
    const time = Array.from({ length: 61 }, (_, i) => i);
    const hr = Array.from({ length: 61 }, () => 150);
    const { zones, unreadSeconds } = zoneDistribution(hr, time, bands);
    const total = zones.reduce((a, z) => a + z.seconds, 0) + unreadSeconds;
    expect(total).toBe(60);
  });

  it('counts a dropped strap separately instead of shortening the session', () => {
    const time = [0, 10, 20, 30];
    const hr = [150, 150, 0, 150];
    const { zones, unreadSeconds } = zoneDistribution(hr, time, bands);
    expect(unreadSeconds).toBe(10);
    expect(zones.reduce((a, z) => a + z.seconds, 0)).toBe(20);
  });

  it('keeps a spike above the assumed maximum rather than losing it', () => {
    const { zones } = zoneDistribution([0, 205], [0, 10], bands);
    expect(zones[4].seconds).toBe(10);
  });

  it('puts a reading below zone one into the easiest zone', () => {
    const { zones } = zoneDistribution([0, 70], [0, 10], bands);
    expect(zones[0].seconds).toBe(10);
  });

  it('ignores a clock that jumps backwards', () => {
    const { zones } = zoneDistribution([150, 150, 150], [0, 100, 50], bands);
    expect(zones[2].seconds).toBe(100);
  });

  it('ignores an implausible gap rather than crediting an hour to one zone', () => {
    const { zones } = zoneDistribution([150, 150], [0, 99999], bands);
    expect(zones.reduce((a, z) => a + z.seconds, 0)).toBe(0);
  });

  it('returns empty bands, not nothing, when there is no heart rate at all', () => {
    const { zones } = zoneDistribution([], [], bands);
    expect(zones).toHaveLength(5);
    expect(zones.every((z) => z.seconds === 0)).toBe(true);
  });
});

describe('chartSeries', () => {
  it('reduces a long stream to the requested number of points', () => {
    const { distance, time } = evenRun(20000, 300, 5);
    const c = chartSeries({ distance, time }, 200)!;
    expect(c.distanceM).toHaveLength(200);
    expect(c.pacePerKm).toHaveLength(200);
  });

  it('does not pad a stream shorter than the target', () => {
    const { distance, time } = evenRun(100, 300, 10);
    const c = chartSeries({ distance, time }, 200)!;
    expect(c.distanceM.length).toBeLessThanOrEqual(11);
  });

  it('averages within buckets rather than sampling every nth point', () => {
    // Alternating 100/200 bpm. Nth-point sampling returns one value or the
    // other depending on parity; averaging returns the truth, ~150.
    const { distance, time } = evenRun(2000, 300, 10);
    const heartrate = distance.map((_, i) => (i % 2 ? 200 : 100));
    const c = chartSeries({ distance, time, heartrate }, 20)!;
    const readings = c.heartrate.filter((v): v is number => v != null);
    expect(readings.length).toBeGreaterThan(0);
    for (const v of readings) expect(Math.abs(v - 150)).toBeLessThan(15);
  });

  it('derives pace from distance and time, not from a velocity stream', () => {
    const { distance, time } = evenRun(5000, 300, 10);
    const c = chartSeries({ distance, time }, 50)!;
    const paces = c.pacePerKm.filter((v): v is number => v != null);
    for (const p of paces) expect(Math.abs(p - 300)).toBeLessThan(20);
  });

  it('reports distance monotonically increasing along the x axis', () => {
    const { distance, time } = evenRun(5000, 300, 10);
    const c = chartSeries({ distance, time }, 50)!;
    for (let i = 1; i < c.distanceM.length; i++) {
      expect(c.distanceM[i]).toBeGreaterThanOrEqual(c.distanceM[i - 1]);
    }
  });

  it('returns nothing for an activity with no usable distance', () => {
    expect(chartSeries({})).toBeNull();
    expect(chartSeries({ distance: [0, 0], time: [0, 10] })).toBeNull();
  });

  it('returns nothing rather than throwing on rubbish', () => {
    expect(chartSeries({ distance: 'nope', time: null })).toBeNull();
  });
});
