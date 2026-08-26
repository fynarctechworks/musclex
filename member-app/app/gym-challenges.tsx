import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Loading, Meter, Row, Txt } from '../src/ui';
import { Notice } from '../src/ui/Notice';
import { color, space } from '../src/ui/theme';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { useBadges, useChallenges, useJoinChallenge, useLeaderboard } from '../src/api/queries';
import { Icon } from '../src/ui/Icon';

/**
 * GYM CHALLENGES — badges and leaderboards inside one gym.
 *
 * Renamed from "Community", which it never was: this screen is challenges,
 * badges and a gym leaderboard, and it took the name that the app's actual
 * social surface needed. The Community TAB is the social layer; this is one
 * card inside it.
 *
 * Deliberately not a following graph or a public feed: a member competes with
 * people they actually see on the floor, which is the part of Strava that
 * transfers to a gym and the part that needs no moderation.
 */
export default function GymChallengesScreen() {
  const insets = useSafeAreaInsets();
  const { data: challenges, isLoading } = useChallenges();
  const { data: badges } = useBadges();
  const { data: board } = useLeaderboard();
  const join = useJoinChallenge();
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <Loading label="Loading community" />;

  const earned = (badges?.badges ?? []).filter((b) => b.earned);
  const locked = (badges?.badges ?? []).filter((b) => !b.earned);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Gym challenges" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}>
        {error ? (
          <Notice title="Could not join" body={error} onDismiss={() => setError(null)} />
        ) : null}
        <Card>
          <Label>
            Leaderboard · {board?.metric ?? 'check-ins'} · {board?.periodDays ?? 30} days
          </Label>
          {(board?.entries ?? []).slice(0, 10).map((e) => (
            <Row key={e.rank} style={{ marginTop: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1 }}>
                <Txt variant="small" tone="t4" style={{ width: 20 }}>{e.rank}</Txt>
                <Txt variant="body" tone={e.isMe ? 'accent' : 't1'}
                  style={{ fontWeight: e.isMe ? '700' : '400' }}>
                  {e.isMe ? 'You' : e.name}
                </Txt>
              </View>
              <Txt variant="bodyStrong" tone={e.isMe ? 'accent' : 't2'}>{e.value}</Txt>
            </Row>
          ))}
          {board && board.myRank === null ? (
            <Txt variant="caption" tone="t3" style={{ marginTop: space.md }}>
              You are not on the board yet. Check in to join it.
            </Txt>
          ) : null}
        </Card>

        <Card>
          <Label>Challenges</Label>
          {(challenges?.challenges ?? []).length === 0 ? (
            <Txt variant="small" tone="t2" style={{ marginTop: space.md }}>
              No challenges running at your gym right now.
            </Txt>
          ) : (
            (challenges?.challenges ?? []).map((c) => (
              <View key={c.id} style={{ marginTop: space.lg }}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: space.md }}>
                    <Txt variant="bodyStrong">{c.title}</Txt>
                    {c.description ? (
                      <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>{c.description}</Txt>
                    ) : null}
                  </View>
                  <Button
                    title={c.joined ? 'Joined' : 'Join'}
                    variant={c.joined ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={c.joined}
                    loading={join.isPending}
                    onPress={() =>
                      join
                        .mutateAsync(c.id)
                        .catch((e) =>
                          setError(e instanceof Error ? e.message : 'Could not join that challenge.'),
                        )
                    }
                  />
                </Row>
                {c.target ? (
                  <>
                    <Meter value={c.progress ?? 0} max={c.target} tint={color.accent} />
                    <Txt variant="caption" tone="t3" style={{ marginTop: space.sm }}>
                      {c.progress ?? 0} / {c.target} {c.metric ?? ''}
                    </Txt>
                  </>
                ) : null}
              </View>
            ))
          )}
        </Card>

        <Card>
          <Label>Badges · {earned.length} earned</Label>
          <View style={{ marginTop: space.md, gap: space.md }}>
            {[...earned, ...locked].map((b) => (
              <Row key={b.key} style={{ opacity: b.earned ? 1 : 0.45 }}>
                <View style={{ flex: 1, paddingRight: space.md }}>
                  <Txt variant="bodyStrong" tone={b.earned ? 't1' : 't2'}>{b.label}</Txt>
                  <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>{b.description}</Txt>
                </View>
                {/* Meaningful, and NOT restated in visible text — so it keeps
                    a label rather than being hidden. */}
                <Icon
                  name={b.earned ? 'badge' : 'locked'}
                  size={22}
                  tone={b.earned ? 'accent' : 't4'}
                  accessibilityLabel={b.earned ? 'Earned' : 'Not earned yet'}
                />
              </Row>
            ))}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
