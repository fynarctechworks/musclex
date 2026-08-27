import { Pressable, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, Row, Txt } from '../ui';
import { cn } from '@/lib/utils';
import { useExerciseHistory } from '../api/queries';
import { useUnits } from '../lib/use-units';

import type { WorkingSet } from './sets';
import { Icon } from '../ui/Icon';
export type { WorkingSet };

/**
 * One exercise inside a running session.
 *
 * The PREVIOUS column and the placeholder values come from this member's own
 * last session for this lift. That is what makes logging near-typeless: most
 * people repeat last session give or take a rep, so an empty row that already
 * *shows* the right numbers only needs a tap to commit.
 *
 * Values are kept as strings so a half-typed "6" never becomes 6kg on blur.
 *
 * COLUMN WIDTHS stay inline. The set/previous/input/tick grid has to line up
 * between the header and every row, so the widths are defined once as shared
 * constants rather than repeated as classes that could drift apart.
 */

/** One column grid, shared by the header and every set row. */
const COL = {
  set: { width: 24 },
  prev: { flex: 1 },
  input: { width: 68 },
  wide: { width: 144 },
  tick: { width: 40 },
} as const;

/** Placeholder ink — ink-4, the decorative step. Inline: RN takes a prop. */
const PLACEHOLDER = '#a6a09b';

