import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { Icon } from '../src/ui/Icon';
import {
  useResetScheduleShift,
  useRoutineSchedule,
  useRoutines,
  useSetScheduleDay,
} from '../src/api/queries';

/**
 * ────────────────────────────────────────────────────────────────
 * YOUR WEEK
 * ────────────────────────────────────────────────────────────────
 *
 * Seven rows, one per day, each either a routine or a rest day.
 *
 * WHY A WEEK AND NOT A LIST. Routines used to be an unordered pile with no
 * notion of when any of them happened, which is why the home screen could only
 * ever say "nothing assigned today" to a member without a trainer. A week is
 * the smallest structure that makes "today" and "yesterday" answerable.
 *
 * REST IS A REAL ANSWER, not the absence of one. Clearing a day is a first-class
 * action with its own row in the picker, because a member who trains four days
 * is not someone who failed to fill in three.
 */

const DAYS = [
  { weekday: 0, name: 'Sunday', short: 'Sun' },
  { weekday: 1, name: 'Monday', short: 'Mon' },
  { weekday: 2, name: 'Tuesday', short: 'Tue' },
  { weekday: 3, name: 'Wednesday', short: 'Wed' },
  { weekday: 4, name: 'Thursday', short: 'Thu' },
  { weekday: 5, name: 'Friday', short: 'Fri' },
  { weekday: 6, name: 'Saturday', short: 'Sat' },
] as const;

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, isError } = useRoutineSchedule();
  const { data: routinesData } = useRoutines();
  const setDay = useSetScheduleDay();
  const resetShift = useResetScheduleShift();

  /** Which day's picker is open. Null means none — the list is the resting state. */
  const [editing, setEditing] = useState<number | null>(null);

  if (isLoading) return <Loading label="Loading your week" />;
  if (isError || !data) {
    return (
      <Empty
        title="Could not load your week"
        body="Check your connection and try again."
        action={<Button title="Go back" variant="secondary" onPress={() => router.back()} />}
      />
    );
  }

  const routines = routinesData?.routines ?? [];
  const byDay = new Map(data.days.map((d) => [d.weekday, d.routine]));

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-4 pb-3 pt-2">
        <Row>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={10}>
            <Txt variant="body" tone="t2">
              Close
            </Txt>
          </Pressable>
        </Row>
        <Txt variant="title" className="mt-2">
          Your week
        </Txt>
        <Txt variant="small" tone="t3">
          Pick what you train each day. Days you leave empty are rest days.
        </Txt>
      </View>

      <ScrollView
        contentContainerClassName="px-4 pb-10 gap-2"
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/*
          Shown only when the member is actually off their chosen week, which is
          the only time it means anything. It explains the state before offering
          to undo it — a bare "reset" button would be a control with no cause.
        */}
        {data.offsetDays > 0 ? (
          <Card tone="accent" className="mb-2 gap-3">
            <View className="gap-1">
              <Txt variant="bodyStrong">Your week has shifted</Txt>
              <Txt variant="small" tone="t2">
                You picked up a missed session, so everything moved{' '}
                {data.offsetDays === 1 ? 'a day' : `${data.offsetDays} days`} later. The days below
                are still the ones you chose.
              </Txt>
            </View>
            <Button
              title="Back to my normal week"
              variant="secondary"
              loading={resetShift.isPending}
              onPress={() => resetShift.mutate()}
            />
          </Card>
        ) : null}

        {routines.length === 0 ? (
          <Card className="gap-3">
            <View className="gap-1">
              <Txt variant="bodyStrong">No routines yet</Txt>
              <Txt variant="small" tone="t3">
                A week is built out of routines, so make one first — then come back and give it a
                day.
              </Txt>
            </View>
            <Button title="Build a routine" onPress={() => router.push('/routines')} />
          </Card>
        ) : null}

        {DAYS.map((d) => {
          const routine = byDay.get(d.weekday) ?? null;
          const open = editing === d.weekday;
          return (
            <View key={d.weekday}>
              <Pressable
                onPress={() => setEditing(open ? null : d.weekday)}
                accessibilityRole="button"
                accessibilityLabel={`${d.name}: ${routine ? routine.name : 'rest day'}`}
                accessibilityHint="Opens the list of routines for this day"
                disabled={routines.length === 0}
                className="border-border bg-card flex-row items-center gap-3 rounded-2xl border p-4 active:opacity-80">
                <View className="w-12">
                  <Txt variant="caption" tone="t3" className="font-semibold">
                    {d.short.toUpperCase()}
                  </Txt>
                </View>
                <View className="flex-1 gap-0.5">
                  {routine ? (
                    <>
                      <Txt variant="body" className="font-semibold">
                        {routine.name}
                      </Txt>
                      <Txt variant="caption" tone="t3">
                        {routine.exerciseCount} exercises
                      </Txt>
                    </>
                  ) : (
                    /*
                      Named, not blank. An empty row reads as something the
                      member forgot; "Rest day" reads as a choice they made.
                    */
                    <Txt variant="body" tone="t3">
                      Rest day
                    </Txt>
                  )}
                </View>
                <Icon name="chevron" size={18} tone="t4" decorative />
              </Pressable>

              {open ? (
                <View className="border-border bg-card mt-1 gap-1 rounded-2xl border p-2">
                  {routines.map((r) => {
                    const selected = routine?.routineId === r.id;
                    return (
                      <Pressable
                        key={r.id}
                        onPress={() => {
                          setDay.mutate({ weekday: d.weekday, routineId: r.id });
                          setEditing(null);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={r.name}
                        accessibilityState={{ selected }}
                        className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:opacity-70">
                        <Icon
                          name={selected ? 'check' : 'routine'}
                          size={18}
                          tone={selected ? 'accent' : 't4'}
                          filled={selected}
                          decorative
                        />
                        <Txt
                          variant="body"
                          tone={selected ? 't1' : 't2'}
                          className={selected ? 'font-semibold' : ''}>
                          {r.name}
                        </Txt>
                      </Pressable>
                    );
                  })}

                  {/*
                    Rest as a real choice with its own row, rather than something
                    reached by deselecting. Four training days is a plan, not
                    three unfilled blanks.
                  */}
                  <Pressable
                    onPress={() => {
                      setDay.mutate({ weekday: d.weekday, routineId: null });
                      setEditing(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Rest day"
                    accessibilityState={{ selected: routine === null }}
                    className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:opacity-70">
                    <Icon
                      name={routine === null ? 'check' : 'today'}
                      size={18}
                      tone={routine === null ? 'accent' : 't4'}
                      filled={routine === null}
                      decorative
                    />
                    <Txt
                      variant="body"
                      tone={routine === null ? 't1' : 't2'}
                      className={routine === null ? 'font-semibold' : ''}>
                      Rest day
                    </Txt>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}

        <View className="mt-2">
          <Label>Why this matters</Label>
          <Txt variant="small" tone="t3" className="mt-1">
            Today's card shows whatever this week says, and if you miss a day the app offers to
            pick it up rather than letting it disappear.
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}
