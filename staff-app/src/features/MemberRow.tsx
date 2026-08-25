import React from 'react';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { RowCard } from '@/ui/RowCard';
import { formatDate, formatRelative } from '@/lib/format';
import type { Member } from '@/api/types';

/**
 * One member, rendered as the standard row card.
 *
 * Membership state is derived here rather than trusted from `member.status`:
 * the API's status is the MEMBER record's state (active/inactive), while what
 * staff actually need at a glance is whether the membership is live, expiring,
 * or lapsed. Those differ — a member can be "active" with an expired plan.
 *
 * IMPORTANT: GET /members includes `memberships: { where: { status: 'active' } }`,
 * so a lapsed member arrives with an EMPTY array. From this endpoint alone it is
 * impossible to tell "never had a plan" from "plan expired", so the label says
 * "No active plan" — true in both cases. Calling it "No plan" would tell a
 * front-desk staffer there is nothing to renew, which is the opposite of the
 * truth for a lapsed member.
 */
export function membershipState(member: Member, now: Date = new Date()) {
  const current = member.memberships?.[0];
  if (!current?.end_date) {
    return { label: 'No active plan', variant: 'secondary' as const, endsAt: null };
  }
  const end = new Date(current.end_date);
  if (Number.isNaN(end.getTime())) {
    return { label: 'No active plan', variant: 'secondary' as const, endsAt: null };
  }
  const days = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);

  if (days < 0) return { label: 'Expired', variant: 'destructive' as const, endsAt: end };
  // Two weeks is the window the web app treats as "expiring" for renewals.
  if (days <= 14) return { label: 'Expiring', variant: 'warning' as const, endsAt: end };
  return { label: 'Active', variant: 'success' as const, endsAt: end };
}

export function initialsOf(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export function MemberRow({ member, onPress }: { member: Member; onPress?: () => void }) {
  const state = membershipState(member);
  const plan = member.memberships?.[0]?.plan?.name;

  const subtitle = [plan, state.endsAt ? `expires ${formatDate(state.endsAt)}` : null]
    .filter(Boolean).join(' · ') || member.member_code;

  const meta = member.last_visit_at
    ? `Last visit ${formatRelative(member.last_visit_at)}`
    : 'No visits yet';

  return (
    <RowCard
      initials={initialsOf(member.full_name)}
      title={member.full_name}
      subtitle={subtitle}
      meta={meta}
      trailing={<Badge variant={state.variant}><Text>{state.label}</Text></Badge>}
      onPress={onPress}
      testID={`member-row-${member.member_code}`}
    />
  );
}
