import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Dialog,
  ErrorState,
  MeshGradient,
  ProgressRing,
  Screen,
  SkeletonCard,
  Txt,
  colors,
} from '../../src/design-system';
import { useLogWorkout, useTodayWorkout, qk } from '../../src/api/queries';
import {
  ExerciseCard,
  toSetLogs,
  type LoggedSet,
} from '../../src/features/workout/ExerciseCard';
import { RestTimer } from '../../src/features/workout/RestTimer';

export default function WorkoutScreen() {
  const { data: workout, isLoading, isError, refetch, isRefetching } = useTodayWorkout();
  const qc = useQueryClient();
  const [logged, setLogged] = useState<Record<string, LoggedSet[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [prDismissed, setPrDismissed] = useState(false);

  const log = useLogWorkout(workout?.id ?? '');

  const sets = useMemo(() => toSetLogs(logged), [logged]);
  const completedCount = sets.length;
  const totalTarget = useMemo(
    () => (workout?.exercises ?? []).reduce((a, e) => a + (e.targetSets ?? 3), 0),
    [workout],
  );
  const progress = totalTarget > 0 ? completedCount / totalTarget : 0;

  const prCount = log.data?.newPersonalRecords?.length ?? 0;
  const showPR = prCount > 0 && !prDismissed;

  async function onFinish() {
    if (!workout?.id || completedCount === 0) return;
    await log.mutateAsync(sets);
    setSubmitted(true);
    qc.invalidateQueries({ queryKey: qk.todayWorkout });
  }

  // ── Loading / error / no-workout: plain header + state ──────────
  if (isLoading || (isError && !workout) || !workout) {
    return (
      <Screen scroll onRefresh={refetch} refreshing={isRefetching}>
        <View className="pt-md">
          <Txt variant="display-lg" weight="600" className="text-ink">
            Workout
          </Txt>
          {isLoading ? (
            <View className="mt-lg gap-md">
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : isError && !workout ? (
            <Card className="mt-lg">
              <ErrorState compact onRetry={refetch} retrying={isRefetching} />
            </Card>
          ) : (
            <Card className="mt-lg">
              <Txt variant="body-lg" weight="600" className="text-ink">
                No workout assigned today
              </Txt>
              <Txt variant="body-sm" className="mt-xs text-body">
                {'Your trainer hasn’t set a plan for today. Browse prebuilt plans or start a free session.'}
              </Txt>
              <View className="mt-md">
                <Button title="Browse plans" variant="secondary" size="md" disabled />
              </View>
              <Txt variant="caption" className="mt-xs text-mute">
                Prebuilt plans arrive in a later update.
              </Txt>
            </Card>
          )}
        </View>
      </Screen>
    );
  }

  // ── Active session ──────────────────────────────────────────────
  return (
    <Screen scroll padded={false} onRefresh={refetch} refreshing={isRefetching}>
      {/* Hero header with the brand mesh gradient + live session progress ring. */}
      <View className="overflow-hidden px-md pb-lg pt-md">
        <MeshGradient opacity={0.4} />
        <Txt variant="mono" className="text-ink/70">
          {'TODAY’S SESSION'}
        </Txt>
        <View className="mt-xs flex-row items-center justify-between">
          <View className="flex-1 pr-md">
            <Txt variant="display-lg" weight="600" className="text-ink">
              {workout.title ?? 'Workout'}
            </Txt>
            {workout.assignedBy ? (
              <View className="mt-xs self-start">
                <Badge label={`by ${workout.assignedBy}`} tone="neutral" />
              </View>
            ) : null}
          </View>
          <ProgressRing progress={progress} size={72} strokeWidth={8} color={colors.cyan}>
            <Txt variant="body-sm" weight="600" className="text-ink">
              {completedCount}/{totalTarget}
            </Txt>
          </ProgressRing>
        </View>
      </View>

      <View className="px-md">
        <RestTimer />

        <View className="mt-md gap-md">
          {(workout.exercises ?? []).map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              onChange={(id, s) => setLogged((prev) => ({ ...prev, [id]: s }))}
            />
          ))}
        </View>

        <View className="mt-lg">
          <Button
            title={
              submitted
                ? 'Workout logged ✓'
                : completedCount > 0
                  ? `Finish — log ${completedCount} set${completedCount === 1 ? '' : 's'}`
                  : 'Complete a set to finish'
            }
            fullWidth
            disabled={completedCount === 0 || submitted}
            loading={log.isPending}
            onPress={onFinish}
          />
        </View>

        <View className="h-2xl" />
      </View>

      {/* PR celebration (reuses the Dialog primitive). */}
      <Dialog
        visible={showPR}
        onClose={() => setPrDismissed(true)}
        title="New personal record! 🎉"
      >
        <Txt variant="body-md" className="text-body">
          {`You beat your previous best on ${prCount} lift${prCount === 1 ? '' : 's'}. Strong work.`}
        </Txt>
        <View className="mt-lg">
          <Button title="Nice!" fullWidth onPress={() => setPrDismissed(true)} />
        </View>
      </Dialog>
    </Screen>
  );
}
