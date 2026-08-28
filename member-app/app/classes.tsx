import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Button, Card, Empty, Row, Txt } from '../src/ui';
import { Notice } from '../src/ui/Notice';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { useBookClass, useCancelBooking, useClasses } from '../src/api/queries';
import { dayOf, timeOf } from '../src/lib/datetime';
import type { ClassItem } from '../src/api/types';
import { SkeletonList } from '../src/ui/Skeleton';


export default function ClassesScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useClasses();
  const book = useBookClass();
  const cancel = useCancelBooking();
  const [error, setError] = useState<string | null>(null);


  const classes = data?.classes ?? [];
  const groups = classes.reduce<Record<string, ClassItem[]>>((acc, c) => {
    const k = dayOf(c.startsAt);
    (acc[k] ??= []).push(c);
    return acc;
  }, {});

  async function toggle(c: ClassItem) {
    // One write at a time. The pressed button disables itself while loading,
    // but every OTHER class stays live — and two bookings racing means two
    // invalidations landing out of order, so the list can settle showing the
    // wrong seat count.
    if (book.isPending || cancel.isPending) return;
    setError(null);
    try {
      if (c.booked || c.waitlistPosition) await cancel.mutateAsync(c.id);
      else await book.mutateAsync(c.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update that booking.');
    }
  }

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Classes" />
      <ScrollView
        contentContainerClassName="gap-3 px-4 pb-32"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#79716b" />
        }>
        {error ? (
          <Notice title="Could not update booking" body={error} onDismiss={() => setError(null)} />
        ) : null}

        {isLoading ? (
          <SkeletonList count={4} label="Loading classes" />
        ) : classes.length === 0 ? (
          <Empty
            title="Nothing scheduled"
            body="Your branch has no upcoming classes. They appear here as soon as your gym publishes them."
          />
        ) : (
          Object.entries(groups).map(([day, items]) => (
            <View key={day} className="gap-2">
              <Txt variant="label" tone="t3">{day}</Txt>
              {items.map((c) => {
                const full = c.seatsLeft <= 0 && !c.booked;
                // Only the class actually being written to. `variables` is the
                // id passed to mutate(), so a booking spins its OWN button
                // rather than every button on the screen.
                const busy =
                  (book.isPending && book.variables === c.id) ||
                  (cancel.isPending && cancel.variables === c.id);
                return (
                  <Card key={c.id} tone={c.booked ? 'good' : 'default'}>
                    <Row className="items-start">
                      <View className="flex-1 pr-3">
                        <Txt variant="heading">{c.title}</Txt>
                        <Txt variant="small" tone="t2" style={{ marginTop: 3 }}>
                          {timeOf(c.startsAt)}
                          {c.trainerName ? ` · ${c.trainerName}` : ''}
                        </Txt>
                        <Txt variant="caption" tone={full ? 'accent' : 't3'} style={{ marginTop: 3 }}>
                          {c.waitlistPosition
                            ? `Waitlisted · position ${c.waitlistPosition}`
                            : c.booked
                              ? 'You are booked'
                              : full
                                ? 'Full'
                                : `${c.seatsLeft} seat${c.seatsLeft === 1 ? '' : 's'} left`}
                        </Txt>
                      </View>
                      <Button
                        title={c.booked || c.waitlistPosition ? 'Cancel' : full ? 'Join waitlist' : 'Book'}
                        variant={c.booked ? 'secondary' : 'primary'}
                        size="sm"

                        loading={busy}
                        onPress={() => toggle(c)}
                      />
                    </Row>
                  </Card>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