export function ExerciseBlock({
  exerciseId,
  name,
  trackingType = 'reps',
  sets,
  onChange,
  onComplete,
  onRemove,
}: {
  exerciseId: string;
  name: string;
  /** 'duration' swaps the weight/reps columns for a single seconds field. */
  trackingType?: 'reps' | 'duration';
  sets: WorkingSet[];
  onChange: (next: WorkingSet[]) => void;
  onComplete: () => void;
  onRemove: () => void;
}) {
  const { data: history } = useExerciseHistory(exerciseId);
  const u = useUnits();
  const previous = history?.sessions?.[0]?.sets ?? [];
  const pr = history?.personalRecord ?? null;

  function patch(i: number, p: Partial<WorkingSet>) {
    onChange(sets.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  }

  /**
   * Completing a set is the app's most-repeated action, so it does three things
   * at once: fills anything left blank from last session, carries the values
   * into the next row, and starts the rest timer. Un-completing is a
   * correction and does none of them.
   */
  const timed = trackingType === 'duration';

  function toggle(i: number) {
    const cur = sets[i];
    const nowDone = !cur.done;
    if (!nowDone) return onChange(sets.map((s, idx) => (idx === i ? { ...s, done: false } : s)));

    const p = previous[i];
    // `previous` comes back in kg; the field the member sees is in their unit.
    const kg = cur.kg || (p?.weight != null ? u.w(p.weight) : '');
    const reps = cur.reps || String(p?.reps ?? '');
    const secs = cur.secs || String(p?.durationSeconds ?? '');

    // A rep set needs reps; a timed set needs seconds. Weight may legitimately
    // be zero (bodyweight), but an empty set is not a set — completing an
    // untouched row used to log 0kg x 0, which then came back as the "previous"
    // value and poisoned the next session's prefill.
    if (timed ? !Number(secs) : !Number(reps)) {
      // Buzz rather than doing nothing at all: a tap that silently fails reads
      // as a broken button.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onChange(
      sets.map((s, idx) => {
        if (idx === i) return { ...s, kg, reps, secs, done: true };
        if (idx === i + 1 && !s.done && !s.kg && !s.reps && !s.secs)
          return { ...s, kg, reps, secs };
        return s;
      }),
    );
    onComplete();
  }

  function addSet() {
    const last = sets[sets.length - 1];
    onChange([
      ...sets,
      { kg: last?.kg ?? '', reps: last?.reps ?? '', secs: last?.secs ?? '', done: false },
    ]);
  }

  /** Shared by every numeric field so a done row cannot style differently. */
  const inputClass = (done: boolean) =>
    cn(
      'h-10 rounded-md border text-center text-base font-semibold',
      done
        ? 'border-success/30 bg-success/10 text-foreground'
        : 'border-border bg-secondary text-foreground',
    );

  return (
    <Card>
      <Row className="items-start">
        <View className="flex-1 pr-3">
          <Txt variant="heading">{name}</Txt>
          <Txt variant="caption" tone="t3" className="mt-0.5">
            {pr
              ? timed
                ? `Best ${pr.reps}s`
                : `PR ${u.fwc(pr.weight)} × ${pr.reps}`
              : previous.length
                ? `Last time · ${previous.length} sets`
                : 'No history yet'}
          </Txt>
        </View>
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${name}`}>
          <Txt variant="caption" tone="t3">
            Remove
          </Txt>
        </Pressable>
      </Row>

      <View className="border-border mb-2 mt-4 flex-row items-center gap-2 border-t pt-3">
        <Txt variant="label" tone="t4" style={COL.set}>
          Set
        </Txt>
        <Txt variant="label" tone="t4" style={COL.prev}>
          Previous
        </Txt>
        {timed ? (
          <Txt variant="label" tone="t4" style={COL.wide}>
            Seconds
          </Txt>
        ) : (
          <>
            <Txt variant="label" tone="t4" style={COL.input}>
              {u.weightUnit}
            </Txt>
            <Txt variant="label" tone="t4" style={COL.input}>
              Reps
            </Txt>
          </>
        )}
        <View style={COL.tick} />
      </View>

      {sets.map((s, i) => {
        const p = previous[i];
        return (
          <View key={i} className="mb-2 flex-row items-center gap-2">
            <Txt variant="small" tone="t3" className="text-center" style={COL.set}>
              {i + 1}
            </Txt>
            <Txt variant="caption" tone="t3" style={COL.prev}>
              {!p
                ? '--'
                : timed
                  ? `${p.durationSeconds ?? 0}s`
                  : `${u.fwc(p.weight)} × ${p.reps}`}
            </Txt>
            {timed ? (
              <TextInput
                value={s.secs}
                onChangeText={(v) => patch(i, { secs: v })}
                editable={!s.done}
                keyboardType="number-pad"
                placeholder={
                  // Today's plan beats last session's number; on a pyramid the
                  // two disagree deliberately.
                  s.target?.secs !== undefined
                    ? String(s.target.secs)
                    : p?.durationSeconds
                      ? String(p.durationSeconds)
                      : '30'
                }
                placeholderTextColor={PLACEHOLDER}
                accessibilityLabel={`Set ${i + 1} seconds`}
                className={inputClass(s.done)}
                style={COL.wide}
              />
            ) : (
              <>
                <TextInput
                  value={s.kg}
                  onChangeText={(v) => patch(i, { kg: v })}
                  editable={!s.done}
                  keyboardType="decimal-pad"
                  placeholder={s.target?.kg ?? (p ? u.w(p.weight) : '0')}
                  placeholderTextColor={PLACEHOLDER}
                  accessibilityLabel={`Set ${i + 1} weight`}
                  className={inputClass(s.done)}
                  style={COL.input}
                />
                <TextInput
                  value={s.reps}
                  onChangeText={(v) => patch(i, { reps: v })}
                  editable={!s.done}
                  keyboardType="number-pad"
                  placeholder={
                    s.target?.reps !== undefined ? String(s.target.reps) : p ? String(p.reps) : '0'
                  }
                  placeholderTextColor={PLACEHOLDER}
                  accessibilityLabel={`Set ${i + 1} reps`}
                  className={inputClass(s.done)}
                  style={COL.input}
                />
              </>
            )}
            <Pressable
              onPress={() => toggle(i)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: s.done }}
              accessibilityLabel={`Complete set ${i + 1}`}
              className={cn(
                'h-10 items-center justify-center rounded-md border',
                s.done ? 'border-success bg-success' : 'border-border bg-secondary',
              )}
              style={COL.tick}>
              <Icon name="check" size={15} tone={s.done ? 'inverse' : 't4'} decorative />
            </Pressable>
          </View>
        );
      })}

      <Pressable
        onPress={addSet}
        className="items-center py-2 active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel="Add set">
        <Txt variant="small" tone="t2" className="font-semibold">
          + Add set
        </Txt>
      </Pressable>
    </Card>
  );
}
