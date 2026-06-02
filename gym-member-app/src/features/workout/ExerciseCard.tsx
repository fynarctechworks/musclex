import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Card, Icon, Stepper, Txt, colors } from '../../design-system';
import type { Exercise, SetLog } from '../../api/types';

export interface LoggedSet {
  reps: number;
  weight: number;
  done: boolean;
}

/**
 * One exercise with swipe-light set logging: steppers for reps/weight, tap to
 * complete a set, prefilled from the member's last log (PRD §6.4 — one-thumb,
 * minimal typing).
 */
export function ExerciseCard({
  exercise,
  onChange,
}: {
  exercise: Exercise;
  onChange: (exerciseId: string, sets: LoggedSet[]) => void;
}) {
  const target = exercise.targetSets ?? 3;
  const prefillReps = exercise.lastLog?.reps ?? exercise.targetReps ?? 10;
  const prefillWeight = exercise.lastLog?.weight ?? 20;

  const [sets, setSets] = useState<LoggedSet[]>(
    Array.from({ length: target }, () => ({
      reps: prefillReps,
      weight: prefillWeight,
      done: false,
    })),
  );

  function update(next: LoggedSet[]) {
    setSets(next);
    onChange(exercise.id ?? '', next);
  }

  function patch(i: number, p: Partial<LoggedSet>) {
    update(sets.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  }

  const doneCount = sets.filter((s) => s.done).length;

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-sm pr-md">
          {exercise.mediaUrl ? (
            <Image
              source={{ uri: exercise.mediaUrl }}
              style={{ width: 44, height: 44, borderRadius: 8 }}
              className="bg-surface-2"
            />
          ) : null}
          <View className="flex-1">
            <Txt variant="body-lg" weight="600" className="text-ink">
              {exercise.name}
            </Txt>
            <Txt variant="caption" className="text-mute">
              {target} sets {'×'} {exercise.targetReps ?? prefillReps} reps target
            </Txt>
          </View>
        </View>
        <Txt variant="caption" weight="500" className="text-success-fg">
          {doneCount}/{sets.length}
        </Txt>
      </View>

      <View className="mt-md gap-sm">
        {sets.map((s, i) => (
          <View
            key={i}
            className={`flex-row items-center justify-between rounded-md border p-sm ${
              s.done ? 'border-accent-soft bg-accent-soft' : 'border-hairline bg-surface-2'
            }`}
          >
            <Txt variant="body-sm" weight="500" className="w-[44px] text-body">
              Set {i + 1}
            </Txt>
            <Stepper
              value={s.weight}
              step={2.5}
              suffix="kg"
              onChange={(weight) => patch(i, { weight })}
            />
            <Stepper
              value={s.reps}
              step={1}
              suffix="rp"
              onChange={(reps) => patch(i, { reps })}
            />
            <Pressable
              onPress={() => patch(i, { done: !s.done })}
              hitSlop={8}
              className="h-[32px] w-[32px] items-center justify-center rounded-full"
              style={{
                backgroundColor: s.done ? colors.successFg : 'transparent',
                borderWidth: s.done ? 0 : 1.5,
                borderColor: colors.hairlineStrong,
              }}
            >
              {s.done ? <Icon name="check" color={colors.canvas} size={18} /> : null}
            </Pressable>
          </View>
        ))}
      </View>

      <Pressable
        className="mt-sm self-start"
        hitSlop={8}
        onPress={() =>
          update([...sets, { reps: prefillReps, weight: prefillWeight, done: false }])
        }
      >
        <Txt variant="body-sm" weight="500" className="text-success-fg">
          + Add set
        </Txt>
      </Pressable>
    </Card>
  );
}

/** Flatten the per-exercise logged sets into the contract SetLog[] payload. */
export function toSetLogs(map: Record<string, LoggedSet[]>): SetLog[] {
  const out: SetLog[] = [];
  for (const [exerciseId, sets] of Object.entries(map)) {
    sets
      .filter((s) => s.done)
      .forEach((s, idx) =>
        out.push({
          exerciseId,
          setNumber: idx + 1,
          reps: s.reps,
          weight: s.weight,
          unit: 'kg',
        }),
      );
  }
  return out;
}
