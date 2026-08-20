import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Meter, Row, Txt } from '../src/ui';
import { Chip } from '../src/ui/Chip';
import { Notice } from '../src/ui/Notice';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { color, font, radius, space } from '../src/ui/theme';
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
  const { data, isLoading } = useGroupChallenges();
  const create = useCreateGroupChallenge();

  const [making, setMaking] = useState(false);
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<Metric>('distance_m');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  if (isLoading) return <Loading label="Loading challenges" />;

  const challenges = data?.challenges ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Challenges" />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}
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
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
                {METRICS.map((m) => (
                  <Chip
                    key={m}
                    label={METRIC_LABEL[m]}
                    active={metric === m}
                    onPress={() => setMetric(m)}
                  />
                ))}
              </View>
              <Row style={{ marginTop: space.md, gap: space.sm }}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="What are you racing for?"
                  placeholderTextColor={color.t4}
                  accessibilityLabel="Challenge name"
                  autoFocus
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: radius.md,
                    backgroundColor: color.surface2,
                    borderWidth: 1,
                    borderColor: color.line,
                    color: color.t1,
                    paddingHorizontal: space.lg,
                    fontFamily: font,
                    fontSize: 16,
                  }}
                />
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
              <Txt variant="caption" tone="t3" style={{ marginTop: space.sm }}>
                Runs from today to the end of the month. Invite people from inside it.
              </Txt>
            </>
          ) : (
            <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
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
                <Row style={{ alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: space.md }}>
                    <Txt variant="bodyStrong">{c.title}</Txt>
                    <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>
                      {METRIC_LABEL[c.metric]} · {c.participantCount}{' '}
                      {c.participantCount === 1 ? 'person' : 'people'} · {daysLeft(c.endsOn)}
                    </Txt>
                  </View>
                </Row>
                {c.target ? <Meter value={0} max={1} tint={color.line} /> : null}
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
