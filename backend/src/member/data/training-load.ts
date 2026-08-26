/**
 * ────────────────────────────────────────────────────────────────
 * TRAINING LOAD — how hard, and how much
 * ────────────────────────────────────────────────────────────────
 *
 * Strava calls its version Relative Effort and paywalls it. The maths is not
 * secret: it is Banister's TRIMP, published in 1975 and used by sports science
 * ever since. What follows is that, with the arithmetic stated rather than
 * hidden, so anybody can check what their number means.
 *
 * TRIMP = minutes x HRr x 0.64 x e^(1.92 x HRr)      (male weighting)
 *         where HRr = (HR_avg - HR_rest) / (HR_max - HR_rest)
 *
 * The exponential is the point: an hour easy and an hour hard are not the same
 * training, and a linear "minutes x intensity" says they nearly are.
 *
 * ─── WHEN THERE IS NO HEART RATE ────────────────────────────────────────────
 *
 * Most of our members have no strap. Rather than show nothing, load is
 * estimated from duration and the sport's typical intensity — but the result
 * is MARKED as an estimate everywhere it surfaces. A guess that looks like a
 * measurement is worse than no number, because somebody will train against it.
 */

export type LoadBasis = 'heart_rate' | 'estimated';

export interface LoadInput {
  sportType: string;
  movingSeconds: number | null;
  elapsedSeconds: number;
  avgHeartRate: number | null;
}

export interface LoadResult {
  score: number;
  basis: LoadBasis;
}

/** Defaults when a member has not told us their own. */
export const DEFAULT_HR_REST = 60;
export const DEFAULT_HR_MAX = 190;

/**
 * Typical intensity per sport, as a fraction of heart-rate reserve.
 *
 * Judgement, not physiology: these are the numbers we picked so that an hour
 * of each sport lands somewhere defensible relative to the others. They are
 * the first thing to revisit with real data, and they only ever feed the
 * ESTIMATED path — a member wearing a strap is never subject to them.
 */
const SPORT_INTENSITY: Record<string, number> = {
  run: 0.72, trail_run: 0.74, ride: 0.65, mountain_bike_ride: 0.72,
  gravel_ride: 0.68, e_bike_ride: 0.45, swim: 0.72, walk: 0.35, hike: 0.5,
  hiit: 0.85, crossfit: 0.8, weight_training: 0.55, workout: 0.6,
  rowing: 0.75, elliptical: 0.6, stair_stepper: 0.7, yoga: 0.3,
  pilates: 0.35, physiotherapy: 0.25, tennis: 0.65, padel: 0.6,
  squash: 0.78, badminton: 0.6, football: 0.75, soccer: 0.75,
};
/** Anything unlisted. Middling on purpose — neither flattering nor punishing. */
const DEFAULT_INTENSITY = 0.6;

/** Banister's TRIMP for one bout. */
function trimp(minutes: number, hrReserve: number): number {
  const r = Math.min(Math.max(hrReserve, 0), 1);
  return minutes * r * 0.64 * Math.exp(1.92 * r);
}

/**
 * Load for one activity.
 *
 * Uses MOVING time where we have it: an hour that included twenty minutes
 * standing at traffic lights was not an hour of training.
 */
export function activityLoad(
  input: LoadInput,
  hrRest = DEFAULT_HR_REST,
  hrMax = DEFAULT_HR_MAX,
): LoadResult {
  const seconds = input.movingSeconds ?? input.elapsedSeconds ?? 0;
  const minutes = Math.max(0, seconds) / 60;
  if (minutes <= 0) return { score: 0, basis: 'estimated' };

  // A max at or below rest is a broken profile; falling back beats dividing by
  // zero and reporting an infinite effort.
  const usable = hrMax > hrRest;

  if (input.avgHeartRate && usable && input.avgHeartRate > hrRest) {
    const reserve = (input.avgHeartRate - hrRest) / (hrMax - hrRest);
    return { score: Math.round(trimp(minutes, reserve)), basis: 'heart_rate' };
  }

  const intensity = SPORT_INTENSITY[input.sportType] ?? DEFAULT_INTENSITY;
  return { score: Math.round(trimp(minutes, intensity)), basis: 'estimated' };
}

/* ── Fitness and freshness ─────────────────────────────────────── */

