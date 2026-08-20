import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Button, Card, Empty, Loading, Row, Txt } from '../src/ui';
import { Notice } from '../src/ui/Notice';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { color, font, radius, space } from '../src/ui/theme';
import { ExercisePicker } from '../src/features/ExercisePicker';
import { useCreateRoutine, useRoutine, useUpdateRoutine } from '../src/api/queries';
import type { ExerciseListItem, RoutineExercise } from '../src/api/types';

/**
 * ────────────────────────────────────────────────────────────────
 * ROUTINE EDITOR — build or change a routine without training
 * ────────────────────────────────────────────────────────────────
 *
 * Until now a routine could only be BORN from a finished session ("Save as
 * routine"). That meant the only way to plan next week's push day was to first
 * perform it, and the only way to fix a wrong exercise was to delete the whole
 * routine and train it again. This screen is the missing half.
 *
 * One screen serves both create and edit, keyed off the `id` param:
 *   /routine-edit          -> new, empty
 *   /routine-edit?id=<id>  -> load that routine and PATCH it
 *
 * They are the same form over the same fields, and splitting them would mean
 * two screens drifting apart.
 *
 * Targets (sets / reps / seconds) are OPTIONAL on purpose. A routine is a
 * running order first and a prescription second: forcing a number on every row
 * before it can be saved would stop someone jotting down "chest day" in ten
 * seconds, which is the common case.
 */

/** Editor row — a RoutineExercise plus the display fields the picker gives us. */
type Row = {
  exerciseId: string;
  name: string;
  thumbUrl?: string | null;
  trackingType?: 'reps' | 'duration';
  targetSets?: number;
  targetReps?: number;
  targetDurationSeconds?: number;
};

