import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataList } from '@/ui/DataList';
import { RowCard } from '@/ui/RowCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { useExercises, useMuscleHeads, useWorkoutPlans } from '@/api/queries';
import { MUSCLE_GROUPS, describeDifficulty, describeGoal, describeMuscle, describeMuscleGroup, describeTargetMuscle } from '@/lib/training';
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
  const [head, setHead] = React.useState<string>('');

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useExercises({
    search: debounced || undefined,
    muscleGroup: group || undefined,
    targetMuscle: head || undefined,
  });
  const heads = useMuscleHeads(group || undefined).data?.data ?? [];
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
        {/*
          A scrolling chip row, not a SegmentedControl.
          
          The control divides its width evenly between segments, so five of
          them left each about 68pt — "Shoulders" wrapped to "Should / ers".
          It also forced `.slice(0, 4)`, which quietly made Legs, Core, Cardio
          and Full body UNREACHABLE: a trainer could not filter to legs at all
          in a 1,323-movement library.

          Chips size to their own text and scroll, so every group is reachable
          and none of them wrap.
        */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 16 }}
          // Without this a tap that lands mid-scroll is swallowed.
          keyboardShouldPersistTaps="handled">
          {[{ value: '', label: 'All' },
            ...MUSCLE_GROUPS.map((g) => ({ value: g, label: describeMuscleGroup(g) })),
          ].map((seg) => {
            const active = group === seg.value;
            return (
              <Pressable
                key={seg.value || 'all'}
                onPress={() => {
                  setGroup(seg.value);
                  // A head belongs to one group; keeping "rear delts" selected
                  // while switching to Legs would return nothing and look
                  // broken.
                  setHead('');
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filter by ${seg.label}`}
                className={active ? 'rounded-full bg-primary' : 'rounded-full border border-border bg-card'}
                style={{ height: 36, justifyContent: 'center', paddingHorizontal: 14 }}
                testID={`exercise-group-${seg.value || 'all'}`}>
                <Text
                  className={active ? 'text-[14px] font-medium' : 'text-[14px] text-muted-foreground'}
                  style={active ? { color: tokens.card } : undefined}
                  numberOfLines={1}>
                  {seg.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/*
          Sub-filter: the heads WITHIN the chosen group. Hidden until a group
          is picked — across the whole library it would be twenty chips, which
          is a worse way to find a movement than the search box right above it.
          Also hidden when the group has only one head, where the chip would
          filter nothing.
        */}
        {group && heads.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 16 }}
            keyboardShouldPersistTaps="handled">
            {[{ target_muscle: '', count: 0 }, ...heads].map((h) => {
              const active = head === h.target_muscle;
              const label = h.target_muscle
                ? `${describeTargetMuscle(h.target_muscle)} ${h.count}`
                : 'All';
              return (
                <Pressable
                  key={h.target_muscle || 'all'}
                  onPress={() => setHead(h.target_muscle)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={
                    h.target_muscle
                      ? `Filter by ${describeTargetMuscle(h.target_muscle)}, ${h.count} exercises`
                      : 'All heads'
                  }
                  // Selected state is IDENTICAL to the group row above —
                  // solid ink, white label. An outline-when-selected here read
                  // as a different kind of control rather than as the same
                  // control one level down. Only the height differs, which is
                  // what keeps the two rows legible as a hierarchy.
                  className={
                    active ? 'rounded-full bg-primary' : 'rounded-full border border-border bg-card'
                  }
                  style={{ height: 30, justifyContent: 'center', paddingHorizontal: 12 }}
                  testID={`exercise-head-${h.target_muscle || 'all'}`}>
                  <Text
                    className={active ? 'text-[13px] font-medium' : 'text-[13px] text-muted-foreground'}
                    style={active ? { color: tokens.card } : undefined}
                    numberOfLines={1}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
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
            leading={
              item.thumb_url ? (
                <Image
                  source={{ uri: item.thumb_url }}
                  style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: tokens.border }}
                  // The still, not the GIF: a hundred animating images in a
                  // scrolling list is a lot of decode for no extra meaning.
                  // The animation earns its place on a detail view.
                  resizeMode="cover"
                  // Decorative — the name beside it already says what it is.
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              ) : undefined
            }
            title={item.name}
            subtitle={describeMuscle(item.muscle_group, item.target_muscle)}
            meta={item.equipment ?? undefined}
            onPress={() => router.push(`/exercise/${item.id}`)}
            testID={`exercise-${item.id}`}
          />
        )}
      />
    </>
  );
}
