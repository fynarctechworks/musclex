import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Screen,
  SkeletonCard,
  Txt,
} from '../../src/design-system';
import { useLogWorkout, useTodayWorkout, qk } from '../../src/api/queries';
import {
  ExerciseCard,
  toSetLogs,
  type LoggedSet,
} from '../../src/features/workout/ExerciseCard';
import { RestTimer } from '../../src/features/workout/RestTimer';

export default function WorkoutScreen() {
  const { data: workout, isLoading, refetch, isRefetching } = useTodayWorkout();
  const qc = useQueryClient();
  const [logged, setLogged] = useState<Record<string, LoggedSet[]>>({});
  const [submitted, setSubmitted] = useState(false);

  const log = useLogWorkout(workout?.id ?? '');

  const sets = useMemo(() => toSetLogs(logged), [logged]);
  const completedCount = sets.length;

  async function onFinish() {
    if (!workout?.id || completedCount === 0) return;
    await log.mutateAsync(sets);
    setSubmitted(true);
    qc.invalidateQueries({ queryKey: qk.todayWorkout });
  }

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
        ) : !workout ? (
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
        ) : (
          <>
            <View className="mt-xs mb-lg flex-row items-center gap-sm">
              <Txt variant="body-md" className="text-body">
                {workout.title}
              </Txt>
              {workout.assignedBy ? (
                <Badge label={`by ${workout.assignedBy}`} tone="neutral" />
              ) : null}
            </View>

            <RestTimer />

            <View className="mt-md gap-md">
              {(workout.exercises ?? []).map((ex) => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  onChange={(id, s) =>
                    setLogged((prev) => ({ ...prev, [id]: s }))
                  }
                />
              ))}
            </View>

            <View className="mt-lg">
              <Button
                title={
                  submitted
                    ? 'Workout logged ✓'
                    : completedCount > 0
                      ? `Finish — log ${completedCount} sets`
                      : 'Complete a set to finish'
                }
                fullWidth
                disabled={completedCount === 0 || submitted}
                loading={log.isPending}
                onPress={onFinish}
              />
              {log.data?.newPersonalRecords?.length ? (
                <Card soft className="mt-md">
                  <Txt variant="body-md" weight="600" className="text-success-fg">
                    🎉 New personal record!
                  </Txt>
                  <Txt variant="body-sm" className="mt-xxs text-body">
                    You beat your previous best on{' '}
                    {log.data.newPersonalRecords.length} lift(s).
                  </Txt>
                </Card>
              ) : null}
            </View>
          </>
        )}
        <View className="h-2xl" />
      </View>
    </Screen>
  );
}
