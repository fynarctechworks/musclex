import { useEffect } from 'react';
import { View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Screen,
  SkeletonCard,
  Txt,
  useThemeColors,
} from '../../src/design-system';
import {
  useLeaderboard,
  useCommunityChallenges,
  useBadges,
  useJoinChallenge,
} from '../../src/api/queries';
import { track } from '../../src/analytics';
import type { ChallengeItem, LeaderboardEntry, CommunityBadge } from '../../src/api/types';

/**
 * Community tab (BLUEPRINT.md Module 12 / V2.5). Everything here is REAL: the
 * leaderboard ranks live gym check-ins, challenge progress is computed from the
 * member's real activity, and badges are earned from real stats. No fake feeds.
 */
export default function CommunityScreen() {
  const challenges = useCommunityChallenges();
  const leaderboard = useLeaderboard(30);
  const badges = useBadges();
  const join = useJoinChallenge();

  useEffect(() => {
    track({ name: 'community_viewed' });
  }, []);

  const loading = challenges.isLoading && leaderboard.isLoading && badges.isLoading;

  return (
    <Screen
      scroll
      padded={false}
      onRefresh={() => {
        challenges.refetch();
        leaderboard.refetch();
        badges.refetch();
      }}
      refreshing={challenges.isRefetching}
    >
      <View className="overflow-hidden px-md pb-lg pt-md">
        <Txt variant="mono" className="text-ink/70">
          TRAIN TOGETHER
        </Txt>
        <Txt variant="display-lg" weight="600" className="mt-xs text-ink">
          Community
        </Txt>
      </View>

      <View className="gap-lg px-md">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {/* ── Challenges ── */}
            <View className="gap-sm">
              <Txt variant="caption" className="text-mute">
                CHALLENGES
              </Txt>
              {(challenges.data?.challenges ?? []).length === 0 ? (
                <Card>
                  <EmptyState
                    compact
                    icon="flame"
                    title="No active challenges"
                    message="When your gym launches a challenge, you'll be able to join it here."
                  />
                </Card>
              ) : (
                challenges.data!.challenges!.map((c) => (
                  <ChallengeCard
                    key={c.id}
                    challenge={c}
                    pending={join.isPending && join.variables === c.id}
                    onJoin={() => {
                      if (c.id) {
                        join.mutate(c.id);
                        track({ name: 'challenge_joined', challengeId: c.id });
                      }
                    }}
                  />
                ))
              )}
            </View>

            {/* ── Leaderboard ── */}
            <View className="gap-sm">
              <View className="flex-row items-center justify-between">
                <Txt variant="caption" className="text-mute">
                  ATTENDANCE LEADERBOARD
                </Txt>
                <Txt variant="caption" className="text-mute">
                  LAST 30 DAYS
                </Txt>
              </View>
              {(leaderboard.data?.entries ?? []).length === 0 ? (
                <Card>
                  <EmptyState
                    compact
                    icon="users"
                    title="No check-ins yet"
                    message="Check in at the gym to climb the leaderboard."
                  />
                </Card>
              ) : (
                <Card noPadding>
                  {leaderboard.data!.entries!.map((e, i) => (
                    <LeaderRow
                      key={`${e.rank}-${e.name}-${i}`}
                      entry={e}
                      last={i === leaderboard.data!.entries!.length - 1}
                    />
                  ))}
                </Card>
              )}
              {leaderboard.data?.myRank ? (
                <Txt variant="body-sm" className="text-body">
                  {`You're #${leaderboard.data.myRank} with ${leaderboard.data.myValue} check-in${
                    leaderboard.data.myValue === 1 ? '' : 's'
                  }.`}
                </Txt>
              ) : null}
            </View>

            {/* ── Badges ── */}
            <View className="gap-sm">
              <View className="flex-row items-center justify-between">
                <Txt variant="caption" className="text-mute">
                  BADGES
                </Txt>
                <Txt variant="caption" className="text-mute">
                  {badges.data?.earnedCount ?? 0}/{badges.data?.badges?.length ?? 0}
                </Txt>
              </View>
              <View className="flex-row flex-wrap gap-sm">
                {(badges.data?.badges ?? []).map((b) => (
                  <BadgeTile key={b.key} badge={b} />
                ))}
              </View>
            </View>
          </>
        )}

        <View className="h-2xl" />
      </View>
    </Screen>
  );
}

