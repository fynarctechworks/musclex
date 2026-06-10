import { useAuth } from './auth-store';
import type { MeCapabilities, MeMembership, UserType } from '../api/types';

/**
 * The single hook screens + navigation read to decide what to show. Mirrors the
 * backend capability matrix (member-context.service.ts) so the UI degrades
 * gracefully while /me/context is still loading or offline:
 *   - context loaded     → use its userType + capabilities (source of truth)
 *   - loading w/ a gym    → assume 'member' (stored session had a tenant) so a
 *                           returning member's tabs don't flash to the public set
 *   - loading w/o a gym   → assume 'public'
 */
function capabilitiesFor(userType: UserType): MeCapabilities {
  const isMember = userType === 'member';
  const isExpired = userType === 'expired';
  const isSuspended = userType === 'suspended';
  const hasGym = isMember || isExpired || isSuspended;
  return {
    membershipCard: hasGym,
    gymSuspended: isSuspended,
    attendance: isMember,
    classBooking: isMember,
    gymSchedule: isMember,
    gymAnnouncements: isMember,
    trainerChat: isMember,
    subscriptionDetails: hasGym,
    memberBenefits: isMember,
    renewMembership: isExpired,
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
}

export interface Capabilities {
  userType: UserType;
  capabilities: MeCapabilities;
  memberships: MeMembership[];
  isPublic: boolean;
  isMember: boolean;
  isExpired: boolean;
  /** true when the member's gym is operator-suspended (show banner, hide gym features). */
  isSuspended: boolean;
  /** the name of a suspended gym, when isSuspended — for the banner copy. */
  suspendedGymName: string | null;
  /** true once /me/context has actually loaded (not the loading fallback). */
  resolved: boolean;
}

export function useCapabilities(): Capabilities {
  const context = useAuth((s) => s.context);
  const tenantId = useAuth((s) => s.tenantId);

  const userType: UserType =
    context?.userType ?? (tenantId ? 'member' : 'public');
  const capabilities = context?.capabilities ?? capabilitiesFor(userType);
  const memberships = context?.memberships ?? [];
  const isSuspended = userType === 'suspended';

  return {
    userType,
    capabilities,
    memberships,
    isPublic: userType === 'public',
    isMember: userType === 'member',
    isExpired: userType === 'expired',
    isSuspended,
    suspendedGymName: isSuspended
      ? (memberships.find((m) => m.suspended)?.gymName ?? null)
      : null,
    resolved: !!context,
  };
}
