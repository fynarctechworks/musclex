import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Avatar,
  Badge,
  BarChart,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  MeshGradient,
  ProgressRing,
  Screen,
  SkeletonCard,
  Txt,
  colors,
} from '../../src/design-system';
import type { BarDatum } from '../../src/design-system';
import { useHome, useClasses } from '../../src/api/queries';
import { useAuth } from '../../src/auth/auth-store';
import { OccupancyCard } from '../../src/features/home/OccupancyCard';
import { formatTime, relativeFromNow } from '../../src/lib/format';
import type { ClassListItem, MembershipStatus } from '../../src/api/types';

const STATUS_TONE: Record<MembershipStatus, 'success' | 'warning' | 'error'> = {
  active: 'success',
  expiring: 'warning',
  frozen: 'warning',
  expired: 'error',
};

/**
 * Bucket upcoming classes into the next 7 days (count per day) for the "week
 * ahead" bar chart. Real data only — the series comes straight from the classes
 * the member can see; today is highlighted.
 */
function weekAhead(classes: ClassListItem[]): { bars: BarDatum[]; total: number } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const bars: BarDatum[] = [];
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(start);
    dayStart.setDate(start.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    const value = classes.filter((c) => {
      if (!c.startsAt) return false;
      const t = new Date(c.startsAt).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    }).length;
    total += value;
    bars.push({
      label: dayStart.toLocaleDateString(undefined, { weekday: 'narrow' }),
      value,
      highlight: i === 0,
    });
  }
  return { bars, total };
}

