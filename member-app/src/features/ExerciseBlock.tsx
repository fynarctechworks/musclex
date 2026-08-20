import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, Row, Txt } from '../ui';
import { font, color, radius, space } from '../ui/theme';
import { useExerciseHistory } from '../api/queries';
import { useUnits } from '../lib/use-units';

import type { WorkingSet } from './sets';
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
 */
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

  return (
    <Card>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: space.md }}>
          <Txt variant="heading">{name}</Txt>
          <Txt variant="caption" tone="t3" style={{ marginTop: 3 }}>
            {pr
              ? timed
                ? `Best ${pr.reps}s`
                : `PR ${u.fwc(pr.weight)} × ${pr.reps}`
              : previous.length
                ? `Last time · ${previous.length} sets`
                : 'No history yet'}
          </Txt>
        </View>
        <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button"
          accessibilityLabel={`Remove ${name}`}>
          <Txt variant="caption" tone="t3">Remove</Txt>
        </Pressable>
      </Row>

      <View style={st.head}>
        <Txt variant="caption" tone="t4" style={[st.cSet, st.headTxt]}>Set</Txt>
        <Txt variant="caption" tone="t4" style={[st.cPrev, st.headTxt]}>Previous</Txt>
        {timed ? (
          <Txt variant="caption" tone="t4" style={[st.cWide, st.headTxt]}>Seconds</Txt>
        ) : (
          <>
            <Txt variant="caption" tone="t4" style={[st.cIn, st.headTxt]}>{u.weightUnit}</Txt>
            <Txt variant="caption" tone="t4" style={[st.cIn, st.headTxt]}>Reps</Txt>
          </>
        )}
        <View style={st.cTick} />
      </View>

      {sets.map((s, i) => {
        const p = previous[i];
        return (
          <View key={i} style={st.row}>
            <Txt variant="small" tone="t3" style={[st.cSet, { textAlign: 'center' }]}>
              {i + 1}
            </Txt>
            <Txt variant="caption" tone="t3" style={st.cPrev}>
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
                placeholder={p?.durationSeconds ? String(p.durationSeconds) : '30'}
                placeholderTextColor={color.t4}
                accessibilityLabel={`Set ${i + 1} seconds`}
                style={[st.input, st.cWide, s.done && st.inputDone]}
              />
            ) : (
              <>
                <TextInput
                  value={s.kg}
                  onChangeText={(v) => patch(i, { kg: v })}
                  editable={!s.done}
                  keyboardType="decimal-pad"
                  placeholder={p ? u.w(p.weight) : '0'}
                  placeholderTextColor={color.t4}
                  accessibilityLabel={`Set ${i + 1} weight`}
                  style={[st.input, st.cIn, s.done && st.inputDone]}
                />
                <TextInput
                  value={s.reps}
                  onChangeText={(v) => patch(i, { reps: v })}
                  editable={!s.done}
                  keyboardType="number-pad"
                  placeholder={p ? String(p.reps) : '0'}
                  placeholderTextColor={color.t4}
                  accessibilityLabel={`Set ${i + 1} reps`}
                  style={[st.input, st.cIn, s.done && st.inputDone]}
                />
              </>
            )}
            <Pressable
              onPress={() => toggle(i)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: s.done }}
              accessibilityLabel={`Complete set ${i + 1}`}
              style={[st.tick, st.cTick, s.done && st.tickDone]}
            >
              <Txt variant="small" style={{ color: s.done ? color.goodInk : color.t4, fontWeight: '700' }}>
                ✓
              </Txt>
            </Pressable>
          </View>
        );
      })}

      <Pressable onPress={addSet} style={st.add} accessibilityRole="button" accessibilityLabel="Add set">
        <Txt variant="small" tone="t2" style={{ fontWeight: '600' }}>+ Add set</Txt>
      </Pressable>
    </Card>
  );
}

const st = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.line,
    marginBottom: space.sm,
  },
  headTxt: { letterSpacing: 0.8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  cSet: { width: 24 },
  cPrev: { flex: 1 },
  cIn: { width: 68 },
  cWide: { width: 144 },
  cTick: { width: 40 },
  input: {
    height: 40,
    borderRadius: radius.md,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line,
    color: color.t1,
    textAlign: 'center',
    fontFamily: font,
    fontSize: 15,
    fontWeight: '600',
  },
  inputDone: { backgroundColor: color.goodSoft, borderColor: color.goodEdge },
  tick: {
    height: 40,
    borderRadius: radius.md,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickDone: { backgroundColor: color.good, borderColor: color.good },
  add: { paddingVertical: space.sm, alignItems: 'center' },
});
