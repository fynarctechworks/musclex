/**
 * ────────────────────────────────────────────────────────────────
 * GPS RECORDER — the maths behind a recorded activity
 * ────────────────────────────────────────────────────────────────
 *
 * Pure functions, no expo-location import, so every rule below is testable
 * without a device. The screen owns the subscription; this owns the truth.
 *
 * A naive recorder that simply sums the distance between consecutive fixes
 * produces numbers that are visibly wrong, and members notice immediately —
 * "it said 12 km and I ran 10" is the complaint that kills a tracker. Three
 * filters do most of the work:
 *
 *   ACCURACY   A fix the phone itself rates worse than ~30 m is noise. Standing
 *              still under a roof, consecutive noisy fixes scatter tens of
 *              metres apart and silently accumulate kilometres.
 *   PLAUSIBILITY  A jump implying a speed nobody reaches under their own power
 *              is a GPS glitch, not a sprint.
 *   ELEVATION  GPS altitude wanders by several metres at rest. Counting every
 *              rise turns a flat park run into 300 m of climbing, so only
 *              sustained gain counts.
 */

export interface GeoSample {
  lat: number;
  lng: number;
  /** Epoch ms. */
  at: number;
  /** Metres of horizontal accuracy, as reported by the OS. */
  accuracy?: number | null;
  altitude?: number | null;
  /** m/s from the OS, when it has one. */
  speed?: number | null;
}

export interface RecordState {
  startedAt: number;
  points: GeoSample[];
  distanceM: number;
  elevationGainM: number;
  /** Wall clock, excluding time spent manually paused. */
  elapsedMs: number;
  /** Excludes auto-paused time too — the number a pace should be built from. */
  movingMs: number;
  lastAt: number | null;
  /** Altitude the gain was last counted from. */
  lastCountedAltitude: number | null;
  paused: boolean;
  autoPaused: boolean;
  /** How long the member has been below the moving threshold. */
  stillMs: number;
  maxSpeedMps: number;
}

/** Worse than this and the fix is noise rather than a position. */
export const ACCURACY_LIMIT_M = 30;
/** 30 m/s is 108 km/h — beyond anything human-powered. */
export const MAX_PLAUSIBLE_MPS = 30;
/** Below this counts as standing still. */
export const STILL_MPS = 0.5;
/** And above this counts as going again. Hysteresis, or the state flickers. */
export const MOVING_MPS = 1.0;
/** Time below STILL_MPS before auto-pause engages. */
export const AUTO_PAUSE_MS = 10_000;
/** Altitude must rise by this much before any of it counts. */
export const ELEVATION_NOISE_M = 2;

export function newRecording(startedAt: number): RecordState {
  return {
    startedAt,
    points: [],
    distanceM: 0,
    elevationGainM: 0,
    elapsedMs: 0,
    movingMs: 0,
    lastAt: null,
    lastCountedAltitude: null,
    paused: false,
    autoPaused: false,
    stillMs: 0,
    maxSpeedMps: 0,
  };
}

const R = 6_371_000; // mean Earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineM(a: GeoSample, b: GeoSample): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Fold one fix into the recording.
 *
 * Returns a NEW state — the screen keeps this in a ref and re-renders from it,
 * and a mutating reducer here would make a dropped frame lose a segment.
 */
