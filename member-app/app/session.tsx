import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Button, Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { Input } from '@/components/ui/input';
import { useCreateRoutine, useLogWorkout, useRoutine, useTodayWorkout } from '../src/api/queries';
import { ExerciseBlock } from '../src/features/ExerciseBlock';
import { toPayload, totalDuration, totalVolume, type WorkingSet } from '../src/features/sets';
import { useUnits } from '../src/lib/use-units';
import { backOrHome } from '../src/lib/nav';
import { RestTimer } from '../src/features/RestTimer';
import { ExercisePicker } from '../src/features/ExercisePicker';
import type { WorkoutLogResult } from '../src/api/types';
import { Icon } from '../src/ui/Icon';

/**
 * ────────────────────────────────────────────────────────────────
 * WORKOUT SESSION
 * ────────────────────────────────────────────────────────────────
 *
 * The core loop, in two modes:
 *
 *   ?assigned=1  follow the workout a trainer set for today. The plan's
 *                exercises and target sets are laid out ready to log, and
 *                finishing marks the assignment complete for the trainer.
 *   (no param)   a freestyle session the member builds themselves.
 *
 * Both are the same screen because they are the same act — the only difference
 * is who chose the exercises. A session is client-side until Finish, which
 * posts every completed set in ONE idempotent write, so a member can log an
 * entire workout through a dead zone and have it land intact later.
 */

const REST_SECONDS = 90;

interface Block {
  id: string;
  name: string;
  trackingType?: 'reps' | 'duration';
  sets: WorkingSet[];
}

/** Result of a finished session, rendered as a summary rather than an alert. */
interface Done {
  queued: boolean;
  sets: number;
  volume: number;
  seconds: number;
  minutes: number;
  prs: { exerciseId: string; weight: number }[];
}

const blankSets = (): WorkingSet[] =>
  Array.from({ length: 3 }, () => ({ kg: '', reps: '', secs: '', done: false }));

