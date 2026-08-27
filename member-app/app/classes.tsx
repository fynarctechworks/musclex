import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Button, Card, Empty, Loading, Row, Txt } from '../src/ui';
import { Notice } from '../src/ui/Notice';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { useBookClass, useCancelBooking, useClasses } from '../src/api/queries';
import { dayOf, timeOf } from '../src/lib/datetime';
import type { ClassItem } from '../src/api/types';


export default function ClassesScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useClasses();
  const book = useBookClass();
  const cancel = useCancelBooking();
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <Loading label="Loading classes" />;

  const classes = data?.classes ?? [];
  const groups = classes.reduce<Record<string, ClassItem[]>>((acc, c) => {
    const k = dayOf(c.startsAt);
    (acc[k] ??= []).push(c);
    return acc;
  }, {});

  async function toggle(c: ClassItem) {
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
      <ScrollView contentContainerClassName="gap-3 px-4 pb-32">
        {error ? (
          <Notice title="Could not update booking" body={error} onDismiss={() => setError(null)} />
        ) : null}

        {classes.length === 0 ? (
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

                        loading={book.isPending || cancel.isPending}
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
