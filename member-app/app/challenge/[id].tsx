import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Loading, Meter, Row, Txt } from '../../src/ui';
import { Notice } from '../../src/ui/Notice';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { color, space } from '../../src/ui/theme';
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
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title={data.title} />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Label>{METRIC_LABEL[data.metric]}</Label>
          <Txt variant="display" style={{ marginTop: space.sm }}>
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
              tint={(me?.value ?? 0) >= data.target ? color.good : color.accent}
            />
          ) : null}
          <Txt variant="caption" tone="t3" style={{ marginTop: space.md }}>
            {daysLeft(data.endsOn)} · {data.participantCount}{' '}
            {data.participantCount === 1 ? 'person' : 'people'}
          </Txt>
        </Card>

        <Card>
          <Label>Leaderboard</Label>
          {data.leaderboard.map((r) => (
            <Row key={r.id} style={{ marginTop: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1 }}>
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
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
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
                <Row key={p.id} style={{ marginTop: space.md }}>
                  <Txt variant="body" style={{ flex: 1 }}>{p.name || 'Someone'}</Txt>
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
