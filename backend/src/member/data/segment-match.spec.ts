import {
  matchSegment,
  trackFromStreams,
  MATCH_TOLERANCE_M,
  type SegmentShape,
  type TrackPoint,
} from './segment-match';

/**
 * The one failure this must never have: awarding a time on a segment the
 * member did not actually ride. Every test below is a way that could happen.
 *
 * Tracks run due north so distance is easy to reason about: 1 degree of
 * latitude is ~111,320 m, so 0.00009 degrees is ~10 m.
 */
const STEP_DEG = 10 / 111_320; // ~10 m per point

/** `n` points heading north, one second apart, starting at lat0. */
const northTrack = (n: number, lat0 = 17.7, secondsPer = 1): TrackPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    lat: lat0 + i * STEP_DEG,
    lng: 83.3,
    t: i * secondsPer,
  }));

/** A segment covering points [a, b] of such a track. */
const segmentOver = (a: number, b: number, lat0 = 17.7): SegmentShape => ({
  start: { lat: lat0 + a * STEP_DEG, lng: 83.3 },
  end: { lat: lat0 + b * STEP_DEG, lng: 83.3 },
  distanceM: (b - a) * 10,
});

describe('matchSegment — a genuine ride', () => {
  it('finds the effort and times it', () => {
    const effort = matchSegment(northTrack(100), segmentOver(20, 60));
    expect(effort).not.toBeNull();
    expect(effort!.startIndex).toBe(20);
    expect(effort!.endIndex).toBe(60);
    expect(effort!.elapsedSeconds).toBe(40);
  });

  it('times from the track, not from the segment length', () => {
    // Same segment, ridden at half the speed: two seconds per point.
    const effort = matchSegment(northTrack(100, 17.7, 2), segmentOver(20, 60));
    expect(effort!.elapsedSeconds).toBe(80);
  });

  it('matches a segment that starts where the activity does', () => {
    expect(matchSegment(northTrack(50), segmentOver(0, 30))).not.toBeNull();
  });

  it('matches one that ends where the activity does', () => {
    expect(matchSegment(northTrack(50), segmentOver(20, 49))).not.toBeNull();
  });
});

describe('matchSegment — what it must refuse', () => {
  it('refuses a segment ridden the WRONG WAY', () => {
    // Reversing a climb is a descent. Matching it backwards would put a
    // downhill time on an uphill leaderboard.
    const reversed: SegmentShape = {
      start: { lat: 17.7 + 60 * STEP_DEG, lng: 83.3 },
      end: { lat: 17.7 + 20 * STEP_DEG, lng: 83.3 },
      distanceM: 400,
    };
    expect(matchSegment(northTrack(100), reversed)).toBeNull();
  });

  it('refuses when the track only reaches the start', () => {
    // Being near the beginning proves nothing at all.
    const track = northTrack(30);
    expect(matchSegment(track, segmentOver(20, 60))).toBeNull();
  });

  it('refuses when the track only passes the END', () => {
    // Driving past the far end of a segment is the classic false KOM.
    const track = northTrack(100, 17.7 + 50 * STEP_DEG);
    expect(matchSegment(track, segmentOver(0, 40))).toBeNull();
  });

  it('refuses a segment on a different road entirely', () => {
    const elsewhere: SegmentShape = {
      start: { lat: 28.61, lng: 77.20 },
      end: { lat: 28.62, lng: 77.20 },
      distanceM: 1000,
    };
    expect(matchSegment(northTrack(100), elsewhere)).toBeNull();
  });

  it('refuses a track that wanders off and rejoins', () => {
    // It touched both ends, but covered three times the ground doing it —
    // that is not riding the segment.
    const track: TrackPoint[] = [
      ...northTrack(21),
      // A long detour east and back before continuing.
      ...Array.from({ length: 60 }, (_, i) => ({
        lat: 17.7 + 21 * STEP_DEG,
        lng: 83.3 + (i < 30 ? i : 60 - i) * STEP_DEG,
        t: 21 + i,
      })),
      ...Array.from({ length: 40 }, (_, i) => ({
        lat: 17.7 + (21 + i) * STEP_DEG,
        lng: 83.3,
        t: 81 + i,
      })),
    ];
    expect(matchSegment(track, segmentOver(20, 60))).toBeNull();
  });

  it('refuses a track too short to be anything', () => {
    expect(matchSegment([], segmentOver(0, 10))).toBeNull();
    expect(matchSegment(northTrack(1), segmentOver(0, 10))).toBeNull();
  });

  it('refuses a segment with no length', () => {
    expect(matchSegment(northTrack(50), { ...segmentOver(10, 20), distanceM: 0 })).toBeNull();
  });

  it('refuses an effort that took no time', () => {
    // Every point stamped identically — a broken upload, not a teleport.
    const frozen = northTrack(100).map((p) => ({ ...p, t: 0 }));
    expect(matchSegment(frozen, segmentOver(20, 60))).toBeNull();
  });
});

describe('matchSegment — the tolerance boundary', () => {
  it('accepts a track running parallel but within tolerance', () => {
    // A GPS trace never sits exactly on the stored line.
    const offset = (MATCH_TOLERANCE_M - 10) / 111_320;
    const track = northTrack(100).map((p) => ({ ...p, lng: 83.3 + offset }));
    expect(matchSegment(track, segmentOver(20, 60))).not.toBeNull();
  });

  it('refuses a track on the next street over', () => {
    const offset = (MATCH_TOLERANCE_M + 40) / 111_320;
    const track = northTrack(100).map((p) => ({ ...p, lng: 83.3 + offset }));
    expect(matchSegment(track, segmentOver(20, 60))).toBeNull();
  });
});

describe('matchSegment — laps', () => {
  it('returns the FIRST complete pass, not the best', () => {
    // Picking the best would reward doing laps until one comes out fast.
    const lap = northTrack(60);
    const second = northTrack(60).map((p) => ({ ...p, t: p.t + 200 }));
    const effort = matchSegment([...lap, ...second], segmentOver(10, 40));
    expect(effort!.startIndex).toBe(10);
    expect(effort!.elapsedSeconds).toBe(30);
  });
});

describe('trackFromStreams', () => {
  it('zips coordinates and times together', () => {
    const out = trackFromStreams([[17.7, 83.3], [17.71, 83.3]], [0, 10]);
    expect(out).toEqual([
      { lat: 17.7, lng: 83.3, t: 0 },
      { lat: 17.71, lng: 83.3, t: 10 },
    ]);
  });

  it('stops at the shorter stream rather than reading past the end', () => {
    // A partial upload can leave these different lengths.
    expect(trackFromStreams([[1, 2], [3, 4], [5, 6]], [0, 1])).toHaveLength(2);
  });

  it('drops malformed points instead of trusting them', () => {
    const out = trackFromStreams(
      [[17.7, 83.3], 'nope', [999, 83.3], [17.71, null], [17.72, 83.3]],
      [0, 1, 2, 3, 4],
    );
    expect(out.map((p) => p.t)).toEqual([0, 4]);
  });

  it('returns nothing for input that is not a pair of arrays', () => {
    expect(trackFromStreams(null, null)).toEqual([]);
    expect(trackFromStreams({}, [1, 2])).toEqual([]);
  });
});
