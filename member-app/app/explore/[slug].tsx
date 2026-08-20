import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Row, Txt } from '../../src/ui';
import { Notice } from '../../src/ui/Notice';
import { color, space } from '../../src/ui/theme';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { useAddExploreWorkout, useExploreWorkout } from '../../src/api/queries';

/** One Explore workout: what it contains, before you commit to it. */
export default function ExploreDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, isLoading, isError } = useExploreWorkout(slug ?? null);
  const add = useAddExploreWorkout();
  const [added, setAdded] = useState<{ name: string; missing: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <Loading label="Loading workout" />;
  if (isError || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
        <ScreenHeader title="Explore" />
        <Empty title="Workout unavailable" body="It may have been removed." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title={data.title} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}>
        {added ? (
          <>
            <Notice
              tone="success"
              title={`Added "${added.name}" to your routines`}
              body={
                added.missing.length
                  ? `Your gym does not stock: ${added.missing.join(', ')}. Everything else was added.`
                  : undefined
              }
            />
            <Button title="Open my routines" onPress={() => router.replace('/routines')} />
          </>
        ) : (
          <>
            {error ? <Notice title="Could not add it" body={error} onDismiss={() => setError(null)} /> : null}

            {data.description ? (
              <Card>
                <Txt variant="body" tone="t2" style={{ lineHeight: 22 }}>{data.description}</Txt>
              </Card>
            ) : null}

            <Card>
              <Row>
                <View>
                  <Txt variant="heading">{data.exercises.length}</Txt>
                  <Txt variant="caption" tone="t3">exercises</Txt>
                </View>
                {data.durationMinutes ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt variant="heading">{data.durationMinutes}</Txt>
                    <Txt variant="caption" tone="t3">minutes</Txt>
                  </View>
                ) : null}
              </Row>
            </Card>

            <Card>
              <Label>What's in it</Label>
              {data.exercises.map((e, i) => (
                <Row key={i} style={{ marginTop: space.md }}>
                  <Txt variant="body" style={{ flex: 1, paddingRight: space.md }}>{e.name}</Txt>
                  <Txt variant="caption" tone="t3">
                    {e.targetDurationSeconds
                      ? `${e.targetSets ?? 1} × ${e.targetDurationSeconds}s`
                      : `${e.targetSets ?? 3} × ${e.targetReps ?? 10}`}
                  </Txt>
                </Row>
              ))}
            </Card>

            <Button
              title="Add to my routines"
              loading={add.isPending}
              onPress={async () => {
                setError(null);
                try {
                  const res = await add.mutateAsync(slug!);
                  setAdded({ name: res.routine.name, missing: res.missing });
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Please try again.');
                }
              }}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}