/** Parse a target field. Empty clears it; anything non-numeric is ignored. */
function num(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function RoutineEditScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = typeof id === 'string' && id.length > 0;

  const { data: existing, isLoading } = useRoutine(editing ? id : null);
  const create = useCreateRoutine();
  const update = useUpdateRoutine();

  const [name, setName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Guards against the load effect clobbering edits on every refetch. */
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!editing || !existing || hydrated) return;
    setName(existing.name);
    setRows(
      existing.exercises.map((e: RoutineExercise) => ({
        exerciseId: e.exerciseId,
        name: e.name,
        thumbUrl: e.thumbUrl,
        trackingType: e.trackingType,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        targetDurationSeconds: e.targetDurationSeconds,
      })),
    );
    setHydrated(true);
  }, [editing, existing, hydrated]);

  if (editing && isLoading) return <Loading label="Loading routine" />;

  function patch(index: number, next: Partial<Row>) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...next } : r)));
  }

  function move(index: number, delta: number) {
    setRows((rs) => {
      const to = index + delta;
      if (to < 0 || to >= rs.length) return rs;
      const out = [...rs];
      [out[index], out[to]] = [out[to], out[index]];
      return out;
    });
    Haptics.selectionAsync().catch(() => {});
  }

  function onAdd(items: ExerciseListItem[]) {
    setRows((rs) => {
      const have = new Set(rs.map((r) => r.exerciseId));
      const fresh = items
        .filter((i) => !have.has(i.id))
        .map((i) => ({
          exerciseId: i.id,
          name: i.name,
          thumbUrl: i.thumbUrl,
          // Carried through so a timed exercise asks for seconds, not reps —
          // dropping it here is how a plank ends up prescribed as "3 x 30 reps".
          trackingType: i.trackingType,
        }));
      return [...rs, ...fresh];
    });
    setPicking(false);
  }

  async function save() {
    setError(null);
    const clean = name.trim();
    if (!clean) return setError('Give the routine a name.');
    if (rows.length === 0) return setError('Add at least one exercise.');

    const exercises = rows.map((r) => ({
      exerciseId: r.exerciseId,
      targetSets: r.targetSets,
      ...(r.trackingType === 'duration'
        ? { targetDurationSeconds: r.targetDurationSeconds }
        : { targetReps: r.targetReps }),
    }));

    try {
      if (editing) {
        await update.mutateAsync({ id, name: clean, exercises });
      } else {
        await create.mutateAsync({ name: clean, exercises });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the routine.');
    }
  }

  const busy = create.isPending || update.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title={editing ? 'Edit routine' : 'New routine'} />

      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 140, gap: space.md }}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <Notice tone="error" title={error} onDismiss={() => setError(null)} /> : null}

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Routine name, e.g. Push day"
          placeholderTextColor={color.t4}
          accessibilityLabel="Routine name"
          style={{
            height: 50,
            borderRadius: radius.md,
            backgroundColor: color.surface2,
            borderWidth: 1,
            borderColor: color.line,
            color: color.t1,
            paddingHorizontal: space.lg,
            fontFamily: font,
            fontSize: 16,
          }}
        />

        {rows.length === 0 ? (
          <Empty
            title="No exercises yet"
            body="Add the movements you want, in the order you want to train them."
          />
        ) : (
          rows.map((r, i) => {
            const timed = r.trackingType === 'duration';
            return (
              <Card key={r.exerciseId}>
                <Row style={{ alignItems: 'flex-start' }}>
                  {r.thumbUrl ? (
                    <Image
                      source={{ uri: r.thumbUrl }}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: radius.sm,
                        backgroundColor: color.surface2,
                        marginRight: space.md,
                      }}
                      accessibilityLabel={r.name}
                    />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Txt variant="body" style={{ fontWeight: '600' }}>{r.name}</Txt>
                    <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>
                      {i + 1} of {rows.length}
                      {timed ? ' · timed' : ''}
                    </Txt>
                  </View>
                </Row>

                <Row style={{ marginTop: space.md, gap: space.sm }}>
                  <Target
                    label="Sets"
                    value={r.targetSets}
                    onChange={(v) => patch(i, { targetSets: v })}
                  />
                  {timed ? (
                    <Target
                      label="Seconds"
                      value={r.targetDurationSeconds}
                      onChange={(v) => patch(i, { targetDurationSeconds: v })}
                    />
                  ) : (
                    <Target
                      label="Reps"
                      value={r.targetReps}
                      onChange={(v) => patch(i, { targetReps: v })}
                    />
                  )}
                </Row>

                <Row style={{ marginTop: space.md, gap: space.sm, justifyContent: 'flex-start' }}>
                  <Small label="↑" disabled={i === 0} onPress={() => move(i, -1)} hint="Move up" />
                  <Small
                    label="↓"
                    disabled={i === rows.length - 1}
                    onPress={() => move(i, 1)}
                    hint="Move down"
                  />
                  <View style={{ flex: 1 }} />
                  <Small
                    label="Remove"
                    onPress={() => setRows((rs) => rs.filter((_, n) => n !== i))}
                    hint={`Remove ${r.name}`}
                  />
                </Row>
              </Card>
            );
          })
        )}

        <Button title="Add exercises" variant="secondary" onPress={() => setPicking(true)} />
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: space.lg,
          paddingBottom: insets.bottom + space.lg,
          backgroundColor: color.bg,
          borderTopWidth: 1,
          borderTopColor: color.line,
        }}
      >
        <Button
          title={editing ? 'Save changes' : 'Create routine'}
          loading={busy}
          onPress={save}
        />
      </View>

      <ExercisePicker
        visible={picking}
        alreadyAdded={rows.map((r) => r.exerciseId)}
        onClose={() => setPicking(false)}
        onAdd={onAdd}
      />
    </View>
  );
}

function Target({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Txt variant="caption" tone="t3" style={{ marginBottom: 4 }}>{label}</Txt>
      <TextInput
        value={value === undefined ? '' : String(value)}
        onChangeText={(t) => onChange(num(t))}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={color.t4}
        accessibilityLabel={label}
        style={{
          height: 42,
          borderRadius: radius.sm,
          backgroundColor: color.surface2,
          borderWidth: 1,
          borderColor: color.line,
          color: color.t1,
          paddingHorizontal: space.md,
          fontFamily: font,
          fontSize: 15,
        }}
      />
    </View>
  );
}

function Small({
  label,
  onPress,
  disabled,
  hint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  hint: string;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      style={{
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: color.line,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Txt variant="caption" tone="t2">{label}</Txt>
    </Pressable>
  );
}
