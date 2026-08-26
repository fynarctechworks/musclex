/**
 * ────────────────────────────────────────────────────────────────
 * ACTIVITY ANALYSIS — turning recorded streams into what people read
 * ────────────────────────────────────────────────────────────────
 *
 * A recorded activity arrives as parallel arrays: cumulative distance, elapsed
 * time, heart rate, altitude, one entry per GPS fix. Nobody wants to read
 * that. What they want is "which kilometre was I fastest", "how long was I in
 * threshold", and a line they can glance at.
 *
 * All of it is computed HERE rather than on the phone, because the raw series
 * is up to 36,000 points per stream and shipping it to render three charts is
 * megabytes to draw a few hundred pixels.
 *
 * Every function tolerates ragged input. Streams come from GPS on a phone in a
 * pocket, from imported GPX written by somebody else's software, and from
 * watches that pause differently — arrays of mismatched length, non-monotonic
 * distance, and missing samples are normal, not exceptional.
 */

export interface Split {
  /** 1-based. The first kilometre is split 1. */
  index: number;
  distanceM: number;
  seconds: number;
  /** Seconds per kilometre. */
  pacePerKm: number;
  avgHeartRate: number | null;
  elevationGainM: number | null;
  /** False for a trailing part-kilometre, which must not be ranked as a lap. */
  complete: boolean;
}

/** Longest series we will walk. Matches the ingest cap in the activity service. */
const MAX_SAMPLES = 36_000;

function numbers(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const v of raw.slice(0, MAX_SAMPLES)) {
    const n = Number(v);
    out.push(Number.isFinite(n) ? n : NaN);
  }
  return out;
}

/**
 * Force a cumulative series to never decrease.
 *
 * GPS distance wanders backwards when accuracy drops, and a single backward
 * step turns one kilometre split into two — one absurdly fast, one absurdly
 * slow. Carrying the running maximum forward is the cheapest correct fix.
 */
function monotonic(values: number[]): number[] {
  const out: number[] = [];
  let best = 0;
  for (const v of values) {
    if (Number.isFinite(v) && v > best) best = v;
    out.push(best);
  }
  return out;
}

/** Linear interpolation of `ys` at the point where `xs` crosses `target`. */
function interpolateAt(xs: number[], ys: number[], target: number, from: number): { value: number; index: number } | null {
  for (let i = Math.max(1, from); i < xs.length; i++) {
    if (xs[i] >= target) {
      const dx = xs[i] - xs[i - 1];
      const t = dx > 0 ? (target - xs[i - 1]) / dx : 0;
      return { value: ys[i - 1] + (ys[i] - ys[i - 1]) * t, index: i };
    }
  }
  return null;
}

function meanOf(values: number[], from: number, to: number): number | null {
  let sum = 0;
  let n = 0;
  for (let i = from; i <= to && i < values.length; i++) {
    if (Number.isFinite(values[i]) && values[i] > 0) {
      sum += values[i];
      n++;
    }
  }
  return n > 0 ? Math.round(sum / n) : null;
}

/** Climb between two indices, ignoring metre-scale GPS altitude wander. */
function climbOf(alt: number[], from: number, to: number): number | null {
  if (alt.length === 0) return null;
  let gain = 0;
  let last: number | null = null;
  for (let i = from; i <= to && i < alt.length; i++) {
    const v = alt[i];
    if (!Number.isFinite(v)) continue;
    if (last === null) { last = v; continue; }
    const d = v - last;
    if (Math.abs(d) < 2) continue;
    if (d > 0) gain += d;
    last = v;
  }
  return Math.round(gain);
}

/**
 * Per-kilometre splits.
 *
 * Boundaries are INTERPOLATED rather than snapped to the nearest sample. At a
 * 6-second recording interval a runner covers ~20 m between fixes, so snapping
 * scatters each split by several seconds — enough to make an even pace look
 * ragged and to crown the wrong kilometre as the fastest.
 */
export function splitsFrom(
  distanceRaw: unknown,
  timeRaw: unknown,
  opts: { heartrate?: unknown; altitude?: unknown; unitM?: number } = {},
): Split[] {
  const unit = opts.unitM && opts.unitM > 0 ? opts.unitM : 1000;
  const distance = monotonic(numbers(distanceRaw));
  const time = numbers(timeRaw);
  const hr = numbers(opts.heartrate);
  const alt = numbers(opts.altitude);

  const n = Math.min(distance.length, time.length);
  if (n < 2) return [];

  const total = distance[n - 1];
  if (!(total > 0)) return [];

  const out: Split[] = [];
  let prevDistance = 0;
  let prevTime = time[0] ?? 0;
  let prevIndex = 0;

  const full = Math.floor(total / unit);
  for (let k = 1; k <= full; k++) {
    const target = k * unit;
    const hit = interpolateAt(distance.slice(0, n), time.slice(0, n), target, prevIndex);
    if (!hit) break;
    const seconds = hit.value - prevTime;
    out.push({
      index: k,
      distanceM: unit,
      seconds: Math.round(seconds),
      pacePerKm: seconds > 0 ? Math.round((seconds / unit) * 1000) : 0,
      avgHeartRate: meanOf(hr, prevIndex, hit.index),
      elevationGainM: climbOf(alt, prevIndex, hit.index),
      complete: true,
    });
    prevDistance = target;
    prevTime = hit.value;
    prevIndex = hit.index;
  }

  // The tail. Reported so the distances add up to the activity, and flagged
  // incomplete so nothing ranks a 200 m sprint against a full kilometre.
  const tail = total - prevDistance;
  if (tail > unit * 0.05) {
    const seconds = time[n - 1] - prevTime;
    out.push({
      index: out.length + 1,
      distanceM: Math.round(tail),
      seconds: Math.round(seconds),
      pacePerKm: seconds > 0 && tail > 0 ? Math.round((seconds / tail) * 1000) : 0,
      avgHeartRate: meanOf(hr, prevIndex, n - 1),
      elevationGainM: climbOf(alt, prevIndex, n - 1),
      complete: false,
    });
  }

  return out;
}

