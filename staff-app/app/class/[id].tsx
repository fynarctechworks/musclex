import React from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataList } from '@/ui/DataList';
import { RowCard } from '@/ui/RowCard';
import { Meter } from '@/ui/Meter';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Can } from '@/rbac/Gate';
import {
  useBookMember, useBulkAttendance, useCancelBooking, useClassSession,
  useMarkAttendance, useSessionAttendance, useSessionRoster,
} from '@/api/queries';
import { BookMemberSheet } from '@/features/BookMemberSheet';
import { SwipeActions } from '@/ui/SwipeActions';
import type { Member } from '@/api/types';
import { mergeAttendance, sortRegister, stillUnmarked } from '@/lib/register';
import { useToast } from '@/ui/Toast';
import { initialsOf } from '@/features/MemberRow';
import { formatTime } from '@/lib/format';
import type { ClassBooking } from '@/api/types';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * CLASS REGISTER — the trainer's task, on the studio floor
 * ────────────────────────────────────────────────────────────────
 *
 * Every mark SAVES IMMEDIATELY. This is not a form with a submit button, and
 * that is the whole design: a trainer marks the register while people walk in,
 * often putting the phone down between arrivals. A screen that batched the
 * marks and lost them when the app was backgrounded mid-class would lose them
 * silently, and the class is over by the time anybody notices.
 *
 * The consequence is that a marked row must LOOK saved, so the register can be
 * read at a glance and the trainer knows who they still have to find.
 */

const STATUSES = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'no_show', label: 'No show' },
] as const;

