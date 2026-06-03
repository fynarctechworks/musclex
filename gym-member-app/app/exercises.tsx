import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  MeshGradient,
  Screen,
  SkeletonCard,
  Txt,
  colors,
} from '../src/design-system';
import { BackButton } from '../src/navigation/BackButton';
import { useExercises, useToggleFavorite } from '../src/api/queries';
import { useDebouncedValue } from '../src/lib/use-debounced-value';
import { track } from '../src/analytics';
import type { ExerciseListItem } from '../src/api/types';

const MUSCLES: { label: string; value: string | null }[] = [
  { label: 'All', value: null },
  { label: 'Chest', value: 'chest' },
  { label: 'Back', value: 'back' },
  { label: 'Legs', value: 'legs' },
  { label: 'Shoulders', value: 'shoulders' },
  { label: 'Arms', value: 'arms' },
  { label: 'Core', value: 'core' },
  { label: 'Cardio', value: 'cardio' },
  { label: 'Full body', value: 'full_body' },
];

function subtitle(e: ExerciseListItem): string {
  return [e.muscleGroup, e.equipment].filter(Boolean).join(' · ') || 'Exercise';
}

export default function ExercisesScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data, isLoading, isError, refetch, isRefetching } = useExercises(
    debouncedQuery,
    muscle,
    favoritesOnly,
  );
  const toggleFav = useToggleFavorite();

  const exercises = data?.exercises ?? [];

  // Log a search/browse intent when the filters settle (debounced — not per keystroke).
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2 || muscle) {
      track({ name: 'exercise_library_searched', query: debouncedQuery.trim(), muscle });
    }
  }, [debouncedQuery, muscle]);

  return (
    <Screen scroll padded={false} onRefresh={refetch} refreshing={isRefetching}>
      {/* Hero header with the brand mesh gradient (design.md: hero scale only). */}
      <View className="overflow-hidden px-md pb-lg pt-md">
        <MeshGradient opacity={0.45} />
        <BackButton />
        <Txt variant="mono" className="text-ink/70">
          TRAIN SMARTER
        </Txt>
        <Txt variant="display-lg" weight="600" className="mt-xs text-ink">
          Exercises
        </Txt>
        <Txt variant="body-sm" className="mt-xxs text-body">
          Your gym's library — form cues for every lift
        </Txt>
      </View>

      <View className="px-md">
        <Input
          placeholder="Search exercises"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />

        {/* Muscle-group filter chips. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-md"
          contentContainerStyle={{ gap: 8, paddingRight: 16 }}
        >
          <Chip
            label="♥ Favorites"
            selected={favoritesOnly}
            onPress={() => setFavoritesOnly((v) => !v)}
          />
          {MUSCLES.map((m) => (
            <Chip
              key={m.label}
              label={m.label}
              selected={muscle === m.value}
              onPress={() => setMuscle(m.value)}
            />
          ))}
        </ScrollView>

        <View className="mt-md gap-sm">
          {isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : isError && !data ? (
            <Card>
              <ErrorState compact onRetry={refetch} retrying={isRefetching} />
            </Card>
          ) : exercises.length === 0 ? (
            <Card>
              <EmptyState
                compact
                icon="dumbbell"
                title="No exercises found"
                message="Try a different muscle group or search term."
              />
            </Card>
          ) : (
            exercises.map((e) => (
              <Card key={e.id} onPress={() => router.push(`/exercise/${e.id}`)}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-md">
                    <Txt variant="body-lg" weight="600" className="text-ink">
                      {e.name}
                    </Txt>
                    <Txt variant="body-sm" className="mt-xxs text-body">
                      {subtitle(e)}
                    </Txt>
                  </View>
                  <Pressable
                    onPress={() =>
                      e.id &&
                      toggleFav.mutate({ id: e.id, favorited: !!e.favorited })
                    }
                    hitSlop={12}
                    accessibilityLabel={e.favorited ? 'Remove favorite' : 'Add favorite'}
                    className="p-xs"
                  >
                    <Icon
                      name="heart"
                      filled={!!e.favorited}
                      color={e.favorited ? colors.error : colors.mute}
                      size={22}
                    />
                  </Pressable>
                </View>
              </Card>
            ))
          )}
        </View>

        <View className="h-2xl" />
      </View>
    </Screen>
  );
}