function ChallengeCard({
  challenge: c,
  pending,
  onJoin,
}: {
  challenge: ChallengeItem;
  pending: boolean;
  onJoin: () => void;
}) {
  const goal = c.goal ?? 0;
  const theme = useThemeColors();
  const progress = c.progress ?? 0;
  const ratio = goal > 0 ? Math.min(1, progress / goal) : 0;
  return (
    <Card elevated>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-md">
          <Txt variant="body-lg" weight="600" className="text-ink">
            {c.title}
          </Txt>
          {c.description ? (
            <Txt variant="body-sm" className="mt-xxs text-body">
              {c.description}
            </Txt>
          ) : null}
        </View>
        {c.completed ? (
          <Badge label="DONE" tone="success" />
        ) : c.joined ? (
          <Badge label="JOINED" tone="neutral" />
        ) : null}
      </View>

      {c.joined ? (
        <View className="mt-md">
          <View className="flex-row items-center justify-between">
            <Txt variant="caption" className="text-mute">
              {progress}/{goal} {c.metric === 'workouts' ? 'workouts' : 'check-ins'}
            </Txt>
            <Txt variant="caption" className="text-mute">
              {Math.round(ratio * 100)}%
            </Txt>
          </View>
          <View className="mt-xs h-[6px] overflow-hidden rounded-full bg-surface-2">
            <View
              style={{
                width: `${ratio * 100}%`,
                height: '100%',
                backgroundColor: c.completed ? theme.successFg : theme.cyan,
              }}
            />
          </View>
        </View>
      ) : (
        <View className="mt-md flex-row items-center justify-between">
          <Txt variant="caption" className="text-mute">
            {c.participantCount ?? 0} joined · goal {goal}
          </Txt>
          <Button title="Join" size="sm" loading={pending} onPress={onJoin} />
        </View>
      )}
    </Card>
  );
}

function LeaderRow({ entry, last }: { entry: LeaderboardEntry; last: boolean }) {
  return (
    <View
      className={`flex-row items-center justify-between px-md py-sm ${
        last ? '' : 'border-b border-hairline'
      } ${entry.isMe ? 'bg-surface-2' : ''}`}
    >
      <View className="flex-1 flex-row items-center gap-md pr-md">
        <Txt
          variant="body-md"
          weight="600"
          className={entry.rank && entry.rank <= 3 ? 'text-ink' : 'text-mute'}
          style={{ width: 28 }}
        >
          {entry.rank}
        </Txt>
        <Txt
          variant="body-md"
          weight={entry.isMe ? '600' : '400'}
          className="flex-1 text-ink"
          numberOfLines={1}
        >
          {entry.name}
          {entry.isMe ? ' (you)' : ''}
        </Txt>
      </View>
      <Txt variant="body-sm" weight="500" className="text-body">
        {entry.value}
      </Txt>
    </View>
  );
}

function BadgeTile({ badge }: { badge: CommunityBadge }) {
  const theme = useThemeColors();
  const earned = !!badge.earned;
  return (
    <View className="items-center" style={{ width: '22%' }}>
      <View
        className="aspect-square w-full items-center justify-center rounded-xl border"
        style={{
          backgroundColor: earned ? theme.accentSoft : theme.surface,
          borderColor: earned ? theme.cyan : theme.hairline,
          opacity: earned ? 1 : 0.5,
        }}
      >
        <Icon name={earned ? 'check' : 'flame'} color={earned ? theme.cyan : theme.mute} size={22} />
      </View>
      <Txt variant="caption" className="mt-xxs text-center text-mute" numberOfLines={2}>
        {badge.label}
      </Txt>
    </View>
  );
}