export default function ClassRegister() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();

  const session = useClassSession(id);
  const roster = useSessionRoster(id);
  const register = useSessionAttendance(id);
  const mark = useMarkAttendance(id);
  const bulk = useBulkAttendance(id);
  const book = useBookMember(id);
  const cancel = useCancelBooking(id);

  const [booking, setBooking] = React.useState(false);

  /*
   * Bookings and attendance are separate tables behind separate endpoints, so
   * the join happens here. Without it a mark saves correctly and the row still
   * reads "Not marked" — which makes the trainer mark the same person twice,
   * or decide the app is broken.
   */
  const bookings = sortRegister(mergeAttendance(roster.data?.bookings ?? [], register.data));
  const capacity = roster.data?.capacity ?? session.data?.capacity ?? 0;
  const unmarked = stillUnmarked(bookings);

  async function setStatus(booking: ClassBooking, status: string) {
    if (!booking.member_id) return;
    try {
      await mark.mutateAsync({ memberId: booking.member_id, status });
    } catch (e) {
      // Say so loudly. A mark that silently failed is worse than no mark:
      // the register looks complete and the attendance is wrong.
      toast.show(e instanceof Error ? e.message : 'Could not save that mark', 'error');
    }
  }

  async function bookMember(member: Member) {
    setBooking(false);
    try {
      const res = await book.mutateAsync(member.id);
      // The server sends a full class to the waitlist rather than refusing, so
      // say which happened — "booked" and "waitlisted" are different news for
      // somebody standing in the doorway.
      const waitlisted = res?.booking_status === 'waitlisted' || res?.waitlist_position != null;
      toast.show(
        waitlisted
          ? `${member.full_name} added to the waitlist — class is full`
          : `${member.full_name} booked in`,
      );
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Could not book that member', 'error');
    }
  }

  async function removeBooking(item: ClassBooking) {
    if (item.attendance_status && item.attendance_status !== 'registered') {
      toast.show(
        `${item.member?.full_name ?? 'They'} is already marked ${labelFor(item.attendance_status).toLowerCase()} — change the mark first`,
        'error',
      );
      return;
    }
    try {
      await cancel.mutateAsync({ bookingId: item.id });
      toast.show(`${item.member?.full_name ?? 'Booking'} removed`);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Could not cancel', 'error');
    }
  }

  async function markRestPresent() {
    if (unmarked.length === 0) return;
    try {
      await bulk.mutateAsync(
        unmarked.map((b) => ({ member_id: b.member_id, attendance_status: 'present' })),
      );
      toast.show(`${unmarked.length} marked present`);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Could not save', 'error');
    }
  }

  const title = session.data?.name ?? 'Class';
  const when = session.data?.start_time
    ? `${formatTime(session.data.start_time)}${
        session.data.end_time ? ` – ${formatTime(session.data.end_time)}` : ''
      }`
    : '';

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title }} />
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: tokens.background }}>
        <DataList<ClassBooking>
          data={bookings}
          isLoading={roster.isLoading}
          error={roster.error}
          onRetry={() => void roster.refetch()}
          onRefresh={() => { void roster.refetch(); void register.refetch(); }}
          isRefreshing={(roster.isFetching || register.isFetching) && !roster.isLoading}
          keyExtractor={(b) => b.id}
          emptyTitle="Nobody booked in"
          emptyBody="Bookings made on the web or the member app show up here."
          ListHeaderComponent={
            <View className="mb-3 gap-3">
              <View className="gap-1 rounded-xl border border-border bg-card p-4">
                <Text className="text-sm text-muted-foreground">{when}</Text>
                {session.data?.trainer?.full_name ? (
                  <Text className="text-sm text-muted-foreground">
                    with {session.data.trainer.full_name}
                  </Text>
                ) : null}
                <View className="mt-2 gap-1">
                  <Text className="text-sm text-foreground">
                    {bookings.length} booked of {capacity}
                  </Text>
                  <Meter value={bookings.length} max={Math.max(capacity, 1)} />
                </View>
              </View>

              <Can module="classes" action="edit">
                <Button variant="outline" onPress={() => setBooking(true)} testID="book-member">
                  <Text>Book a member in</Text>
                </Button>
              </Can>

              {unmarked.length > 0 ? (
                <Can module="classes" action="edit">
                  <Button onPress={markRestPresent} disabled={bulk.isPending}
                          testID="mark-rest-present">
                    <Text>
                      {bulk.isPending
                        ? 'Saving…'
                        : `Mark remaining ${unmarked.length} present`}
                    </Text>
                  </Button>
                </Can>
              ) : bookings.length > 0 ? (
                <View className="rounded-lg border border-border bg-muted px-3 py-2">
                  <Text className="text-sm text-muted-foreground">
                    Register complete — everyone is marked.
                  </Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <View className="gap-2">
              {/* Swipe to remove a booking — but only while UNMARKED. Once the
                  trainer has recorded that somebody attended, cancelling would
                  drop that fact from attendance. Refusing SILENTLY would be
                  worse than refusing, so it says why. */}
              <SwipeActions
                actionLabel="Remove"
                destructive
                onAction={() => void removeBooking(item)}>
              <RowCard
                initials={initialsOf(item.member?.full_name ?? '?')}
                title={item.member?.full_name ?? 'Member'}
                subtitle={item.member?.member_code ?? undefined}
                chevron={false}
                trailing={
                  item.attendance_status && item.attendance_status !== 'registered' ? (
                    <Badge variant={item.attendance_status === 'no_show' ? 'destructive' : 'default'}>
                      <Text>{labelFor(item.attendance_status)}</Text>
                    </Badge>
                  ) : (
                    <Badge variant="secondary"><Text>Not marked</Text></Badge>
                  )
                }
              />
              </SwipeActions>
              <Can module="classes" action="edit">
                <View className="px-1 pb-1">
                  <SegmentedControl
                    value={item.attendance_status ?? ''}
                    onChange={(v) => void setStatus(item, v)}
                    segments={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                    testID={`attendance-${item.member?.member_code ?? item.member_id}`}
                  />
                </View>
              </Can>
            </View>
          )}
        />

        {/* Sibling of the list, not a child: a bottom sheet nested inside a
            scrolling container renders off-screen. */}
        <BookMemberSheet
          open={booking}
          onClose={() => setBooking(false)}
          onPick={(m) => void bookMember(m)}
          busy={book.isPending}
        />
      </SafeAreaView>
    </>
  );
}

function labelFor(status: string): string {
  const found = STATUSES.find((s) => s.value === status);
  if (found) return found.label;
  // 'cancelled' is a booking outcome the trainer never sets but may receive.
  return status.replace(/_/g, ' ');
}
