import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataList } from '@/ui/DataList';
import { RowCard } from '@/ui/RowCard';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCheckIn, useMembers } from '@/api/queries';
import { initialsOf, membershipState } from '@/features/MemberRow';
import { useToast } from '@/ui/Toast';
import { useSession } from '@/auth/SessionProvider';
import { formatRelative } from '@/lib/format';
import { uuidv4 } from '@/lib/uuid';
import type { Member } from '@/api/types';
import { tokens } from '@/ui/tokens';

/**
 * Check-in — the front desk's core task.
 *
 * Manual (search → confirm) only for now; QR scanning needs expo-camera, which
 * is a new native dependency (see TODO_FOR_ME.md). The screen is built so the
 * scanner drops in beside the search field without restructuring.
 *
 * The confirm step is deliberate rather than one-tap: checking in the wrong
 * member consumes their entitlement and corrupts attendance, and two members
 * often share a first name.
 */
export default function CheckIn() {
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [pending, setPending] = React.useState<Member | null>(null);
  const eventId = React.useRef<string | null>(null);
  /*
   * The member is held in a REF as well as state.
   *
   * AlertDialogAction closes the dialog as part of its own press handling,
   * which sets `pending` back to null. Reading the member from state inside the
   * confirm handler therefore races the close and silently no-ops — the dialog
   * dismissed and no check-in was recorded, with no error shown. The ref is not
   * subject to that re-render.
   */
  const pendingRef = React.useRef<Member | null>(null);

  const toast = useToast();
  const { session } = useSession();
  const checkIn = useCheckIn();

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Only search once there is something to match — the full member list is not
  // a useful check-in screen, and it invites tapping the wrong person.
  const enabled = debounced.length >= 2;
  const query = useMembers(enabled ? { search: debounced, limit: 20 } : { limit: 0 });
  const results = enabled ? (query.data?.data ?? []) : [];

  function ask(member: Member) {
    // One idempotency key per ATTEMPT, reused across retries, so a double-tap
    // or a retry on flaky signal cannot record two visits.
    eventId.current = uuidv4();
    pendingRef.current = member;
    setPending(member);
  }

  async function confirm() {
    const member = pendingRef.current;
    const id = eventId.current;
    pendingRef.current = null;
    setPending(null);
    if (!member || !id) return;
    try {
      await checkIn.mutateAsync({
        memberId: member.id,
        clientEventId: id,
        branchId: session?.activeBranchId,
      });
      toast.show(`${member.full_name} checked in`);
      setSearch('');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Check-in failed', 'error');
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <View className="gap-3 px-4 pb-3 pt-2">
        <Text className="text-2xl font-semibold text-foreground">Check-in</Text>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, phone or member code"
          autoCapitalize="none"
          autoFocus
          testID="checkin-search"
        />
        <Text className="text-sm text-muted-foreground">
          {enabled ? 'Tap a member to check them in.' : 'Type at least 2 characters.'}
        </Text>
      </View>

      <DataList<Member>
        data={results}
        isLoading={enabled && query.isLoading}
        error={enabled ? query.error : undefined}
        onRetry={() => void query.refetch()}
        keyExtractor={(m) => m.id}
        emptyTitle={enabled ? 'No matches' : 'Search for a member'}
        emptyBody={
          enabled
            ? `Nothing matched “${debounced}”.`
            : 'Find them by name, phone or member code.'
        }
        renderItem={({ item }) => {
          const state = membershipState(item);
          return (
            <RowCard
              initials={initialsOf(item.full_name)}
              title={item.full_name}
              subtitle={item.member_code}
              meta={item.last_visit_at ? `Last visit ${formatRelative(item.last_visit_at)}` : 'No visits yet'}
              trailing={<Badge variant={state.variant}><Text>{state.label}</Text></Badge>}
              onPress={() => ask(item)}
              testID={`checkin-${item.member_code}`}
            />
          );
        }}
      />

      <AlertDialog open={pending !== null} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Check in {pending?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? describeEntitlement(pending) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><Text>Cancel</Text></AlertDialogCancel>
            <AlertDialogAction onPress={confirm}>
              <Text>{checkIn.isPending ? 'Checking in…' : 'Check in'}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SafeAreaView>
  );
}

/**
 * Say what the desk needs to know BEFORE confirming. The server is still the
 * authority on whether entry is allowed — this only surfaces the likely answer
 * so staff are not surprised by a rejection.
 */
function describeEntitlement(member: Member): string {
  const state = membershipState(member);
  if (state.label === 'Expired') return 'Their membership has expired — they may need to renew.';
  if (state.label === 'No active plan') return 'No active plan on record.';
  if (state.label === 'Expiring') return 'Their membership expires soon.';
  return `${member.member_code} · membership active.`;
}
