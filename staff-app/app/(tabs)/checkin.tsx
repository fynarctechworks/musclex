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
import { QrScanner, type ScanOutcome } from '@/features/QrScanner';
import { useOutbox } from '@/offline/OutboxProvider';
import { isQueueableFailure } from '@/offline/outbox';
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
 * Two ways in, and they behave differently on purpose:
 *
 *  - SCAN — auto-submits. The code carries an HMAC-signed member id, so there
 *    is nothing to disambiguate and a confirm tap would only slow the queue.
 *  - SEARCH — confirms first. The staffer picked a row out of a list of
 *    similar names, and checking in the wrong member consumes their
 *    entitlement and corrupts attendance.
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

  const [scanning, setScanning] = React.useState(false);

  const toast = useToast();
  const { session } = useSession();
  const checkIn = useCheckIn();
  const outbox = useOutbox();

  /**
   * Submit a scanned code and translate the result into something readable
   * over a counter.
   *
   * `retryable` decides whether the gate forgets the code. A network failure
   * should be re-scannable at once; a revoked or already-used card should not,
   * because re-scanning it just fails again — and the card is still in frame,
   * so "again" means ten times a second.
   */
  const submitScan = React.useCallback(
    async (code: string): Promise<ScanOutcome & { retryable?: boolean }> => {
      try {
        const res = await checkIn.mutateAsync({
          qrCode: code,
          clientEventId: uuidv4(),
          branchId: session?.activeBranchId,
        });
        void res;
        return { ok: true, message: 'Checked in' };
      } catch (e) {
        const status = (e as { status?: number }).status;
        const message = e instanceof Error ? e.message : 'Check-in failed';
        // 4xx is a verdict about the CODE and will not change on a re-scan.
        // Anything else (offline, 5xx, timeout) is about the moment, not the
        // card, so let it be tried again immediately.
        const retryable = !(typeof status === 'number' && status >= 400 && status < 500);
        return { ok: false, message, retryable };
      }
    },
    [checkIn, session?.activeBranchId],
  );

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
      return;
    } catch (e) {
      // A 4xx is the server REFUSING this check-in. Queueing it would promise
      // the staffer it goes through later when it never will, so it is
      // reported at the counter where it can still be acted on.
      if (!isQueueableFailure(e)) {
        toast.show(e instanceof Error ? e.message : 'Check-in failed', 'error');
        return;
      }

      const branchId = member.branch_id ?? session?.activeBranchId ?? null;
      if (!branchId) {
        // The sync DTO requires a branch. Without one there is nothing valid
        // to queue, and a silent drop would be worse than saying so.
        toast.show('No branch selected — cannot save this for later', 'error');
        return;
      }

      await outbox.enqueue({
        memberId: member.id,
        branchId,
        memberName: member.full_name,
      });
      toast.show(`Saved — ${member.full_name} will sync when back online`);
      setSearch('');
    }
  }

  if (scanning) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#000' }}>
        <QrScanner onScan={submitScan} onClose={() => setScanning(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <View className="gap-3 px-4 pb-3 pt-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-semibold text-foreground">Check-in</Text>
          <Button size="sm" onPress={() => setScanning(true)} testID="checkin-scan">
            <Text>Scan</Text>
          </Button>
        </View>
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

        {/* Queued check-ins are money and attendance the gym cannot see yet.
            They stay visible until they land, so nobody assumes they did. */}
        {outbox.pending > 0 ? (
          <View
            className="flex-row items-center justify-between rounded-lg border border-border bg-muted px-3 py-2"
            testID="outbox-banner">
            <Text className="text-sm text-muted-foreground">
              {outbox.pending} check-in{outbox.pending === 1 ? '' : 's'} waiting to sync
            </Text>
            <Button size="sm" variant="outline" onPress={() => void outbox.flush()}
                    testID="outbox-sync">
              <Text>Sync now</Text>
            </Button>
          </View>
        ) : null}
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
