import { useEffect } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  Badge,
  Card,
  ErrorState,
  Icon,
  Screen,
  SkeletonCard,
  Txt,
  useThemeColors,
} from '../../src/design-system';
import { ScreenHeader } from '../../src/navigation/ScreenHeader';
import { useExercise, useToggleFavorite } from '../../src/api/queries';
import { track } from '../../src/analytics';

export default function ExerciseDetailScreen() {
  const theme = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, refetch, isRefetching } = useExercise(id ?? '');
  const toggleFav = useToggleFavorite();

  useEffect(() => {
    if (data?.id) {
      track({ name: 'exercise_viewed', exerciseId: data.id, exerciseName: data.name ?? '' });
    }
  }, [data?.id]);

  return (
    <Screen scroll onRefresh={refetch} refreshing={isRefetching}>
      <View className="pt-md">
        <ScreenHeader />

        {isLoading ? (
          <View className="gap-md">
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : isError || !data ? (
          <Card>
            <ErrorState compact onRetry={refetch} retrying={isRefetching} />
          </Card>
        ) : (
          <>
            <View className="flex-row items-start justify-between">
              <Txt variant="display-lg" weight="600" className="flex-1 pr-md text-ink">
                {data.name}
              </Txt>
              <Pressable
                onPress={() =>
                  data.id &&
                  toggleFav.mutate({ id: data.id, favorited: !!data.favorited })
                }
                hitSlop={12}
                accessibilityLabel={data.favorited ? 'Remove favorite' : 'Add favorite'}
                className="h-[44px] w-[44px] items-center justify-center rounded-full border border-hairline bg-surface"
              >
                <Icon
                  name="heart"
                  filled={!!data.favorited}
                  color={data.favorited ? theme.error : theme.body}
                  size={22}
                />
              </Pressable>
            </View>
            <View className="mt-sm flex-row flex-wrap gap-xs">
              {data.muscleGroup ? <Badge label={data.muscleGroup.toUpperCase()} tone="neutral" /> : null}
              {data.equipment ? <Badge label={data.equipment.toUpperCase()} tone="neutral" /> : null}
            </View>

            {/* Media — real image/video when available; placeholder until then
               (we never fabricate media URLs). */}
            <View className="mt-lg aspect-video overflow-hidden rounded-2xl border border-hairline bg-surface-2">
              {data.mediaUrl ? (
                <Image source={{ uri: data.mediaUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Icon name="dumbbell" color={theme.mute} size={36} />
                  <Txt variant="caption" className="mt-xs text-mute">
                    Demo video coming soon
                  </Txt>
                </View>
              )}
            </View>

            {/* Instructions */}
            <Txt variant="caption" className="mb-sm mt-lg text-mute">
              HOW TO PERFORM
            </Txt>
            <Card>
              <Txt variant="body-md" className="text-body">
                {data.instructions || 'No instructions provided for this exercise yet.'}
              </Txt>
            </Card>
          </>
        )}

        <View className="h-2xl" />
      </View>
    </Screen>
  );
}
