import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Avatar,
  Button,
  Card,
  Icon,
  ProgressRing,
  Screen,
  Txt,
  health as healthAccents,
  useThemeColors,
  useIsDark,
} from '../../design-system';
import {
  useWaterDay,
  useLogPublicWater,
  useWeightSeries,
  useLogWeight,
  usePublicGoals,
  usePublicHealthDaily,
  useAppProfile,
  useWeekly,
} from '../../api/queries';
import { useAuth } from '../../auth/auth-store';
import { useHaptics } from '../../lib/use-haptics';
import { FITNESS_TIPS } from '../../lib/fitness-tips';

const DEFAULT_WATER_GOAL = 3000;

/**
 * Home for gym-less PUBLIC / lead users (userType === 'public'). No gym features
 * (membership, classes, trainer, check-in) — just the personal fitness tools the
 * public app offers: water, steps, weight, goals, plus conversion CTAs to find a
 * gym and refer friends. Everything here uses the app_user-scoped public
 * endpoints (no studio data), so it works with zero gym membership.
 */
export function PublicHome() {
  const router = useRouter();
  const theme = useThemeColors();
  const isDark = useIsDark();
  const haptic = useHaptics();

  const fullName = useAuth((s) => s.context?.fullName);
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning!' : hour < 17 ? 'Good afternoon!' : 'Good evening!';
  const heroBg = isDark ? '#22300C' : '#E2F2C2';

  const water = useWaterDay();
  const logWater = useLogPublicWater();
  const weight = useWeightSeries();
  const logWeight = useLogWeight();
  const goals = usePublicGoals();
  const health = usePublicHealthDaily();
  const profile = useAppProfile();
  const weekly = useWeekly();

  const rec = profile.data?.recommendation ?? null;
  // A stable tip-of-the-day (rotates daily, deterministic — no flicker on refetch).
  const tip = FITNESS_TIPS[new Date().getUTCDate() % FITNESS_TIPS.length];

  const amountMl = water.data?.amountMl ?? 0;
  const goalMl = water.data?.goalMl ?? DEFAULT_WATER_GOAL;
  const todaySteps = health.data?.days?.[0]?.steps ?? 0;
  const latestWeight = weight.data?.latest?.weightKg ?? null;
  const activeGoals = (goals.data?.goals ?? []).filter((g) => g.status === 'active');
  const daysActive = weekly.data?.daysActive ?? 0;

  // Inline weight stepper (no extra screen): seed from latest, save to public log.
  const [draftWeight, setDraftWeight] = useState<number | null>(null);
  const shownWeight = draftWeight ?? latestWeight ?? 70;

  const addWater = (ml: number) => {
    haptic.tap();
    logWater.mutate({ amountMl: ml, goalMl, mode: 'add' });
  };

  return (
    <Screen scroll padded={false} onRefresh={() => { water.refetch(); weight.refetch(); goals.refetch(); }} refreshing={water.isRefetching}>
      {/* Header — avatar + greeting (left), calendar + notifications (right). */}
      <View className="flex-row items-center justify-between px-md pb-md pt-xs">
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityLabel="Profile"
          className="flex-row items-center gap-sm"
          hitSlop={8}
        >
          <Avatar name={fullName ?? undefined} size={44} />
          <View>
            <Txt variant="body-sm" className="text-mute">
              {timeGreeting}
            </Txt>
            <Txt variant="body-lg" weight="600" className="text-ink">
              {fullName ?? 'Welcome'}
            </Txt>
          </View>
        </Pressable>
        <View className="flex-row items-center gap-xs">
          <Pressable
            onPress={() => router.push('/tools')}
            hitSlop={8}
            accessibilityLabel="Tools"
            className="h-[42px] w-[42px] items-center justify-center rounded-full border border-hairline bg-surface"
          >
            <Icon name="chart" color={theme.body} size={20} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={8}
            accessibilityLabel="Notifications"
            className="h-[42px] w-[42px] items-center justify-center rounded-full border border-hairline bg-surface"
          >
            <Icon name="bell" color={theme.body} size={20} />
          </Pressable>
        </View>
      </View>

      <View className="gap-md px-md">
        {/* Hero — weekly progress ring (active days this week). */}
        <Pressable onPress={() => router.push('/progress')} accessibilityLabel="View progress">
          <View className="overflow-hidden rounded-2xl p-lg" style={{ backgroundColor: heroBg }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-md">
                <View
                  className="mb-md flex-row items-center gap-xs self-start rounded-full px-sm py-xxs"
                  style={{ backgroundColor: theme.ink }}
                >
                  <Icon name="flash" color={theme.primary} size={13} filled />
                  <Txt variant="caption" weight="500" style={{ color: theme.canvas }}>
                    This week
                  </Txt>
                </View>
                <Txt variant="display-md" weight="600" style={{ color: '#1B2A07' }}>
                  Your Weekly{'\n'}Progress
                </Txt>
              </View>
              <ProgressRing
                progress={Math.min(daysActive, 7) / 7}
                size={92}
                strokeWidth={9}
                color="#4F7012"
                trackColor={isDark ? '#3A4D18' : '#FFFFFF'}
              >
                <View className="items-center">
                  <Txt variant="display-sm" weight="600" style={{ color: '#1B2A07' }}>
                    {daysActive}
                  </Txt>
                  <Txt variant="caption" style={{ color: '#3E5410' }}>
                    {daysActive === 1 ? 'day' : 'days'}
                  </Txt>
                </View>
              </ProgressRing>
            </View>
          </View>
        </Pressable>

        {/* Steps (on-device) + Water summary stat cards. */}
        <View className="flex-row gap-md">
          <Card className="flex-1">
            <View
              className="mb-sm h-[36px] w-[36px] items-center justify-center rounded-full"
              style={{ backgroundColor: healthAccents.activity + '1F' }}
            >
              <Icon name="footsteps" color={healthAccents.activity} size={20} filled />
            </View>
            <Txt variant="body-sm" className="text-mute">
              Step to walk
            </Txt>
            <View className="mt-xxs flex-row items-baseline gap-xs">
              <Txt variant="display-sm" weight="600" className="text-ink">
                {todaySteps.toLocaleString()}
              </Txt>
              <Txt variant="body-sm" className="text-body">
                steps
              </Txt>
            </View>
          </Card>
          <Card className="flex-1">
            <View
              className="mb-sm h-[36px] w-[36px] items-center justify-center rounded-full"
              style={{ backgroundColor: healthAccents.oxygen + '1F' }}
            >
              <Icon name="drop" color={healthAccents.oxygen} size={20} filled />
            </View>
            <Txt variant="body-sm" className="text-mute">
              Drink Water
            </Txt>
            <View className="mt-xxs flex-row items-baseline gap-xs">
              <Txt variant="display-sm" weight="600" className="text-ink">
                {Math.round(amountMl / 250)}
              </Txt>
              <Txt variant="body-sm" className="text-body">
                glass
              </Txt>
            </View>
          </Card>
        </View>

        {/* Water logging — quick add via the public endpoint. */}
        <Card elevated>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-md">
              <Txt variant="caption" className="text-mute">
                WATER TODAY
              </Txt>
              <Txt variant="body-lg" weight="600" className="mt-xxs text-ink">
                {amountMl} / {goalMl} ml
              </Txt>
            </View>
            <View className="flex-row gap-xs">
              <Button title="+250" size="sm" variant="secondary" onPress={() => addWater(250)} />
              <Button title="+500" size="sm" variant="secondary" onPress={() => addWater(500)} />
            </View>
          </View>
        </Card>

        {/* Personalized daily targets (from the recommendation engine). */}
        {rec && (rec.dailyCalories || rec.proteinG || rec.waterMl) ? (
          <Card elevated>
            <Txt variant="caption" className="text-mute">
              YOUR DAILY TARGETS
            </Txt>
            <View className="mt-sm flex-row justify-between">
              <View className="flex-1 items-center">
                <Txt variant="display-sm" weight="600" className="text-ink">
                  {rec.dailyCalories ?? '—'}
                </Txt>
                <Txt variant="caption" className="text-mute">kcal</Txt>
              </View>
              <View className="flex-1 items-center">
                <Txt variant="display-sm" weight="600" className="text-ink">
                  {rec.proteinG ?? '—'}
                </Txt>
                <Txt variant="caption" className="text-mute">protein g</Txt>
              </View>
              <View className="flex-1 items-center">
                <Txt variant="display-sm" weight="600" className="text-ink">
                  {rec.waterMl ? Math.round((rec.waterMl / 1000) * 10) / 10 : '—'}
                </Txt>
                <Txt variant="caption" className="text-mute">water L</Txt>
              </View>
            </View>
          </Card>
        ) : (
          <Card elevated onPress={() => router.push('/onboarding/setup')}>
            <Txt variant="caption" className="text-mute">PERSONALIZE</Txt>
            <Txt variant="body-lg" weight="600" className="mt-xs text-ink">
              Build your fitness profile
            </Txt>
            <Txt variant="body-sm" className="text-body">
              Get personal calorie, protein & water targets
            </Txt>
          </Card>
        )}

        {/* Recommended workout (from training experience). */}
        {rec?.split ? (
          <Card>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-md">
                <Txt variant="caption" className="text-mute">RECOMMENDED WORKOUT</Txt>
                <Txt variant="body-lg" weight="600" className="mt-xs text-ink">
                  {rec.split}
                </Txt>
                <Txt variant="body-sm" className="text-body">
                  {rec.weeklyWorkouts ? `${rec.weeklyWorkouts}×/week` : ''}
                </Txt>
              </View>
              <Icon name="dumbbell" color={theme.cyan} size={22} />
            </View>
          </Card>
        ) : null}

        {/* Weekly progress (retention). */}
        {weekly.data ? (
          <Card>
            <View className="flex-row items-center justify-between">
              <Txt variant="caption" className="text-mute">THIS WEEK</Txt>
              <Txt variant="caption" className="text-mute">
                {weekly.data.consistencyScore}% consistent
              </Txt>
            </View>
            <View className="mt-sm flex-row justify-between">
              {weekly.data.points.map((p) => (
                <View key={p.day} className="items-center gap-xxs">
                  <View
                    className="h-[28px] w-[28px] items-center justify-center rounded-full"
                    style={{ backgroundColor: p.active ? theme.cyan : theme.surface2 }}
                  >
                    {p.active ? <Icon name="check" color={theme.canvas} size={15} /> : null}
                  </View>
                  <Txt variant="caption" className="text-mute" style={{ fontSize: 9 }}>
                    {new Date(p.day).toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </Txt>
                </View>
              ))}
            </View>
            <Txt variant="body-sm" className="mt-sm text-body">
              {weekly.data.daysActive} active {weekly.data.daysActive === 1 ? 'day' : 'days'}
              {weekly.data.weightChangeKg != null
                ? ` · ${weekly.data.weightChangeKg > 0 ? '+' : ''}${weekly.data.weightChangeKg} kg (30d)`
                : ''}
            </Txt>
          </Card>
        ) : null}

        {/* Fitness tools entry. */}
        <Card onPress={() => router.push('/tools')}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-md">
              <Txt variant="caption" className="text-mute">FITNESS TOOLS</Txt>
              <Txt variant="body-lg" weight="600" className="mt-xs text-ink">
                BMI · BMR · Calories · Water
              </Txt>
              <Txt variant="body-sm" className="text-body">Calculators tuned to your profile</Txt>
            </View>
            <Icon name="chart" color={theme.cyan} size={22} />
          </View>
        </Card>

        {/* Tip of the day. */}
        <Card>
          <Txt variant="caption" className="text-mute">TIP OF THE DAY</Txt>
          <Txt variant="body-lg" weight="600" className="mt-xs text-ink">{tip.title}</Txt>
          <Txt variant="body-sm" className="mt-xxs text-body">{tip.body}</Txt>
        </Card>

        {/* Weight — read latest + inline stepper to log today's weigh-in. */}
        <Card elevated>
          <Txt variant="caption" className="text-mute">
            WEIGHT
          </Txt>
          <View className="mt-sm flex-row items-center justify-between">
            <Pressable
              onPress={() => setDraftWeight(Math.max(20, Math.round((shownWeight - 0.1) * 10) / 10))}
              accessibilityLabel="Decrease weight"
              className="h-[40px] w-[40px] items-center justify-center rounded-full border border-hairline bg-surface"
            >
              <Icon name="chevron-right" color={theme.body} size={20} />
            </Pressable>
            <Txt variant="display-md" weight="600" className="text-ink">
              {shownWeight.toFixed(1)} kg
            </Txt>
            <Pressable
              onPress={() => setDraftWeight(Math.min(400, Math.round((shownWeight + 0.1) * 10) / 10))}
              accessibilityLabel="Increase weight"
              className="h-[40px] w-[40px] items-center justify-center rounded-full border border-hairline bg-surface"
            >
              <Icon name="chevron-right" color={theme.body} size={20} />
            </Pressable>
          </View>
          <View className="mt-md">
            <Button
              title={logWeight.isPending ? 'Saving…' : 'Log weight'}
              size="md"
              onPress={() => {
                haptic.tap();
                logWeight.mutate(
                  { weightKg: shownWeight },
                  { onSuccess: () => setDraftWeight(null) },
                );
              }}
            />
          </View>
          {latestWeight != null ? (
            <Txt variant="body-sm" className="mt-sm text-body">
              Last logged: {latestWeight.toFixed(1)} kg
            </Txt>
          ) : null}
        </Card>

        {/* Goals summary. */}
        <Card>
          <View className="flex-row items-center justify-between">
            <Txt variant="caption" className="text-mute">
              GOALS
            </Txt>
            <Txt variant="caption" className="text-mute">
              {activeGoals.length} ACTIVE
            </Txt>
          </View>
          {activeGoals.length > 0 ? (
            <View className="mt-sm gap-xs">
              {activeGoals.slice(0, 3).map((g) => (
                <View key={g.id} className="flex-row items-center justify-between rounded-xl border border-hairline bg-surface px-md py-sm">
                  <Txt variant="body-md" className="text-ink">
                    {g.title ?? g.type}
                  </Txt>
                  <Txt variant="body-sm" className="text-body">
                    {g.currentValue ?? 0}
                    {g.targetValue != null ? ` / ${g.targetValue}` : ''} {g.unit ?? ''}
                  </Txt>
                </View>
              ))}
            </View>
          ) : (
            <Txt variant="body-sm" className="mt-sm text-body">
              Set a goal to stay on track — weight, water, or steps.
            </Txt>
          )}
        </Card>

        {/* Conversion: find a gym. */}
        <Card elevated onPress={() => router.push('/gyms')}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-md">
              <Txt variant="caption" className="text-mute">
                FIND GYMS NEAR YOU
              </Txt>
              <Txt variant="body-lg" weight="600" className="mt-xs text-ink">
                Join a gym
              </Txt>
              <Txt variant="body-sm" className="text-body">
                Unlock classes, trainers, check-ins & more
              </Txt>
            </View>
            <Icon name="chevron-right" color={theme.mute} size={20} />
          </View>
        </Card>

        {/* Conversion: referral. */}
        <Card onPress={() => router.push('/referral')}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-md">
              <Txt variant="caption" className="text-mute">
                REFER & EARN
              </Txt>
              <Txt variant="body-lg" weight="600" className="mt-xs text-ink">
                Invite friends
              </Txt>
              <Txt variant="body-sm" className="text-body">
                Share the app and grow together
              </Txt>
            </View>
            <Icon name="users" color={theme.cyan} size={22} />
          </View>
        </Card>

        <View className="h-2xl" />
      </View>
    </Screen>
  );
}
