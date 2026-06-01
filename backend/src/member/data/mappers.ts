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

/** member_profiles.fitness_goal → contract goal enum. */
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

/** Count consecutive days ending today/yesterday from a set of check-in dates. */
export function computeStreakDays(checkInDates: Date[]): number {
  const days = new Set(
    checkInDates.map((d) => new Date(d).toISOString().slice(0, 10)),
  );
  if (days.size === 0) return 0;

  const oneDay = 86_400_000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Streak may count from today or yesterday (today not yet visited is OK).
  let cursor = today;
  const todayStr = today.toISOString().slice(0, 10);
  if (!days.has(todayStr)) {
    cursor = new Date(today.getTime() - oneDay);
    if (!days.has(cursor.toISOString().slice(0, 10))) return 0;
  }

  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
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
