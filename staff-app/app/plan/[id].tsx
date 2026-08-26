import React from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { DataList } from '@/ui/DataList';
import { RowCard } from '@/ui/RowCard';
import { useWorkoutPlan } from '@/api/queries';
import {
  describeDifficulty, describeGoal, describeMuscleGroup, describePrescription,
} from '@/lib/training';
import type { PlanExercise } from '@/api/types';
import { tokens } from '@/ui/tokens';

/**
 * A workout plan, in the order it is performed.
 *
 * Ordered by `position`, not by whatever order the API returned. A plan is a
 * SEQUENCE — squats before the finisher — and showing it shuffled turns a
 * prescription into a list of suggestions.
 */
export default function PlanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useWorkoutPlan(id);
  const plan = query.data;

  const exercises = React.useMemo(() => {
    const list = plan?.exercises ?? [];
    return [...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [plan?.exercises]);

  const goal = describeGoal(plan?.goal);
  const difficulty = describeDifficulty(plan?.difficulty);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: plan?.title ?? 'Plan' }} />
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: tokens.background }}>
        <DataList<PlanExercise>
          data={exercises}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
          keyExtractor={(e) => e.id}
          emptyTitle="No exercises in this plan"
          emptyBody="Exercises added on the web show up here."
          ListHeaderComponent={
            plan ? (
              <View className="mb-3 gap-2 rounded-xl border border-border bg-card p-4">
                {plan.description ? (
                  <Text className="text-sm text-muted-foreground">{plan.description}</Text>
                ) : null}
                <View className="flex-row flex-wrap gap-2">
                  {goal ? <Badge variant="secondary"><Text>{goal}</Text></Badge> : null}
                  {difficulty ? (
                    <Badge variant="secondary"><Text>{difficulty}</Text></Badge>
                  ) : null}
                  <Badge variant="secondary">
                    <Text>
                      {exercises.length} exercise{exercises.length === 1 ? '' : 's'}
                    </Text>
                  </Badge>
                </View>
                {plan.created_by?.full_name ? (
                  <Text className="text-xs text-muted-foreground">
                    Built by {plan.created_by.full_name}
                  </Text>
                ) : null}
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const prescription = describePrescription(item);
            return (
              <RowCard
                // The position a coach calls out, not the array index.
                initials={String(item.position ?? index + 1)}
                title={item.exercise?.name ?? 'Exercise'}
                subtitle={describeMuscleGroup(item.exercise?.muscle_group)}
                // Omitted entirely when nothing is prescribed, rather than
                // rendering a stray separator.
                meta={prescription || undefined}
                chevron={false}
                testID={`plan-exercise-${item.id}`}
              />
            );
          }}
        />
      </SafeAreaView>
    </>
  );
}
