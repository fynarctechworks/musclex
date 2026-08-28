import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Meter, Row, Txt } from '../src/ui';
import { Chip } from '../src/ui/Chip';
import { Notice } from '../src/ui/Notice';
import { Field } from '../src/ui/Field';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { chart } from '../src/ui/chart-colors';
import { daysLeft, METRIC_LABEL, type Metric } from '../src/lib/challenge-metric';
import { useCreateGroupChallenge, useGroupChallenges } from '../src/api/queries';

/**
 * GROUP CHALLENGES — contests a member makes, not the gym.
 *
 * Kept apart from the gym's own challenges on Community: same word, different
 * feature, different owner. Mixing them would leave nobody sure who set the
 * target or who can see their name on it.
 */
const METRICS: Metric[] = ['distance_m', 'elapsed_seconds', 'activity_count', 'elevation_m'];

/** Sensible default window: today through the end of the month. */
function defaultWindow() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { startsOn: iso(now), endsOn: iso(end) };
}

export default function ChallengesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useGroupChallenges();
  const create = useCreateGroupChallenge();

  const [making, setMaking] = useState(false);
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<Metric>('distance_m');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  if (isLoading) return <Loading label="Loading challenges" />;

  const challenges = data?.challenges ?? [];

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Challenges" />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#79716b" />
        }
        contentContainerClassName="gap-3 px-4 pb-32"
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Row>
            <Label>Start one</Label>
            {!making ? (
              <Button title="New" variant="secondary" size="sm" onPress={() => setMaking(true)} />
            ) : null}
          </Row>
          {making ? (
            <>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {METRICS.map((m) => (
                  <Chip
                    key={m}
                    label={METRIC_LABEL[m]}
                    active={metric === m}
                    onPress={() => setMetric(m)}
                  />
                ))}
              </View>
              <Row className="mt-3 gap-2">
                <Field
                  value={title}
                  onChangeText={setTitle}
                  placeholder="What are you racing for?"
                  accessibilityLabel="Challenge name"
                  autoFocus
                className="flex-1" />
                <Button
                  title="Create"
                  size="sm"
                  disabled={title.trim().length < 2}
                  loading={create.isPending}
                  onPress={async () => {
                    try {
                      const ch = await create.mutateAsync({
                        title: title.trim(),
                        metric,
                        ...defaultWindow(),
                      });
                      setTitle('');
                      setMaking(false);
                      router.push(`/challenge/${ch.id}`);
                    } catch (e) {
                      setNotice({
                        tone: 'error',
                        title: 'Could not create it',
                        body: e instanceof Error ? e.message : undefined,
                      });
                    }
                  }}
                />
              </Row>
              <Txt variant="caption" tone="t3" className="mt-2">
                Runs from today to the end of the month. Invite people from inside it.
              </Txt>
            </>
          ) : (
            <Txt variant="small" tone="t2" className="mt-2">
              Race your friends on distance, time, climbing or plain number of workouts.
            </Txt>
          )}
        </Card>

        {challenges.length === 0 ? (
          <Empty
            title="No challenges yet"
            body="Start one above, or wait for somebody to add you to theirs."
          />
        ) : (
          challenges.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/challenge/${c.id}`)}
              accessibilityRole="button"
              accessibilityLabel={c.title}
            >
              <Card>
                <Row className="items-start">
                  <View className="flex-1 pr-3">
                    <Txt variant="bodyStrong">{c.title}</Txt>
                    <Txt variant="caption" tone="t3" className="mt-0.5">
                      {METRIC_LABEL[c.metric]} · {c.participantCount}{' '}
                      {c.participantCount === 1 ? 'person' : 'people'} · {daysLeft(c.endsOn)}
                    </Txt>
                  </View>
                </Row>
                {c.target ? <Meter value={0} max={1} tint={chart.line} /> : null}
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
