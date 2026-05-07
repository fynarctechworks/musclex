import { BadRequestException } from '@nestjs/common';

/**
 * Valid status transitions for Member and Membership entities.
 * Any transition not listed here is illegal and will throw.
 */

const MEMBER_TRANSITIONS: Record<string, string[]> = {
  lead:          ['active', 'cancelled'],
  active:        ['frozen', 'expired', 'cancelled', 'expiring_soon'],
  expiring_soon: ['active', 'expired', 'cancelled', 'frozen'],
  frozen:        ['active', 'cancelled', 'expired'],
  expired:       ['active'],  // re-activation via new membership
  cancelled:     ['active'],  // re-activation via new membership
};

const MEMBERSHIP_TRANSITIONS: Record<string, string[]> = {
  active:    ['frozen', 'expired', 'cancelled', 'renewed', 'paused'],
  frozen:    ['active', 'expired', 'cancelled'],
  paused:    ['active', 'cancelled', 'expired'],
  expired:   ['renewed', 'active'],  // renewal or manual reactivation
  cancelled: ['active'],             // re-assignment
  renewed:   [],                     // terminal state
};

export function assertMemberTransition(from: string, to: string): void {
  if (from === to) return;
  const allowed = MEMBER_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new BadRequestException(
      `Invalid member status transition: "${from}" → "${to}"`,
    );
  }
}

export function assertMembershipTransition(from: string, to: string): void {
  if (from === to) return;
  const allowed = MEMBERSHIP_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new BadRequestException(
      `Invalid membership status transition: "${from}" → "${to}"`,
    );
  }
}