export default function SessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { assigned, routine: routineId } = useLocalSearchParams<{
    assigned?: string;
    routine?: string;
  }>();
  const wantAssigned = assigned === '1';

  const { data: plan, isLoading: planLoading } = useTodayWorkout();
  const { data: routine, isLoading: routineLoading } = useRoutine(routineId ?? null);
  const usingPlan = wantAssigned && !!plan;

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [restAt, setRestAt] = useState<number | null>(null);
  const [startedAt] = useState(() => Date.now());

  // A session clock that actually ticks. Derived from the start timestamp
  // rather than incremented, so it stays correct if the JS thread stalls or
  // the app is backgrounded mid-workout.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const [done, setDone] = useState<Done | null>(null);
  const [routineName, setRoutineName] = useState('');
  const [savedRoutine, setSavedRoutine] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const log = useLogWorkout(usingPlan ? plan!.id : null);
  const saveRoutine = useCreateRoutine();
  const u = useUnits();

  const payload = useMemo(() => toPayload(blocks, u.weightUnit), [blocks, u.weightUnit]);
  const volume = totalVolume(payload);

  /**
   * What a routine would save: the exercises and how many sets, not the weights.
   * A routine is the SHAPE of a workout — carrying today's loads forward would
   * fight the per-set history prefill, which already knows better next week.
   */
  const blocksForRoutine = blocks
    .filter((b) => b.sets.some((s) => s.done))
    .map((b) => ({
      exerciseId: b.id,
      targetSets: b.sets.filter((s) => s.done).length,
    }));
  const seconds = totalDuration(payload);

  /**
   * A session of planks moves no load, so reporting "0 kg" is true and useless.
   * Show whichever measure the session actually produced, and both when it mixes
   * lifting with timed work.
   */
  const effort = [
    volume > 0 ? u.fv(volume) : null,
    seconds > 0 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s under tension` : null,
  ].filter(Boolean);
  const effortLabel = effort.length ? effort.join(' · ') : u.fv(0);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const minutes = Math.max(1, Math.round(elapsed / 60));

  // Lay the trainer's plan out ready to log. Seeded once: re-seeding on every
  // render of the query would wipe sets the member has already entered.
  // A routine lays out exactly like a trainer's plan — same shape, different
  // author — so it seeds through the same one-shot guard.
  useEffect(() => {
    if (!routine || seeded) return;
    setBlocks(
      routine.exercises.map((e) => {
        // A per-set plan defines the set count; otherwise fall back to the
        // uniform target, which older routines still use.
        const perSet = e.targetRepsPerSet ?? e.targetSecondsPerSet;
        const count = perSet?.length ?? e.targetSets ?? 3;
        return {
          id: e.exerciseId,
          name: e.name,
          trackingType: e.trackingType ?? 'reps',
          sets: Array.from({ length: count }, (_, i) => ({
            kg: '',
            reps: '',
            secs: '',
            done: false,
            target: {
              // Per-set value first, then the uniform one repeated.
              reps: e.targetRepsPerSet?.[i] ?? e.targetReps,
              secs: e.targetSecondsPerSet?.[i] ?? e.targetDurationSeconds,
              // Stored kg -> display unit, since this is only rendered.
              kg:
                e.targetWeightPerSet?.[i] === undefined
                  ? undefined
                  : u.w(e.targetWeightPerSet[i]),
            },
          })),
        };
      }),
    );
    setSeeded(true);
  }, [routine, seeded, u]);

  useEffect(() => {
    if (!usingPlan || seeded) return;
    setBlocks(
      plan!.exercises.map((e) => ({
        id: e.id,
        name: e.name,
        sets: Array.from({ length: e.targetSets ?? 3 }, () => ({
          kg: '',
          reps: '',
          secs: '',
          done: false,
        })),
      })),
    );
    setSeeded(true);
  }, [usingPlan, seeded, plan]);


  async function finish() {
    if (!payload.length) return;
    setError(null);
    try {
      const { queued, result } = await log.mutateAsync({
        sets: payload,
        // The span the session actually covered, so a workout logged late lands
        // on the day it happened rather than the day it was typed.
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date().toISOString(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // `queued` is a success, not a failure: the sets are on disk under an
      // idempotency key and will sync. Calling it an error here would make
      // members re-log a workout the server is about to receive anyway.
      setDone({
        queued,
        sets: payload.length,
        volume,
        seconds,
        minutes,
        prs: (result as WorkoutLogResult | undefined)?.newPersonalRecords ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    }
  }

  function close() {
    if (!payload.length || done) return backOrHome(router);
    setConfirmDiscard(true);
  }


  if (done) {
    return (
      <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
        <ScrollView contentContainerClassName="px-4 pb-10 gap-4">
          <View className="items-center gap-3 py-10">
            {/* The heading underneath already says what happened, so this is
                decorative — announcing it would repeat the sentence. */}
            <Icon
              name={done.prs.length ? 'goals' : done.queued ? 'import' : 'check'}
              size={44}
              tone={done.queued ? 't3' : 'accent'}
              decorative
            />
            <Txt variant="title">{done.queued ? 'Saved offline' : 'Workout saved'}</Txt>
            <Txt variant="small" tone="t3" className="text-center">
              {done.queued
                ? 'Your sets are safe on this phone and will sync as soon as you have signal.'
                : usingPlan
                  ? 'Logged, and your trainer can see the session is complete.'
                  : 'Logged to your gym.'}
            </Txt>
          </View>

          {/* What the session actually produced. A planks-only session moves no
              load, so the third figure switches to time under tension rather
              than reporting a truthful and useless 0 kg. */}
          <Card>
            <Row className="items-start">
              <Summary value={String(done.minutes)} unit="minutes" />
              <Summary value={String(done.sets)} unit="sets" />
              <Summary
                value={
                  done.volume > 0
                    ? u.fv(done.volume)
                    : `${Math.floor(done.seconds / 60)}m ${done.seconds % 60}s`
                }
                unit={done.volume > 0 ? 'volume' : 'under tension'}
              />
            </Row>
          </Card>

          {done.prs.length ? (
            <View>
              <Row className="mb-2">
                <Label>New personal record{done.prs.length > 1 ? 's' : ''}</Label>
              </Row>
              <Card tone="accent" className="gap-3">
                {done.prs.map((pr) => (
                  <Row key={pr.exerciseId}>
                    <Txt variant="body" className="flex-1 pr-3">
                      {blocks.find((b) => b.id === pr.exerciseId)?.name ?? 'Exercise'}
                    </Txt>
                    <Txt variant="bodyStrong" tone="accent">
                      {u.fw(pr.weight)}
                    </Txt>
                  </Row>
                ))}
                <Txt variant="caption" tone="t3">
                  Detected by the server and added to your records.
                </Txt>
              </Card>
            </View>
          ) : null}

          {/* Offered only for a session the member built themselves: a
              trainer's plan and an existing routine are already saved. */}
          {!usingPlan && !routine && !savedRoutine && blocksForRoutine.length ? (
            <View>
              <Row className="mb-2">
                <Label>Repeat this workout?</Label>
              </Row>
              <Card className="gap-3">
                <Txt variant="small" tone="t3">
                  Save it as a routine and it will be one tap next week.
                </Txt>
                <Input
                  value={routineName}
                  onChangeText={setRoutineName}
                  placeholder="Name it, e.g. Push Day A"
                  accessibilityLabel="Routine name"
                  returnKeyType="done"
                />
                <Button
                  title="Save routine"
                  disabled={!routineName.trim()}
                  loading={saveRoutine.isPending}
                  onPress={async () => {
                    try {
                      await saveRoutine.mutateAsync({
                        name: routineName.trim(),
                        exercises: blocksForRoutine,
                      });
                      setSavedRoutine(true);
                    } catch {
                      setSavedRoutine(false);
                    }
                  }}
                />
              </Card>
            </View>
          ) : null}

          {savedRoutine ? (
            <Card tone="good">
              <Row className="justify-start gap-2">
                <Icon name="check" size={18} tone="good" decorative />
                <Txt variant="bodyStrong" tone="good">
                  Saved to My routines
                </Txt>
              </Row>
            </Card>
          ) : null}

          <Button title="Done" onPress={() => backOrHome(router)} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      {/*
        THE SESSION BAR.

        A workout is a timed thing, so the clock is a first-class element rather
        than the third item in a subtitle. Tabular figures, so the digits do not
        jitter every second as the widths change.
      */}
      <View className="border-border bg-card border-b px-4 pb-3">
        <Row>
          <Pressable
            onPress={close}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close this workout">
            <Txt variant="small" tone="t2">
              Close
            </Txt>
          </Pressable>
          <Txt
            variant="bodyStrong"
            className="tabular-nums"
            accessibilityLabel={`Elapsed ${Math.floor(elapsed / 60)} minutes`}>
            {clock}
          </Txt>
        </Row>
        <Txt variant="title" numberOfLines={1} className="mt-1">
          {usingPlan ? plan!.title : (routine?.name ?? 'Workout')}
        </Txt>
        {/* Before anything is logged this would read "0 sets · 0 kg" — two
            zeros reporting that the session has not started, which the member
            already knows. It says what to do instead, and becomes a running
            total the moment there is one to show. */}
        <Txt variant="caption" tone="t3">
          {usingPlan && plan!.assignedBy ? `Set by ${plan!.assignedBy} · ` : ''}
          {payload.length
            ? `${payload.length} ${payload.length === 1 ? 'set' : 'sets'} · ${effortLabel}`
            : 'Tick a set as you finish it'}
        </Txt>
      </View>

      <ScrollView
        contentContainerClassName="px-4 pt-4 gap-3"
        contentContainerStyle={{ paddingBottom: 220 }}
        keyboardShouldPersistTaps="handled">
        {(wantAssigned && planLoading) || routineLoading ? (
          <Loading label={routineLoading ? 'Loading routine' : 'Loading your plan'} />
        ) : blocks.length === 0 ? (
          <Empty
            title={wantAssigned ? 'No plan for today' : 'Add your first exercise'}
            body={
              wantAssigned
                ? 'Your trainer has not set a workout for today. Add exercises to log a session of your own.'
                : "Your last session's weights and reps are filled in automatically, so most sets are a single tap."
            }
            action={<Button title="Add exercises" onPress={() => setPickerOpen(true)} />}
          />
        ) : (
          blocks.map((b, i) => (
            <ExerciseBlock
              key={b.id}
              exerciseId={b.id}
              name={b.name}
              trackingType={b.trackingType}
              sets={b.sets}
              onChange={(sets) =>
                setBlocks((prev) => prev.map((x, idx) => (idx === i ? { ...x, sets } : x)))
              }
              onComplete={() => setRestAt(Date.now())}
              onRemove={() => setBlocks((prev) => prev.filter((_, idx) => idx !== i))}
            />
          ))
        )}

        {error ? (
          <Card tone="accent">
            <Txt variant="small" tone="accent">
              {error}
            </Txt>
          </Card>
        ) : null}

        {/* Adding belongs with the list it adds to, so it stays in the scroll.
            Only Finish is pinned. */}
        {blocks.length ? (
          <Button title="Add exercises" variant="secondary" onPress={() => setPickerOpen(true)} />
        ) : null}
      </ScrollView>

      {/*
        THE ACTION BAR.

        Finish used to sit at the bottom of the scroll, so ending a session
        meant scrolling back past every exercise you had just logged — with
        sweaty hands, mid-gym. It is pinned now, and carries the set count so
        the number you are committing is visible at the moment you commit it.
      */}
      <View
        className="border-border bg-card absolute inset-x-0 bottom-0 border-t px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}>
        <Button
          title={payload.length ? `Finish · ${payload.length} sets` : 'Complete a set to finish'}
          onPress={finish}
          disabled={!payload.length}
          loading={log.isPending}
        />
      </View>

      {/* Lifted clear of the action bar; at the default offset the two overlap. */}
      <RestTimer startedAt={restAt} seconds={REST_SECONDS} bottomOffset={72 + insets.bottom} />

      {/*
        Discarding is destructive and cannot be undone by pressing back, so it
        is a real dialog rather than a card that appears further down a scroll
        the member may not be looking at.
      */}
      {confirmDiscard ? (
        <View className="absolute inset-0 items-center justify-center bg-black/50 px-6">
          <Card className="w-full gap-4 p-5">
            <View className="gap-1">
              <Txt variant="heading">Discard this workout?</Txt>
              <Txt variant="small" tone="t3">
                {payload.length} logged {payload.length === 1 ? 'set' : 'sets'} will be lost. This
                cannot be undone.
              </Txt>
            </View>
            <View className="gap-2">
              <Button
                title="Keep logging"
                variant="secondary"
                onPress={() => setConfirmDiscard(false)}
              />
              <Button title="Discard workout" onPress={() => backOrHome(router)} />
            </View>
          </Card>
        </View>
      ) : null}

      <ExercisePicker
        visible={pickerOpen}
        alreadyAdded={blocks.map((b) => b.id)}
        onClose={() => setPickerOpen(false)}
        onAdd={(items) => {
          setPickerOpen(false);
          if (!items.length) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setBlocks((prev) => [
            ...prev,
            ...items.map((e) => ({
              id: e.id,
              name: e.name,
              trackingType: e.trackingType ?? 'reps',
              sets: blankSets(),
            })),
          ]);
        }}
      />
    </View>
  );
}

function Summary({ value, unit }: { value: string; unit: string }) {
  return (
    <View className="flex-1 items-center gap-0.5" accessibilityRole="text"
      accessibilityLabel={`${value} ${unit}`}>
      <Txt variant="heading">{value}</Txt>
      <Txt variant="caption" tone="t3">
        {unit}
      </Txt>
    </View>
  );
}