export interface ZoneSlice {
  zone: number;
  name: string;
  fromBpm: number;
  toBpm: number;
  seconds: number;
}

export interface ZoneBand {
  zone: number;
  name: string;
  fromBpm: number;
  toBpm: number;
}

/**
 * How long was spent in each heart-rate zone.
 *
 * Time is attributed to the zone the reading was in for the interval ENDING at
 * that sample, which is the convention every training platform uses. Samples
 * with no reading are counted separately rather than silently dropped — a
 * strap that disconnected for ten minutes should not quietly shorten the
 * session.
 */
export function zoneDistribution(
  heartrateRaw: unknown,
  timeRaw: unknown,
  bands: ZoneBand[],
): { zones: ZoneSlice[]; unreadSeconds: number } {
  const hr = numbers(heartrateRaw);
  const time = numbers(timeRaw);
  const n = Math.min(hr.length, time.length);

  const zones: ZoneSlice[] = bands.map((b) => ({ ...b, seconds: 0 }));
  let unreadSeconds = 0;
  if (n < 2) return { zones, unreadSeconds };

  for (let i = 1; i < n; i++) {
    const dt = time[i] - time[i - 1];
    // A backwards or absurd gap means the clock stream is unusable at this
    // point; skipping is safer than crediting an hour to zone 1.
    if (!Number.isFinite(dt) || dt <= 0 || dt > 3600) continue;

    const bpm = hr[i];
    if (!Number.isFinite(bpm) || bpm <= 0) {
      unreadSeconds += dt;
      continue;
    }

    // Bands are contiguous; the last one absorbs anything above it so a spike
    // above the assumed maximum is still counted rather than lost.
    let placed = false;
    for (let z = 0; z < zones.length; z++) {
      const last = z === zones.length - 1;
      if (bpm >= zones[z].fromBpm && (bpm < zones[z].toBpm || last)) {
        zones[z].seconds += dt;
        placed = true;
        break;
      }
    }
    // Below zone 1 is a real reading of a resting heart — it belongs in the
    // easiest zone, not in "no reading".
    if (!placed) zones[0].seconds += dt;
  }

  for (const z of zones) z.seconds = Math.round(z.seconds);
  return { zones, unreadSeconds: Math.round(unreadSeconds) };
}

export interface ChartSeries {
  /** Cumulative distance in metres at each point, for the x axis. */
  distanceM: number[];
  heartrate: (number | null)[];
  altitude: (number | null)[];
  /** Seconds per kilometre at each point. */
  pacePerKm: (number | null)[];
}

/**
 * A chart-sized view of the streams.
 *
 * Reduced by BUCKET AVERAGING rather than by taking every nth sample: nth-point
 * sampling on a noisy series keeps whichever spikes happen to land on the
 * stride and drops the rest, so the same ride can look calm or violent
 * depending on its length. Averaging within each bucket is stable.
 *
 * Pace is derived from distance and time here rather than read from the
 * velocity stream, because velocity is often absent on imported files while
 * distance and time essentially always exist.
 */
export function chartSeries(
  streams: Record<string, unknown>,
  points = 200,
): ChartSeries | null {
  const distance = monotonic(numbers(streams.distance));
  const time = numbers(streams.time);
  const hr = numbers(streams.heartrate);
  const alt = numbers(streams.altitude);

  const n = Math.min(distance.length, time.length);
  if (n < 2 || !(distance[n - 1] > 0)) return null;

  const buckets = Math.min(points, n);
  const per = n / buckets;

  const out: ChartSeries = { distanceM: [], heartrate: [], altitude: [], pacePerKm: [] };

  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * per);
    const to = Math.min(n - 1, Math.floor((b + 1) * per) - 1);
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);

    out.distanceM.push(Math.round(distance[hi]));
    out.heartrate.push(meanOf(hr, lo, hi));
    out.altitude.push(alt.length ? Math.round(avg(alt, lo, hi) ?? 0) || null : null);

    const dd = distance[hi] - distance[lo];
    const dt = time[hi] - time[lo];
    out.pacePerKm.push(dd > 0 && dt > 0 ? Math.round((dt / dd) * 1000) : null);
  }

  return out;
}

function avg(values: number[], from: number, to: number): number | null {
  let sum = 0;
  let n = 0;
  for (let i = from; i <= to && i < values.length; i++) {
    if (Number.isFinite(values[i])) { sum += values[i]; n++; }
  }
  return n > 0 ? sum / n : null;
}
