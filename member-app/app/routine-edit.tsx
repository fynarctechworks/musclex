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
import { useUnits } from '../src/lib/use-units';
import { backOrHome } from '../src/lib/nav';
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

/**
 * Editor row.
 *
 * Targets are held as one entry PER SET rather than a single number, because a
 * pyramid (12/10/8) and ramping loads are ordinary programming that a uniform
 * "sets x reps" cannot express. Values are strings while editing so a
 * half-typed field stays exactly as typed instead of snapping to a parsed
 * number under the cursor.
 */
type SetTarget = { reps: string; kg: string; secs: string };

type Row = {
  exerciseId: string;
  name: string;
  thumbUrl?: string | null;
  trackingType?: 'reps' | 'duration';
  sets: SetTarget[];
};

const blankSet = (): SetTarget => ({ reps: '', kg: '', secs: '' });

/** Sets a newly added exercise starts with — enough to edit, few enough to trim. */
const DEFAULT_SETS = 3;

/**
 * Expand a saved routine back into editor rows.
 *
 * Handles BOTH shapes: a per-set array when the member built one, and the
 * older uniform `targetSets x targetReps` that every existing routine still
 * uses. Without this, opening an old routine would show zero sets.
 */
function toSets(e: RoutineExercise, showKg: (kg: number) => string): SetTarget[] {
  const perSet = e.targetRepsPerSet ?? e.targetSecondsPerSet;
  const count = perSet?.length ?? e.targetSets ?? DEFAULT_SETS;
  const str = (v: number | undefined) => (v === undefined ? '' : String(v));
  return Array.from({ length: Math.max(1, count) }, (_, i) => ({
    // Per-set value when there is one, else the uniform value repeated — an
    // old "3 x 10" routine should open showing 10 on each of its three rows.
    reps: str(e.targetRepsPerSet?.[i] ?? (e.targetRepsPerSet ? undefined : e.targetReps)),
    secs: str(
      e.targetSecondsPerSet?.[i] ?? (e.targetSecondsPerSet ? undefined : e.targetDurationSeconds),
    ),
    // Stored canonical kg -> the member's display unit. Skipping this shows
    // a pounds user their targets in kilos.
    kg: e.targetWeightPerSet?.[i] === undefined ? '' : showKg(e.targetWeightPerSet[i]),
  }));
}

/** Whole-number target (reps, seconds). Empty or junk clears it. */
function num(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Weight target in kg — two decimals, matching the stored numeric(6,2). */
function dec(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100) / 100;
}

/**
 * Fill blanks in a per-set column so a partly-filled plan still saves.
 *
 * Someone who types 12 on set 1 and leaves the rest empty means "12 across",
 * not "12 then nothing" — and the API rejects a 0 or missing element, so
 * sending the gaps raw would fail the whole save over an unfilled box.
 * Blanks inherit the previous value; leading blanks take the first real one.
 * All-blank returns undefined, which omits the array entirely.
 */
function fillGaps(values: (number | undefined)[]): number[] | undefined {
  if (!values.some((v) => v !== undefined)) return undefined;
  const first = values.find((v) => v !== undefined)!;
  let last = first;
  return values.map((v) => (v === undefined ? last : (last = v)));
}