export function accept(state: RecordState, s: GeoSample): RecordState {
  // A manually paused recording keeps its clock still and ignores the world.
  if (state.paused) return state;

  // Too vague to be a position.
  if (s.accuracy != null && s.accuracy > ACCURACY_LIMIT_M) return state;

  const prev = state.points[state.points.length - 1];

  // Re-anchor without crediting anything: the first fix of the recording, and
  // the first after a pause. `lastAt` is the clock reference, NOT prev.at —
  // ten minutes waiting at a crossing would otherwise all land on the segment
  // after resuming and destroy the pace for it.
  if (!prev || state.lastAt == null) {
    return {
      ...state,
      points: [...state.points, s],
      lastAt: s.at,
      stillMs: 0,
      // Reset the climb reference too, or a hill climbed while paused counts.
      lastCountedAltitude: s.altitude ?? state.lastCountedAltitude,
    };
  }

  const dtMs = s.at - state.lastAt;
  // Out-of-order or duplicate fixes arrive on real devices; both would produce
  // a negative or infinite speed.
  if (dtMs <= 0) return state;

  const dM = haversineM(prev, s);
  const mps = dM / (dtMs / 1000);

  // A teleport: keep the fix as the new anchor but do not credit the distance,
  // or one glitch adds a permanent kilometre.
  if (mps > MAX_PLAUSIBLE_MPS) {
    return { ...state, points: [...state.points, s], lastAt: s.at };
  }

  const still = mps < STILL_MPS;
  const stillMs = still ? state.stillMs + dtMs : 0;
  const autoPaused = still
    ? state.autoPaused || stillMs >= AUTO_PAUSE_MS
    : mps > MOVING_MPS
      ? false
      : state.autoPaused;

  // Elevation only counts once it has risen clear of the noise floor.
  let elevationGainM = state.elevationGainM;
  let lastCountedAltitude = state.lastCountedAltitude;
  if (s.altitude != null) {
    if (lastCountedAltitude == null) {
      lastCountedAltitude = s.altitude;
    } else if (s.altitude - lastCountedAltitude >= ELEVATION_NOISE_M) {
      elevationGainM += s.altitude - lastCountedAltitude;
      lastCountedAltitude = s.altitude;
    } else if (s.altitude < lastCountedAltitude) {
      // Descending resets the reference so the next climb is measured from the
      // bottom, not from the previous summit.
      lastCountedAltitude = s.altitude;
    }
  }

  return {
    ...state,
    points: [...state.points, s],
    distanceM: state.distanceM + dM,
    elevationGainM,
    lastCountedAltitude,
    elapsedMs: state.elapsedMs + dtMs,
    movingMs: state.movingMs + (autoPaused ? 0 : dtMs),
    lastAt: s.at,
    autoPaused,
    stillMs,
    maxSpeedMps: Math.max(state.maxSpeedMps, mps),
  };
}

export function pause(state: RecordState): RecordState {
  return { ...state, paused: true };
}

export function resume(state: RecordState): RecordState {
  // Drop lastAt so the gap while paused is not billed to the next segment.
  return { ...state, paused: false, autoPaused: false, stillMs: 0, lastAt: null };
}

/** Average pace in seconds per kilometre, or null when nothing has moved. */
export function pacePerKm(distanceM: number, movingMs: number): number | null {
  if (distanceM < 10 || movingMs <= 0) return null;
  return movingMs / 1000 / (distanceM / 1000);
}

export function avgSpeedMps(distanceM: number, movingMs: number): number | null {
  if (movingMs <= 0) return null;
  return distanceM / (movingMs / 1000);
}

/**
 * Google encoded polyline, precision 5 — what the map preview stores.
 *
 * Encoded rather than a JSON array of pairs because the summary row is read by
 * every feed card: ~11,000 points is roughly 250 KB as JSON and about 60 KB
 * encoded, and only the encoded copy is small enough to sit on the row.
 */
export function encodePolyline(points: { lat: number; lng: number }[]): string {
  let out = '';
  let lastLat = 0;
  let lastLng = 0;

  const chunk = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return s + String.fromCharCode(n + 63);
  };

  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    out += chunk(lat - lastLat) + chunk(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}

/**
 * Thin a track before encoding.
 *
 * A map preview a few hundred pixels wide cannot show 11,000 points, and the
 * row it sits on should not carry them. Every nth point, keeping the last, so
 * the shape survives and the finish is never clipped.
 */
export function simplify<T>(points: T[], max = 400): T[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out = points.filter((_, i) => i % step === 0);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/** "1:04:12" or "7:41" — a clock, not a duration sentence. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
