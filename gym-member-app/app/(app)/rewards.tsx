import { useRouter } from 'expo-router';
import { View } from 'react-native';
import {
  Badge,
  Card,
  EmptyState,
  Icon,
  ProgressRing,
  Screen,
  SkeletonCard,
  Txt,
  useThemeColors,
} from '../../src/design-system';
import { useBadges, useCommunityChallenges, useHome } from '../../src/api/queries';
import type { ChallengeItem, CommunityBadge } from '../../src/api/types';

/**
 * Rewards tab — the "what you've earned" surface (BLUEPRINT.md Module 12). Real
 * data only: the streak comes from the unified Home payload, challenges and their
 * progress are server-computed, and badges are earned from real stats. Doubles as
 * the entry to the referral (invite & earn) program.
 */
export default function RewardsScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const { data: home } = useHome();
  const challengesQ = useCommunityChallenges();
  const badgesQ = useBadges();

  const streak = home?.streak?.days ?? 0;
  const challenges = challengesQ.data?.challenges ?? [];
  const badges = badgesQ.data?.badges ?? [];
  const earnedCount = badgesQ.data?.earnedCount ?? badges.filter((b) => b.earned).length;
  const loading = challengesQ.isLoading && badgesQ.isLoading;

  return (
    <Screen scroll padded={false}>
      <View className="px-md pb-md pt-xs">
        <Txt variant="mono" className="text-ink/70">
          KEEP IT GOING
        </Txt>
        <Txt variant="display-lg" weight="600" className="mt-xs text-ink">
          Rewards
        </Txt>
      </View>

      <View className="gap-md px-md">
        {/* Streak — the headline reward you protect each day. */}
        <Card elevated>
          <View className="flex-row items-center">
            <ProgressRing
              progress={Math.min(streak, 7) / 7}
              size={84}
              strokeWidth={9}
              color={streak > 0 ? theme.primary : theme.surface2}
            >
              <View className="items-center">
                <Txt variant="display-sm" weight="600" className="text-ink">
                  {streak}
                </Txt>
                <Txt variant="caption" className="text-mute">
                  {streak === 1 ? 'DAY' : 'DAYS'}
                </Txt>
              </View>
            </ProgressRing>
            <View className="ml-lg flex-1">
              <View className="flex-row items-center gap-xs">
                <Icon name="flame" color={streak > 0 ? theme.warning : theme.mute} size={16} />
                <Txt variant="caption" className="text-mute">
                  ACTIVITY STREAK
                </Txt>
              </View>
              <Txt variant="body-md" className="mt-xxs text-body">
                {streak > 0
                  ? `${streak} day${streak === 1 ? '' : 's'} in a row — keep it alive.`
                  : 'Check in, log a workout, or log a meal to start.'}
              </Txt>
            </View>
          </View>
        </Card>

        {/* Invite & earn */}
        <Card onPress={() => router.push('/referral')}>
          <View className="flex-row items-center">
            <View
              className="h-[44px] w-[44px] items-center justify-center rounded-full"
              style={{ backgroundColor: theme.primary + '22' }}
            >
              <Icon name="gift" color={theme.accent} size={22} filled />
            </View>
            <View className="ml-md flex-1">
              <Txt variant="body-lg" weight="600" className="text-ink">
                Invite & earn
              </Txt>
              <Txt variant="body-sm" className="text-body">
                Share your code — you both get rewarded.
              </Txt>
            </View>
            <Icon name="chevron-right" color={theme.mute} size={20} />
          </View>
        </Card>

        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {/* Challenges */}
            <Txt variant="caption" className="text-mute">
              CHALLENGES
            </Txt>
            {challenges.length ? (
              challenges.map((c) => <ChallengeRow key={c.id} c={c} theme={theme} />)
            ) : (
              <Card>
                <EmptyState
                  compact
                  icon="flame"
                  title="No active challenges"
                  message="Your gym hasn't launched a challenge yet. Check back soon."
                />
              </Card>
            )}

            {/* Badges */}
            <View className="mt-xs flex-row items-center justify-between">
              <Txt variant="caption" className="text-mute">
                BADGES
              </Txt>
              <Txt variant="caption" className="text-mute">
                {`${earnedCount} earned`}
              </Txt>
            </View>
            {badges.length ? (
              <View className="flex-row flex-wrap gap-md">
                {badges.map((b) => (
                  <BadgeTile key={b.key} b={b} theme={theme} />
                ))}
              </View>
            ) : (
              <Card>
                <EmptyState
                  compact
                  icon="check"
                  title="No badges yet"
                  message="Earn badges by checking in, logging workouts, and hitting goals."
                />
              </Card>
            )}
          </>
        )}

        <View className="h-2xl" />
      </View>
    </Screen>
  );
}

function ChallengeRow({ c, theme }: { c: ChallengeItem; theme: ReturnType<typeof useThemeColors> }) {
  const goal = c.goal ?? 0;
  const progress = c.progress ?? 0;
  const pct = goal > 0 ? Math.min(1, progress / goal) : 0;
  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Txt variant="body-lg" weight="600" className="flex-1 pr-md text-ink">
          {c.title}
        </Txt>
        {c.completed ? <Badge label="DONE" tone="success" /> : c.joined ? <Badge label="JOINED" tone="neutral" /> : null}
      </View>
      {c.description ? (
        <Txt variant="body-sm" className="mt-xxs text-body">
          {c.description}
        </Txt>
      ) : null}
      <View className="mt-md h-[8px] overflow-hidden rounded-full" style={{ backgroundColor: theme.surface2 }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: theme.primary }} />
      </View>
      <Txt variant="caption" className="mt-xs text-mute">
        {`${progress} / ${goal} ${c.metric ?? ''}`.trim()}
      </Txt>
    </Card>
  );
}

function BadgeTile({ b, theme }: { b: CommunityBadge; theme: ReturnType<typeof useThemeColors> }) {
  return (
    <View className="w-[30%] items-center">
      <View
        className="h-[60px] w-[60px] items-center justify-center rounded-full"
        style={{ backgroundColor: b.earned ? theme.primary + '22' : theme.surface2, opacity: b.earned ? 1 : 0.55 }}
      >
        <Icon name="medal" color={b.earned ? theme.accent : theme.mute} size={28} filled={b.earned} />
      </View>
      <Txt variant="caption" weight={b.earned ? '600' : '400'} className="mt-xs text-center text-body" numberOfLines={2}>
        {b.label}
      </Txt>
    </View>
  );
}
