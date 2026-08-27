import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Row, Txt } from '../../src/ui';
import { Notice } from '../../src/ui/Notice';
import { color, space } from '../../src/ui/theme';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { useImportRoutine, useSharedRoutine } from '../../src/api/queries';

/**
 * A shared routine link: musclex://r/<token> or https://<host>/r/<token>.
 *
 * Shows what the routine contains BEFORE adding it. Someone tapping a stranger's
 * link should see the workout first rather than have it silently appear in
 * their list.
 */
export default function SharedRoutineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { data, isLoading, isError } = useSharedRoutine(token ?? null);
  const importRoutine = useImportRoutine();
  const [result, setResult] = useState<{ name: string; missing: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <Loading label="Opening routine" />;

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Shared routine" />
      <ScrollView contentContainerClassName="gap-3 px-4">
        {isError || !data ? (
          <Empty
            title="This link is not valid"
            body="It may have been mistyped, or the routine was never shared."
          />
        ) : result ? (
          <>
            <Notice
              tone="success"
              title={`Added "${result.name}" to your routines`}
              body={
                result.missing.length
                  ? `Your gym does not stock: ${result.missing.join(', ')}. Everything else was added.`
                  : undefined
              }
            />
            <Button title="Open my routines" onPress={() => router.replace('/routines')} />
          </>
        ) : (
          <>
            {error ? <Notice title="Could not add it" body={error} onDismiss={() => setError(null)} /> : null}

            <Card>
              <Txt variant="title">{data.name}</Txt>
              <Txt variant="small" tone="t2" className="mt-2">
                {data.exerciseCount} exercises
                {data.importCount > 0
                  ? ` · added by ${data.importCount} ${data.importCount === 1 ? 'person' : 'people'}`
                  : ''}
              </Txt>
            </Card>

            <Card>
              <Label>What's in it</Label>
              {data.exercises.map((e, i) => (
                <Row key={i} className="mt-3">
                  <Txt variant="body" className="flex-1">{e.name}</Txt>
                  {e.targetSets ? (
                    <Txt variant="caption" tone="t3">
                      {e.targetSets} sets{e.targetReps ? ` × ${e.targetReps}` : ''}
                    </Txt>
                  ) : null}
                </Row>
              ))}
            </Card>

            <Txt variant="caption" tone="t3" style={{ textAlign: 'center' }}>
              You get your own copy to edit. Changes the author makes later will not
              affect it.
            </Txt>

            <Button
              title="Add to my routines"
              loading={importRoutine.isPending}
              onPress={async () => {
                setError(null);
                try {
                  const res = await importRoutine.mutateAsync(token!);
                  setResult({ name: res.routine.name, missing: res.missing });
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
