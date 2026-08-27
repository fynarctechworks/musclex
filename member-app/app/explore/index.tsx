import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Empty, Loading, Row, Txt } from '../../src/ui';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { useExplore } from '../../src/api/queries';

/**
 * EXPLORE — ready-made workouts, written centrally and identical for every
 * member at every gym.
 *
 * Adding one produces a personal routine in the member's own gym, so Explore is
 * a source of routines rather than a parallel place workouts can live.
 */

const DIFFICULTY: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading } = useExplore();

  if (isLoading) return <Loading label="Loading workouts" />;
  const categories = data?.categories ?? [];

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Explore" />
      <ScrollView contentContainerClassName="gap-6 px-4 pb-32">
        {categories.length === 0 ? (
          <Empty title="Nothing here yet" body="Ready-made workouts will appear here." />
        ) : (
          categories.map((cat) => (
            <View key={cat.category} className="gap-2">
              <Txt variant="label" tone="t3">{cat.label}</Txt>
              {cat.workouts.map((w) => (
                <Pressable
                  key={w.slug}
                  onPress={() => router.push(`/explore/${w.slug}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${w.title}`}
                >
                  <Card>
                    <Row className="items-start">
                      <View className="flex-1 pr-3">
                        <Txt variant="heading">{w.title}</Txt>
                        <Row className="mt-2 justify-start gap-2">
                          <View className="border-border bg-secondary h-6 justify-center rounded-full border px-3">
                            <Txt variant="caption" tone="t2" className="font-semibold">
                              {DIFFICULTY[w.difficulty] ?? w.difficulty}
                            </Txt>
                          </View>
                          <Txt variant="caption" tone="t3">
                            {w.durationMinutes ? `${w.durationMinutes} min · ` : ''}
                            {w.exerciseCount} exercises
                          </Txt>
                        </Row>
                        {w.addCount > 0 ? (
                          <Txt variant="caption" tone="t4" className="mt-1">
                            Added by {w.addCount} {w.addCount === 1 ? 'member' : 'members'}
                          </Txt>
                        ) : null}
                      </View>
                    </Row>
                  </Card>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
