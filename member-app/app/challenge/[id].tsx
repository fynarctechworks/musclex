import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Loading, Meter, Row, Txt } from '../../src/ui';
import { Notice } from '../../src/ui/Notice';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { chart } from '../../src/ui/chart-colors';
import { backOrHome } from '../../src/lib/nav';
import { daysLeft, formatMetric, METRIC_LABEL, progress } from '../../src/lib/challenge-metric';
import {
  useGroupChallenge,
  useInviteToChallenge,
  useLeaveChallenge,
  useSuggestions,
} from '../../src/api/queries';

/**
 * ONE CHALLENGE — the board, and who else could be on it.
 *
 * Says plainly what taking part publishes: your total for this metric, not
 * your activities. Somebody should be able to see that before they are on a
 * leaderboard, not work it out afterwards.
 */
export default function ChallengeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useGroupChallenge(id ?? null);
  const { data: suggested } = useSuggestions();
  const invite = useInviteToChallenge(id ?? '');
  const leave = useLeaveChallenge();

  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string } | null>(null);

  if (isLoading || !data) return <Loading label="Loading challenge" />;

  const leader = data.leaderboard[0];
  const me = data.leaderboard.find((r) => r.mine);
  const onBoard = new Set(data.leaderboard.map((r) => r.id));

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title={data.title} />
      <ScrollView
        contentContainerClassName="gap-3 px-4 pb-32"
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Label>{METRIC_LABEL[data.metric]}</Label>
          <Txt variant="display" className="mt-2">
            {formatMetric(data.metric, me?.value ?? 0)}
          </Txt>
          <Txt variant="small" tone="t2">
            {data.target
              ? `of ${formatMetric(data.metric, data.target)}`
              : 'most wins — no target'}
          </Txt>
          {data.target ? (
            <Meter
              value={progress(data.target, me?.value ?? 0) * 100}
              max={100}
              tint={(me?.value ?? 0) >= data.target ? chart.good : chart.accent}
            />
          ) : null}
          <Txt variant="caption" tone="t3" className="mt-3">
            {daysLeft(data.endsOn)} · {data.participantCount}{' '}
            {data.participantCount === 1 ? 'person' : 'people'}
          </Txt>
        </Card>

        <Card>
          <Label>Leaderboard</Label>
          {data.leaderboard.map((r) => (
            <Row key={r.id} className="mt-3">
              <View className="flex-1 flex-row items-center gap-3">
                <Txt variant="bodyStrong" tone={r.rank === 1 ? 'accent' : 't3'}>
                  {r.rank}
                </Txt>
                <Txt variant="body" style={{ fontWeight: r.mine ? '700' : '400' }}>
                  {r.mine ? 'You' : r.name || 'Someone'}
                </Txt>
              </View>
              <Txt variant="bodyStrong">{formatMetric(data.metric, r.value)}</Txt>
            </Row>
          ))}
          {leader && me && !me.mine ? null : null}
        </Card>

        {/* Said before they are on a board, not discovered afterwards. */}
        <Card>
          <Label>What this shares</Label>
          <Txt variant="small" tone="t2" className="mt-2">
            Everyone here sees your total for {METRIC_LABEL[data.metric].toLowerCase()} — not your
            activities. Anything you kept private stays private; it just counts toward the number.
          </Txt>
        </Card>

        {(suggested?.people ?? []).some((p) => !onBoard.has(p.id)) ? (
          <Card>
            <Label>Add someone</Label>
            {(suggested?.people ?? [])
              .filter((p) => !onBoard.has(p.id))
              .slice(0, 5)
              .map((p) => (
                <Row key={p.id} className="mt-3">
                  <Txt variant="body" className="flex-1">{p.name || 'Someone'}</Txt>
                  <Button
                    title="Add"
                    variant="secondary"
                    size="sm"
                    loading={invite.isPending}
                    onPress={async () => {
                      try {
                        await invite.mutateAsync(p.id);
                        setNotice({ tone: 'success', title: `Added ${p.name ?? 'them'}` });
                      } catch {
                        setNotice({ tone: 'error', title: 'Could not add them' });
                      }
                    }}
                  />
                </Row>
              ))}
          </Card>
        ) : null}

        <Button
          title="Leave this challenge"
          variant="quiet"
          size="sm"
          loading={leave.isPending}
          onPress={async () => {
            await leave.mutateAsync(data.id);
            backOrHome(router);
          }}
        />
      </ScrollView>
    </View>
  );
}
