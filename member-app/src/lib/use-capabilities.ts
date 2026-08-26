import { useMemberContext } from '../api/queries';
import type { MemberCapabilities } from '../api/types';

/**
 * ────────────────────────────────────────────────────────────────
 * WHO IS USING THE APP
 * ────────────────────────────────────────────────────────────────
 *
 * Two people install this app and they are not the same person.
 *
 *   A GYM MEMBER checks in, books classes, follows a plan their trainer set,
 *   and talks to that trainer.
 *
 *   AN INDEPENDENT USER has no gym at all. They came for routines, water,
 *   steps and meals. Every gym feature is a locked door to them, and the
 *   server returns a clean 403 on all of it.
 *
 * The app used to render one navigation for both, which is why the second
 * person's home screen was a column of empty cards about a gym they have never
 * been to. The server has always known the difference — `userType` and a
 * per-feature `capabilities` map — and the app simply never asked.
 *
 * Defaults are DENY. While the context is loading, or if the request fails, no
 * gym feature is offered. Showing a button that 403s is worse than showing
 * nothing, and an independent user must never see a gym door flash into
 * existence and then disappear.
 */

const DENY: MemberCapabilities = {
  membershipCard: false,
  gymSuspended: false,
  attendance: false,
  classBooking: false,
  gymSchedule: false,
  gymAnnouncements: false,
  trainerChat: false,
  subscriptionDetails: false,
  memberBenefits: false,
  renewMembership: false,
  // The self-tracking half is what an independent user came for, so it stays
  // on while we find out who they are. These endpoints work without a gym.
  healthDashboard: true,
  weightTracking: true,
  waterTracking: true,
  goalTracking: true,
  bmiCalculator: true,
  calorieCalculator: true,
  fitnessTips: true,
  nearbyGyms: true,
  referralProgram: true,
};

export interface Who {
  loading: boolean;
  /** True once we know they belong to at least one gym. */
  hasGym: boolean;
  /** True when the membership exists but is paused — different from no gym. */
  suspended: boolean;
  gymName: string | null;
  firstName: string | null;
  can: MemberCapabilities;
}

export function useWho(): Who {
  const { data, isLoading } = useMemberContext();

  const active = data?.memberships?.find((m) => m.active) ?? null;
  const hasGym = data?.userType === 'member' && !!active;

  return {
    loading: isLoading,
    hasGym,
    suspended: !!data?.capabilities?.gymSuspended || !!active?.suspended,
    gymName: active?.gymName ?? null,
    // First name only. "Good evening, Priya Sharma" is a form field talking to
    // you; "Good evening, Priya" is a person.
    firstName: data?.fullName ? data.fullName.trim().split(/\s+/)[0] : null,
    can: data?.capabilities ?? DENY,
  };
}
