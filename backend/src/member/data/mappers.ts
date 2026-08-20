import type {
  MemberProfileData,
  MembershipData,
  OccupancyData,
} from '../contract';

/** Decimal/Prisma numeric → plain number (Prisma Decimal serializes as object). */
export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number((v as { toString(): string }).toString());
  return Number.isFinite(n) ? n : null;
}

/** member_profiles.fitness_goal → legacy contract goal enum (3-value, back-compat). */
export function mapGoal(fitnessGoal?: string | null): MemberProfileData['goal'] {
  switch (fitnessGoal) {
    case 'weight_loss':
      return 'lose_fat';
    case 'muscle_gain':
      return 'build_muscle';
    default:
      return 'general_fitness';
  }
}

/**
 * Rich onboarding goal (FitnessGoal) → legacy `member_profiles.fitness_goal`
 * vocabulary, so we keep that column meaningful for admin tooling / the legacy
 * `goal` field. Many-to-few, intentionally lossy.
 */
export function primaryGoalToLegacy(
  primary?: string | null,
): string | undefined {
  switch (primary) {
    case 'lose_weight':
      return 'weight_loss';
    case 'gain_muscle':
    case 'build_strength':
    case 'body_recomposition':
      return 'muscle_gain';
    case 'improve_endurance':
    case 'athletic_performance':
      return 'endurance';
    case 'improve_fitness':
    case 'stay_healthy':
      return 'general_fitness';
    default:
      return undefined;
  }
}

/**
 * Legacy `member_profiles.fitness_goal` → a FitnessGoal, used to surface a
 * `primaryGoal` for members onboarded before goals[] existed (back-compat).
 */
export function legacyToPrimaryGoal(
  fitnessGoal?: string | null,
): MemberProfileData['primaryGoal'] {
  switch (fitnessGoal) {
    case 'weight_loss':
      return 'lose_weight';
    case 'muscle_gain':
      return 'gain_muscle';
    case 'endurance':
      return 'improve_endurance';
    case 'rehabilitation':
      return 'stay_healthy';
    case 'general_fitness':
      return 'improve_fitness';
    default:
      return undefined;
  }
}

/** Whole days from now until `end` (negative if past). null when no end date. */
export function daysUntil(end?: Date | null): number | undefined {
  if (!end) return undefined;
  const ms = new Date(end).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/**
 * member_memberships.status (+ expiry) → contract status (active|expiring|expired|frozen).
 * "expiring" = active with ≤7 days left (PRD warns at ≤7 days).
 */
export function mapMembershipStatus(
  status: string | null | undefined,
  endDate?: Date | null,
): NonNullable<MembershipData['status']> {
  if (status === 'frozen' || status === 'paused') return 'frozen';
  if (status === 'expired' || status === 'cancelled') return 'expired';
  if (status === 'active') {
    const left = daysUntil(endDate);
    if (left !== undefined && left <= 7) return 'expiring';
    return 'active';
  }
  // pending / renewed / unknown → treat as expired for the member view
  return 'expired';
}

/** Occupancy level from current vs capacity; falls back to absolute buckets. */
export function occupancyLevel(
  current: number,
  capacity: number,
): NonNullable<OccupancyData['level']> {
  if (capacity > 0) {
    const ratio = current / capacity;
    if (ratio >= 1) return 'full';
    if (ratio >= 0.75) return 'high';
    if (ratio >= 0.4) return 'moderate';
    return 'low';
  }
  // No known capacity — coarse absolute buckets.
  if (current >= 80) return 'full';
  if (current >= 50) return 'high';
  if (current >= 20) return 'moderate';
  return 'low';
}

/**
 * Count consecutive days ending today/yesterday from a set of activity dates.
 * Source-agnostic: dates may come from check-ins, workout logs, meal logs, or a
 * union of all three (see MemberStreakService). Multiple entries on the same
 * calendar day collapse to one — the Set keys on the day, not the timestamp.
 */
export function computeStreakDays(
  activityDates: Date[],
  /**
   * The member's offset from UTC in MINUTES EAST (IST = +330).
   *
   * Was implicit before: the day was keyed with getFullYear()/getMonth(),
   * which is the SERVER's calendar. That is correct only while the server and
   * the member happen to share a timezone — true on a dev box set to
   * Asia/Calcutta, false the moment this runs on a UTC host, and it fails
   * silently in both directions.
   */
  tzOffsetMinutes = 0,
): number {
  // Key on the LOCAL calendar day, never toISOString().
  //
  // The old version mixed the two: `today` was local midnight but was then
  // formatted with toISOString(), which shifts back across the date line for
  // any timezone ahead of UTC. In IST (+5:30) local midnight on the 4th
  // formats as the 3rd, while an activity logged that morning formats as the
  // 4th — so "did I train today?" never matched and the streak silently reset
  // or came back one short. It only looked correct because the tests run under
  // TZ=UTC, where the shift is zero.
  // Shift into the member's offset, then read the date in UTC. One rule for
  // both the activity dates and "today", so they cannot disagree.
  const dayKey = (d: Date) =>
    new Date(d.getTime() + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);

  const days = new Set(activityDates.map((d) => dayKey(new Date(d))));
  if (days.size === 0) return 0;

  const oneDay = 86_400_000;
  // Midnight of the member's today, expressed as the UTC instant of that
  // local date — so stepping back a day at a time stays exact.
  const today = new Date(`${dayKey(new Date())}T00:00:00Z`);

  // Streak may count from today or yesterday (today not yet visited is OK).
  let cursor = today;
  if (!days.has(dayKey(today))) {
    cursor = new Date(today.getTime() - oneDay);
    if (!days.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - oneDay);
  }
  return streak;
}

/** Greeting based on local hour. */
export function greeting(name: string | null | undefined): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const first = (name ?? '').trim().split(/\s+/)[0] || 'there';
  return `Good ${part}, ${first}`;
}