export default function Home() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useHome();
  const { data: classData } = useClasses();
  const profileName = useAuth((s) => s.profile?.name);

  const greeting =
    data?.greeting ?? (profileName ? `Hi, ${profileName.split(' ')[0]}` : 'Welcome back');
  const membership = data?.membership;
  const streak = data?.streak?.days ?? 0;
  const today = data?.todayWorkout;
  const nextClass = data?.nextClass;
  const week = weekAhead(classData?.classes ?? []);

  return (
    <Screen scroll padded={false} onRefresh={refetch} refreshing={isRefetching}>
      {/* Hero header with the brand mesh gradient (design.md: hero scale only). */}
      <View className="overflow-hidden px-md pb-lg pt-md">
        <MeshGradient opacity={0.5} />
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-md">
            <Txt variant="mono" className="text-ink/70">
              {new Date()
                .toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
                .toUpperCase()}
            </Txt>
            <Txt variant="display-lg" weight="600" className="mt-xs text-ink">
              {greeting}
            </Txt>
          </View>
          <View className="mt-xs flex-row items-center gap-xs">
            <Pressable
              onPress={() => router.push('/notifications')}
              hitSlop={10}
              accessibilityLabel="Notifications"
              className="h-[40px] w-[40px] items-center justify-center rounded-full border border-hairline bg-surface"
            >
              <Icon name="bell" color={colors.body} size={20} />
            </Pressable>
            <Pressable onPress={() => router.push('/profile')} hitSlop={10} accessibilityLabel="Profile">
              <Avatar name={profileName} size={40} />
            </Pressable>
          </View>
        </View>

      </View>

      <View className="gap-md px-md">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : isError && !data ? (
          <Card>
            <ErrorState compact onRetry={refetch} retrying={isRefetching} />
          </Card>
        ) : (
          <>
            {/* Today summary — the signature streak ring (Samsung-Health style),
               driven by real check-in streak data. */}
            <Card elevated>
              <View className="flex-row items-center">
                <ProgressRing
                  progress={Math.min(streak, 7) / 7}
                  size={92}
                  strokeWidth={9}
                  color={streak > 0 ? colors.cyan : colors.surface2}
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
                    <Icon name="flame" color={streak > 0 ? colors.warning : colors.mute} size={16} />
                    <Txt variant="caption" className="text-mute">
                      WORKOUT STREAK
                    </Txt>
                  </View>
                  <Txt variant="display-sm" weight="600" className="mt-xxs text-ink">
                    {streak > 0 ? 'Keep it going' : 'Start today'}
                  </Txt>
                  <Txt variant="body-sm" className="mt-xxs text-body">
                    {streak > 0
                      ? `You've trained ${streak} day${streak === 1 ? '' : 's'} in a row.`
                      : 'Check in at the gym to begin your streak.'}
                  </Txt>
                </View>
              </View>
            </Card>

            {/* Week ahead — real classes bucketed per day (today highlighted). */}
            <Card onPress={() => router.push('/classes')}>
              <View className="flex-row items-center justify-between">
                <Txt variant="caption" className="text-mute">
                  YOUR WEEK AHEAD
                </Txt>
                <Icon name="chevron-right" color={colors.mute} size={18} />
              </View>
              {week.total > 0 ? (
                <View className="mt-md">
                  <BarChart data={week.bars} height={116} />
                  <Txt variant="body-sm" className="mt-sm text-body">
                    {`${week.total} class${week.total === 1 ? '' : 'es'} you can book this week`}
                  </Txt>
                </View>
              ) : (
                <EmptyState
                  compact
                  icon="calendar"
                  title="No classes this week"
                  message="Your gym hasn't scheduled classes for the next 7 days yet."
                />
              )}
            </Card>

            {/* Membership status */}
            <Card elevated onPress={() => router.push('/membership')}>
              <View className="flex-row items-center justify-between">
                <Txt variant="caption" className="text-mute">
                  MEMBERSHIP
                </Txt>
                {membership?.status ? (
                  <Badge
                    label={membership.status.toUpperCase()}
                    tone={STATUS_TONE[membership.status]}
                  />
                ) : null}
              </View>
              <View className="mt-sm flex-row items-center justify-between">
                <View>
                  <Txt variant="body-lg" weight="600" className="text-ink">
                    {membership?.status === 'expired'
                      ? 'Membership expired'
                      : membership?.daysLeft != null
                        ? `${membership.daysLeft} days left`
                        : 'Active'}
                  </Txt>
                  {membership?.expiresOn ? (
                    <Txt variant="body-sm" className="text-body">
                      {`Renews / expires ${membership.expiresOn}`}
                    </Txt>
                  ) : null}
                </View>
                <Icon name="chevron-right" color={colors.mute} size={20} />
              </View>
              {membership &&
              (membership.status === 'expiring' || membership.status === 'expired') ? (
                <View className="mt-md">
                  <Button
                    title={membership.status === 'expired' ? 'Renew now' : 'Renew early'}
                    size="md"
                    onPress={() => router.push('/membership')}
                  />
                </View>
              ) : null}
            </Card>

            {/* Today's workout — pressable when assigned; designed empty state otherwise.
               (Empty is the common case until trainer/admin authoring exists — see PRD.) */}
            {today ? (
              <Card onPress={() => router.push('/workout')}>
                <Txt variant="caption" className="text-mute">
                  {'TODAY’S WORKOUT'}
                </Txt>
                <View className="mt-sm flex-row items-center justify-between">
                  <View className="flex-1 pr-md">
                    <Txt variant="body-lg" weight="600" className="text-ink">
                      {today.title}
                    </Txt>
                    <Txt variant="body-sm" className="text-body">
                      {`${today.exerciseCount ?? 0} exercises${
                        today.assignedBy ? ` · by ${today.assignedBy}` : ''
                      }`}
                    </Txt>
                  </View>
                  <Icon name="chevron-right" color={colors.mute} size={20} />
                </View>
              </Card>
            ) : (
              <Card>
                <Txt variant="caption" className="text-mute">
                  {'TODAY’S WORKOUT'}
                </Txt>
                <EmptyState
                  compact
                  icon="dumbbell"
                  title="No workout assigned yet"
                  message="Your trainer hasn’t set today’s plan. Browse plans to get started."
                  actionLabel="Browse plans"
                  onAction={() => router.push('/workout')}
                />
              </Card>
            )}

            {/* Next class — taps through to the full schedule to book. Always
               keep an entry point so members can browse even with none next. */}
            {nextClass ? (
              <Card onPress={() => router.push('/classes')}>
                <Txt variant="caption" className="text-mute">
                  NEXT CLASS
                </Txt>
                <View className="mt-sm flex-row items-center justify-between">
                  <View className="flex-1 pr-md">
                    <Txt variant="body-lg" weight="600" className="text-ink">
                      {nextClass.title}
                    </Txt>
                    <Txt variant="body-sm" className="text-body">
                      {`${formatTime(nextClass.startsAt)} · ${relativeFromNow(
                        nextClass.startsAt,
                      )}`}
                    </Txt>
                  </View>
                  <View className="flex-row items-center gap-sm">
                    {nextClass.seatsLeft != null ? (
                      <Badge label={`${nextClass.seatsLeft} seats`} tone="neutral" />
                    ) : null}
                    <Icon name="chevron-right" color={colors.mute} size={20} />
                  </View>
                </View>
              </Card>
            ) : (
              <Card onPress={() => router.push('/classes')}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-md">
                    <Txt variant="caption" className="text-mute">
                      CLASSES
                    </Txt>
                    <Txt variant="body-lg" weight="600" className="mt-xs text-ink">
                      Browse the schedule
                    </Txt>
                    <Txt variant="body-sm" className="text-body">
                      Book a spot in an upcoming class
                    </Txt>
                  </View>
                  <Icon name="chevron-right" color={colors.mute} size={20} />
                </View>
              </Card>
            )}

            {/* Live occupancy */}
            <OccupancyCard occupancy={data?.occupancy} />
          </>
        )}

        {/* Spacer so content clears the floating QR button */}
        <View className="h-2xl" />
      </View>
    </Screen>
  );
}