export default function RoutineEditScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const u = useUnits();
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
        sets: toSets(e, u.w),
      })),
    );
    setHydrated(true);
  }, [editing, existing, hydrated, u]);

  if (editing && isLoading) return <Loading label="Loading routine" />;

  function patchSet(rowIndex: number, setIndex: number, next: Partial<SetTarget>) {
    setRows((rs) =>
      rs.map((r, i) =>
        i === rowIndex
          ? { ...r, sets: r.sets.map((st, n) => (n === setIndex ? { ...st, ...next } : st)) }
          : r,
      ),
    );
  }

  function addSet(rowIndex: number) {
    setRows((rs) => rs.map((r, i) => (i === rowIndex ? { ...r, sets: [...r.sets, blankSet()] } : r)));
  }

  function removeSet(rowIndex: number, setIndex: number) {
    setRows((rs) =>
      rs.map((r, i) =>
        // An exercise with no sets is not a prescription, so the last one stays.
        i === rowIndex && r.sets.length > 1
          ? { ...r, sets: r.sets.filter((_, n) => n !== setIndex) }
          : r,
      ),
    );
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
          sets: Array.from({ length: DEFAULT_SETS }, blankSet),
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

    const exercises = rows.map((r) => {
      const timed = r.trackingType === 'duration';
      const reps = fillGaps(r.sets.map((x) => num(x.reps)));
      const secs = fillGaps(r.sets.map((x) => num(x.secs)));
      // Back to canonical kg for the API, exactly as set logging does.
      const kg = fillGaps(
        r.sets.map((x) => {
          const v = dec(x.kg);
          return v === undefined ? undefined : Math.round(u.toKg(v) * 100) / 100;
        }),
      );
      return {
        exerciseId: r.exerciseId,
        // Sent for the case where NO targets are filled at all: the routine is
        // then just a running order, and the set count is the only shape it has.
        targetSets: r.sets.length,
        ...(timed ? (secs ? { targetSecondsPerSet: secs } : {}) : reps ? { targetRepsPerSet: reps } : {}),
        ...(kg ? { targetWeightPerSet: kg } : {}),
      };
    });

    try {
      if (editing) {
        await update.mutateAsync({ id, name: clean, exercises });
      } else {
        await create.mutateAsync({ name: clean, exercises });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      backOrHome(router);
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

                <Row style={{ marginTop: space.md, marginBottom: 2 }}>
                  <Txt variant="caption" tone="t3" style={{ width: 44 }}>Set</Txt>
                  <View style={{ flex: 1 }}>
                    <Txt variant="caption" tone="t3">{timed ? 'Seconds' : 'Reps'}</Txt>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="caption" tone="t3">{u.weightUnit}</Txt>
                  </View>
                  <View style={{ width: 34 }} />
                </Row>

                {r.sets.map((st, si) => (
                  <Row key={si} style={{ gap: space.sm, marginTop: space.sm }}>
                    <Txt variant="body" tone="t2" style={{ width: 44 }}>{si + 1}</Txt>
                    <Field
                      value={timed ? st.secs : st.reps}
                      onChange={(t) => patchSet(i, si, timed ? { secs: t } : { reps: t })}
                      label={`Set ${si + 1} ${timed ? 'seconds' : 'reps'}`}
                      placeholder={si === 0 ? '' : '—'}
                    />
                    <Field
                      value={st.kg}
                      onChange={(t) => patchSet(i, si, { kg: t })}
                      label={`Set ${si + 1} weight`}
                      placeholder={si === 0 ? '' : '—'}
                      decimal
                    />
                    <Small
                      label="×"
                      disabled={r.sets.length === 1}
                      onPress={() => removeSet(i, si)}
                      hint={`Remove set ${si + 1}`}
                    />
                  </Row>
                ))}

                <Row style={{ marginTop: space.md, justifyContent: 'flex-start' }}>
                  <Small label="+ Set" onPress={() => addSet(i)} hint={`Add a set to ${r.name}`} />
                  <Txt variant="caption" tone="t3" style={{ marginLeft: space.md }}>
                    Leave a box empty to repeat the set above.
                  </Txt>
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

/**
 * One target box. Holds the raw TEXT rather than a parsed number so a
 * half-typed "1" on the way to "12" is not swallowed by the parser.
 */
function Field({
  value,
  onChange,
  label,
  placeholder,
  decimal,
}: {
  value: string;
  onChange: (t: string) => void;
  label: string;
  placeholder?: string;
  decimal?: boolean;
}) {
  return (
    <View style={{ flex: 1 }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        placeholder={placeholder}
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
