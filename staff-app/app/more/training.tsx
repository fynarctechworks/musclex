import React from 'react';
import { View } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataList } from '@/ui/DataList';
import { RowCard } from '@/ui/RowCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { useExercises, useWorkoutPlans } from '@/api/queries';
import {
  MUSCLE_GROUPS, describeDifficulty, describeGoal, describeMuscleGroup,
} from '@/lib/training';
import type { Exercise, WorkoutPlan } from '@/api/types';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * TRAINING — the gym's plans and its exercise library
 * ────────────────────────────────────────────────────────────────
 *
 * Read-only. Authoring a plan needs `members.create`/`edit`, which the trainer
 * role does not have — the same permissions question as measurements
 * (TODO_FOR_ME item 7). Building an editor the primary user cannot open would
 * be work aimed at nobody, so this ships as the reference a trainer actually
 * uses on the floor and the editor waits on that decision.
 */
export default function Training() {
  const [tab, setTab] = React.useState<'plans' | 'exercises'>('plans');

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Training' }} />
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: tokens.background }}>
        <View className="px-4 pb-3 pt-3">
          <SegmentedControl
            value={tab}
            onChange={(v) => setTab(v as 'plans' | 'exercises')}
            segments={[
              { value: 'plans', label: 'Plans' },
              { value: 'exercises', label: 'Exercises' },
            ]}
            testID="training-tabs"
          />
        </View>

        {tab === 'plans' ? <PlansTab /> : <ExercisesTab />}
      </SafeAreaView>
    </>
  );
}

function PlansTab() {
  const query = useWorkoutPlans();
  const plans = query.data?.data ?? [];

  return (
    <DataList<WorkoutPlan>
      data={plans}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      onRefresh={() => void query.refetch()}
      isRefreshing={query.isFetching && !query.isLoading}
      keyExtractor={(p) => p.id}
      emptyTitle="No plans yet"
      emptyBody="Workout plans built on the web show up here."
      renderItem={({ item }) => {
        const goal = describeGoal(item.goal);
        const difficulty = describeDifficulty(item.difficulty);
        return (
          <RowCard
            title={item.title}
            subtitle={item.description ?? undefined}
            meta={[goal, difficulty].filter(Boolean).join(' · ') || undefined}
            onPress={() => router.push(`/plan/${item.id}`)}
            trailing={
              item.is_template ? (
                <Badge variant="secondary"><Text>Template</Text></Badge>
              ) : undefined
            }
            testID={`plan-${item.id}`}
          />
        );
      }}
    />
  );
}

function ExercisesTab() {
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [group, setGroup] = React.useState<string>('');

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useExercises({
    search: debounced || undefined,
    muscleGroup: group || undefined,
  });
  const exercises = query.data?.data ?? [];

  return (
    <>
      <View className="gap-3 px-4 pb-3">
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises"
          autoCapitalize="none"
          testID="exercise-search"
        />
        <SegmentedControl
          value={group}
          onChange={setGroup}
          // 'All' first so clearing the filter is one tap, not a hunt.
          segments={[
            { value: '', label: 'All' },
            ...MUSCLE_GROUPS.slice(0, 4).map((g) => ({
              value: g, label: describeMuscleGroup(g),
            })),
          ]}
          testID="exercise-group"
        />
      </View>

      <DataList<Exercise>
        data={exercises}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        keyExtractor={(e) => e.id}
        emptyTitle="No exercises"
        emptyBody={
          debounced
            ? `Nothing matched “${debounced}”.`
            : 'The exercise library is empty for this gym.'
        }
        renderItem={({ item }) => (
          <RowCard
            title={item.name}
            subtitle={describeMuscleGroup(item.muscle_group)}
            meta={item.equipment ?? undefined}
            chevron={false}
            testID={`exercise-${item.id}`}
          />
        )}
      />
    </>
  );
}
