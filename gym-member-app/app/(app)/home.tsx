import { useEffect, useRef } from 'react';
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
import { HealthCard } from '../../src/features/home/HealthCard';
import { ActivityRingsCard } from '../../src/features/home/ActivityRingsCard';
import { useHaptics } from '../../src/lib/use-haptics';
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
  const haptic = useHaptics();
  const { data, isLoading, isError, refetch, isRefetching } = useHome();
  const { data: classData } = useClasses();
  const profileName = useAuth((s) => s.profile?.name);

  const greeting =
    data?.greeting ?? (profileName ? `Hi, ${profileName.split(' ')[0]}` : 'Welcome back');
  const membership = data?.membership;
  const streak = data?.streak?.days ?? 0;
  const todayStatus = data?.today;
  const today = data?.todayWorkout;
  const nextClass = data?.nextClass;
  const week = weekAhead(classData?.classes ?? []);

  // The daily ritual: the streak-qualifying actions and whether each is done today.
  const rituals: { key: string; label: string; icon: 'qr' | 'dumbbell' | 'flame'; done: boolean; route: string }[] = [
    { key: 'checkin', label: 'Check in at the gym', icon: 'qr', done: !!todayStatus?.checkedIn, route: '/checkin' },
    { key: 'workout', label: 'Log a workout', icon: 'dumbbell', done: !!todayStatus?.workoutLogged, route: '/workout' },
    { key: 'meal', label: 'Log a meal', icon: 'flame', done: !!todayStatus?.mealLogged, route: '/nutrition' },
  ];
  const ritualsDone = rituals.filter((r) => r.done).length;

  // Fire a single Success haptic the moment the day's rituals are all complete
  // (the streak is secured). Guarded by a ref so it celebrates once, not on every
  // re-render, and re-arms when a new day resets the count.
  const celebrated = useRef(false);
  useEffect(() => {
    if (ritualsDone > 0 && ritualsDone === rituals.length) {
      if (!celebrated.current) {
        celebrated.current = true;
        haptic.success();
      }
    } else {
      celebrated.current = false;
    }
  }, [ritualsDone, rituals.length, haptic]);

  const goRitual = (route: string) => {
    haptic.tap();
    router.push(route as never);
  };

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
            {/* Today's activity rings (Move · Active · Steps) — the signature
               One UI hero. Self-hides until a wearable supplies real data, so
               members without a device still lead with the streak ring below. */}
            <ActivityRingsCard />

            {/* Today's health snapshot — 2×2 of resting HR, sleep, steps, active
               energy. Also self-hides without wearable data (no empty noise). */}
            <HealthCard />

            {/* Activity streak — the signature ring (Samsung-Health style). Driven
               by the UNIFIED streak: a check-in, a logged workout, OR a logged meal
               each keeps the day alive (see MemberStreakService on the BFF). */}
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
                      ACTIVITY STREAK
                    </Txt>
                  </View>
                  <Txt variant="display-sm" weight="600" className="mt-xxs text-ink">
                    {todayStatus?.streakAtRisk
                      ? 'Don’t break it'
                      : streak > 0
                        ? 'Keep it going'
                        : 'Start today'}
                  </Txt>
                  <Txt variant="body-sm" className="mt-xxs text-body">
                    {streak > 0
                      ? todayStatus?.streakAtRisk
                        ? `${streak}-day streak — do one thing today to keep it.`
                        : `${streak} day${streak === 1 ? '' : 's'} in a row. Nice work.`
                      : 'Check in, log a workout, or log a meal to begin.'}
                  </Txt>
                </View>
              </View>
            </Card>

            {/* Today — the daily ritual. Each row is a streak-qualifying action with
               an honest, server-verified done state; tapping routes to do it. */}
            <Card elevated>
              <View className="flex-row items-center justify-between">
                <Txt variant="caption" className="text-mute">
                  TODAY
                </Txt>
                <Txt variant="caption" className={ritualsDone === rituals.length ? 'text-success' : 'text-mute'}>
                  {`${ritualsDone}/${rituals.length} DONE`}
                </Txt>
              </View>
              <View className="mt-sm gap-xs">
                {rituals.map((r) => (
                  <Pressable
                    key={r.key}
                    onPress={() => goRitual(r.route)}
                    disabled={r.done}
                    accessibilityRole="button"
                    accessibilityLabel={r.done ? `${r.label} — done` : r.label}
                    className="flex-row items-center rounded-lg border border-hairline bg-surface px-md py-sm"
                  >
                    <View
                      className="h-[32px] w-[32px] items-center justify-center rounded-full"
                      style={{ backgroundColor: r.done ? colors.success + '22' : colors.surface2 }}
                    >
                      <Icon name={r.done ? 'check' : r.icon} color={r.done ? colors.success : colors.body} size={18} />
                    </View>
                    <Txt
                      variant="body-md"
                      weight={r.done ? '400' : '600'}
                      className={r.done ? 'ml-md flex-1 text-mute line-through' : 'ml-md flex-1 text-ink'}
                    >
                      {r.label}
                    </Txt>
                    {r.done ? (
                      <Txt variant="caption" className="text-success">
                        DONE
                      </Txt>
                    ) : (
                      <Icon name="chevron-right" color={colors.mute} size={18} />
                    )}
                  </Pressable>
                ))}
              </View>
              {ritualsDone === rituals.length ? (
                <Txt variant="body-sm" className="mt-sm text-success">
                  All done today — streak secured. 🔥
                </Txt>
              ) : null}
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
                <View
                  className="mt-md"
                  accessibilityLabel={`Classes you can book this week: ${week.total} total across the next 7 days`}
                >
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

            {/* Nutrition — today's calories & water, live from the BFF (V2.1). */}
            {(() => {
              const n = data?.nutrition;
              const kcalGoal = n?.kcalGoal ?? 0;
              const kcalEaten = n?.kcal ?? 0;
              const kcalLeft = Math.max(0, kcalGoal - kcalEaten);
              const waterMl = n?.waterMl ?? 0;
              const waterGoal = n?.waterGoal ?? 0;
              const logged = kcalEaten > 0 || waterMl > 0;
              return (
                <Card onPress={() => router.push('/nutrition')}>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-md">
                      <Txt variant="caption" className="text-mute">
                        NUTRITION
                      </Txt>
                      <Txt variant="body-lg" weight="600" className="mt-xs text-ink">
                        {logged && kcalGoal > 0
                          ? `${kcalLeft} kcal left`
                          : 'Track today’s meals'}
                      </Txt>
                      <Txt variant="body-sm" className="text-body">
                        {logged
                          ? `${kcalEaten} / ${kcalGoal} kcal · ${waterMl} / ${waterGoal} ml water`
                          : 'Calories, macros & water'}
                      </Txt>
                    </View>
                    <Icon name="flame" color={colors.warning} size={22} />
                  </View>
                </Card>
              );
            })()}

            {/* Exercise library — browse the gym catalog with form cues (V2.2). */}
            <Card onPress={() => router.push('/exercises')}>
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-md">
                  <Txt variant="caption" className="text-mute">
                    EXERCISE LIBRARY
                  </Txt>
                  <Txt variant="body-lg" weight="600" className="mt-xs text-ink">
                    Browse exercises
                  </Txt>
                  <Txt variant="body-sm" className="text-body">
                    Muscle targeting & how-to for every lift
                  </Txt>
                </View>
                <Icon name="dumbbell" color={colors.cyan} size={22} />
              </View>
            </Card>

            {/* Trainer chat — message your assigned coach (V2.3). */}
            <Card onPress={() => router.push('/messages')}>
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-md">
                  <Txt variant="caption" className="text-mute">
                    TRAINER CHAT
                  </Txt>
                  <Txt variant="body-lg" weight="600" className="mt-xs text-ink">
                    Message your coach
                  </Txt>
                  <Txt variant="body-sm" className="text-body">
                    Form feedback & guidance
                  </Txt>
                </View>
                <Icon name="users" color={colors.cyan} size={22} />
              </View>
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
