import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Empty, Loading, Row, Txt } from '../../src/ui';
import { color, radius, space } from '../../src/ui/theme';
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
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Explore" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.xl }}>
        {categories.length === 0 ? (
          <Empty title="Nothing here yet" body="Ready-made workouts will appear here." />
        ) : (
          categories.map((cat) => (
            <View key={cat.category} style={{ gap: space.sm }}>
              <Txt variant="label" tone="t3">{cat.label}</Txt>
              {cat.workouts.map((w) => (
                <Pressable
                  key={w.slug}
                  onPress={() => router.push(`/explore/${w.slug}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${w.title}`}
                >
                  <Card>
                    <Row style={{ alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, paddingRight: space.md }}>
                        <Txt variant="heading">{w.title}</Txt>
                        <Row style={{ justifyContent: 'flex-start', gap: space.sm, marginTop: space.sm }}>
                          <View
                            style={{
                              paddingHorizontal: space.md,
                              height: 24,
                              borderRadius: radius.pill,
                              backgroundColor: color.surface2,
                              borderWidth: 1,
                              borderColor: color.line,
                              justifyContent: 'center',
                            }}
                          >
                            <Txt variant="caption" tone="t2" style={{ fontWeight: '600' }}>
                              {DIFFICULTY[w.difficulty] ?? w.difficulty}
                            </Txt>
                          </View>
                          <Txt variant="caption" tone="t3">
                            {w.durationMinutes ? `${w.durationMinutes} min · ` : ''}
                            {w.exerciseCount} exercises
                          </Txt>
                        </Row>
                        {w.addCount > 0 ? (
                          <Txt variant="caption" tone="t4" style={{ marginTop: 4 }}>
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