/**
 * The Performance Management Chart, as Coggan defined it:
 *
 *   FITNESS  (CTL) a 42-day exponentially weighted average of daily load —
 *                  what training you have actually banked
 *   FATIGUE  (ATL) the same over 7 days — what you are still carrying
 *   FORM     (TSB) fitness minus fatigue — banked work you have recovered from
 *
 * Exponential rather than a plain rolling mean: a hard session three days ago
 * should weigh more than one thirty days ago, and a flat average says they are
 * equal.
 */
export const FITNESS_DAYS = 42;
export const FATIGUE_DAYS = 7;

export interface DailyLoad {
  /** "YYYY-MM-DD" in the member's own calendar. */
  date: string;
  load: number;
}

export interface FormPoint {
  date: string;
  /** The day's own load — 0 on a rest day. The bars under the curves. */
  load: number;
  fitness: number;
  fatigue: number;
  form: number;
}

/**
 * Walk the series day by day, including REST DAYS.
 *
 * Rest days are the half people forget: fitness decays when you do nothing,
 * and skipping empty days would leave a member who stopped training for a
 * month showing the fitness they had when they stopped.
 */
export function formSeries(
  daily: DailyLoad[],
  from: string,
  to: string,
): FormPoint[] {
  const byDate = new Map(daily.map((d) => [d.date, d.load]));
  const fitnessK = 1 - Math.exp(-1 / FITNESS_DAYS);
  const fatigueK = 1 - Math.exp(-1 / FATIGUE_DAYS);

  let fitness = 0;
  let fatigue = 0;
  const out: FormPoint[] = [];

  for (let d = new Date(`${from}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const load = byDate.get(key) ?? 0;
    fitness += (load - fitness) * fitnessK;
    fatigue += (load - fatigue) * fatigueK;
    out.push({
      date: key,
      load: Math.round(load * 10) / 10,
      fitness: Math.round(fitness * 10) / 10,
      fatigue: Math.round(fatigue * 10) / 10,
      form: Math.round((fitness - fatigue) * 10) / 10,
    });
    if (key >= to) break;
    // A malformed range must not spin forever.
    if (out.length > 800) break;
  }
  return out;
}

/**
 * What the form number means, in words.
 *
 * A signed number nobody can interpret is not insight. The bands are the
 * conventional ones from the same literature; the wording is ours.
 */
export function formAdvice(form: number): { label: string; detail: string } {
  if (form > 20) {
    return {
      label: 'Fresh',
      detail: 'Well recovered. Good for a hard session or a race.',
    };
  }
  if (form > 5) {
    return { label: 'Rested', detail: 'Carrying little fatigue. Room to push.' };
  }
  if (form > -10) {
    return { label: 'Steady', detail: 'Training and recovery are in balance.' };
  }
  if (form > -30) {
    return {
      label: 'Loaded',
      detail: 'Building hard. Normal mid-block, but watch how you feel.',
    };
  }
  return {
    label: 'Very loaded',
    detail: 'A lot of fatigue and little recovery. An easy few days is usually the faster route.',
  };
}

/* ── Heart-rate zones ─────────────────────────────────────── */

export interface ZoneBand {
  zone: number;
  name: string;
  fromBpm: number;
  toBpm: number;
}

/**
 * The five percent-of-reserve (Karvonen) bands.
 *
 * Lives here rather than in the service that first needed it, because two
 * places now depend on the edges being identical: the zones endpoint that
 * tells a member what their bands are, and the per-activity breakdown that
 * says how long they spent in each. Two copies of a band table is exactly the
 * kind of drift that makes a screen disagree with itself.
 */
export function zoneBands(hrMax = DEFAULT_HR_MAX, hrRest = DEFAULT_HR_REST): ZoneBand[] {
  const reserve = Math.max(0, hrMax - hrRest);
  const bands = [
    { zone: 1, name: 'Recovery', from: 0.5, to: 0.6 },
    { zone: 2, name: 'Endurance', from: 0.6, to: 0.7 },
    { zone: 3, name: 'Tempo', from: 0.7, to: 0.8 },
    { zone: 4, name: 'Threshold', from: 0.8, to: 0.9 },
    { zone: 5, name: 'Maximum', from: 0.9, to: 1.0 },
  ];
  return bands.map((b) => ({
    zone: b.zone,
    name: b.name,
    fromBpm: Math.round(hrRest + reserve * b.from),
    toBpm: Math.round(hrRest + reserve * b.to),
  }));
}
