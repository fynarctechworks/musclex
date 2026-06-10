import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
  ProgressRing,
  Screen,
  SkeletonCard,
  Txt,
  health,
  useThemeColors,
  useIsDark,
} from '../../src/design-system';
import { useHome, useNutritionToday } from '../../src/api/queries';
import { useAuth } from '../../src/auth/auth-store';
import { useCapabilities } from '../../src/auth/use-capabilities';
import { usePrefs } from '../../src/auth/prefs-store';
import { useStepsStore } from '../../src/features/steps/steps-store';
import { GymSuspendedBanner } from '../../src/features/gym/GymSuspendedBanner';
import { emitFunnelOnce } from '../../src/analytics/funnel';
import { PublicHome } from '../../src/features/home/PublicHome';
import { OccupancyCard } from '../../src/features/home/OccupancyCard';
import { useHaptics } from '../../src/lib/use-haptics';
import { formatTime, relativeFromNow } from '../../src/lib/format';
import type { MealType, MembershipStatus, NutritionMeal } from '../../src/api/types';

const STATUS_TONE: Record<MembershipStatus, 'success' | 'warning' | 'error'> = {
  active: 'success',
  expiring: 'warning',
  frozen: 'warning',
  expired: 'error',
};

const ML_PER_GLASS = 250;

/** Time-of-day greeting line ("Good morning!"), matching the reference header. */
function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning!';
  if (h < 17) return 'Good afternoon!';
  return 'Good evening!';
}

export default function Home() {
  const router = useRouter();
  const haptic = useHaptics();
  const theme = useThemeColors();
  const { isPublic } = useCapabilities();

  // Funnel: first time the dashboard is reached (once per install).
  useEffect(() => {
    emitFunnelOnce('first_dashboard_visit');
  }, []);

  // Gym-less public users get a dedicated dashboard (no gym data / endpoints).
  // The gym home below is only reached by members + expired members.
  if (isPublic) return <PublicHome />;

  return <GymHome router={router} haptic={haptic} theme={theme} />;
}

function GymHome({
  router,
  haptic,
  theme,
}: {
  router: ReturnType<typeof useRouter>;
  haptic: ReturnType<typeof useHaptics>;
  theme: ReturnType<typeof useThemeColors>;
}) {
  const isDark = useIsDark();
  const { data, isLoading, isError, refetch, isRefetching } = useHome();
  const { data: nutrition } = useNutritionToday();
  const profileName = useAuth((s) => s.profile?.name);
  const profileAvatar = useAuth((s) => s.profile?.avatarUrl);
  const stepGoal = usePrefs((s) => s.goals.steps);
  const steps = useStepsStore((s) => s.byDay[s.dayKey] ?? 0);

  const membership = data?.membership;
  const streak = data?.streak?.days ?? 0;
  const nextClass = data?.nextClass;

  // Hydration — real glasses from the home payload (250 ml per glass).
  const waterMl = data?.nutrition?.waterMl ?? nutrition?.waterMl ?? 0;
  const waterGoalMl = data?.nutrition?.waterGoal ?? nutrition?.goal?.waterMl ?? 0;
  const glasses = Math.round(waterMl / ML_PER_GLASS);
  const goalGlasses = waterGoalMl ? Math.round(waterGoalMl / ML_PER_GLASS) : 0;

  // Soft lime hero (reference "Weekly Progress" card) — saturated enough to read
  // as the brand accent, calm enough for a large fill. Dark theme gets a deep
  // green-tinted surface so the lime doesn't glare on the near-black canvas.
  const heroBg = isDark ? '#22300C' : '#E2F2C2';

  return (
    <Screen scroll padded={false} onRefresh={refetch} refreshing={isRefetching}>
      {/* Header — avatar + greeting (left), calendar + notifications (right). */}
      <View className="flex-row items-center justify-between px-md pb-md pt-xs">
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityLabel="Profile"
          className="flex-row items-center gap-sm"
          hitSlop={8}
        >
          <Avatar name={profileName} uri={profileAvatar} size={44} />
          <View>
            <Txt variant="body-sm" className="text-mute">
              {timeGreeting()}
            </Txt>
            <Txt variant="body-lg" weight="600" className="text-ink">
              {profileName ?? 'Welcome back'}
            </Txt>
          </View>
        </Pressable>
        <View className="flex-row items-center gap-xs">
          <HeaderButton icon="calendar" label="Schedule" onPress={() => router.push('/classes')} theme={theme} />
          <HeaderButton icon="bell" label="Notifications" onPress={() => router.push('/notifications')} theme={theme} dot />
        </View>
      </View>

      <GymSuspendedBanner />

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
            {/* Hero — weekly progress ring (the reference "Your Weekly Progress").
               Driven by the UNIFIED streak (check-in / workout / meal each keep the
               day alive — see MemberStreakService); 7-day window. */}
            <Pressable onPress={() => router.push('/statistic')} accessibilityLabel="View statistics">
              <View className="overflow-hidden rounded-2xl p-lg" style={{ backgroundColor: heroBg }}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-md">
                    <View
                      className="mb-md flex-row items-center gap-xs self-start rounded-full px-sm py-xxs"
                      style={{ backgroundColor: theme.ink }}
                    >
                      <Icon name="flash" color={theme.primary} size={13} filled />
                      <Txt variant="caption" weight="500" style={{ color: theme.canvas }}>
                        Daily intake
                      </Txt>
                    </View>
                    <Txt variant="display-md" weight="600" style={{ color: '#1B2A07' }}>
                      Your Weekly{'\n'}Progress
                    </Txt>
                  </View>
                  <ProgressRing
                    progress={Math.min(streak, 7) / 7}
                    size={92}
                    strokeWidth={9}
                    color="#4F7012"
                    trackColor={isDark ? '#3A4D18' : '#FFFFFF'}
                  >
                    <View className="items-center">
                      <Txt variant="display-sm" weight="600" style={{ color: '#1B2A07' }}>
                        {streak}
                      </Txt>
                      <Txt variant="caption" style={{ color: '#3E5410' }}>
                        {streak === 1 ? 'day' : 'days'}
                      </Txt>
                    </View>
                  </ProgressRing>
                </View>
              </View>
            </Pressable>

            {/* Check in — the core gym action (moved off the header). Prominent
               lime CTA so it's the most obvious thing to do on arrival. */}
            <Card onPress={() => router.push('/checkin')} style={{ backgroundColor: theme.primary }}>
              <View className="flex-row items-center">
                <View
                  className="h-[44px] w-[44px] items-center justify-center rounded-full"
                  style={{ backgroundColor: theme.onPrimary + '1A' }}
                >
                  <Icon name="scan" color={theme.onPrimary} size={24} />
                </View>
                <View className="ml-md flex-1">
                  <Txt variant="body-lg" weight="600" style={{ color: theme.onPrimary }}>
                    Check in to your gym
                  </Txt>
                  <Txt variant="body-sm" style={{ color: theme.onPrimary, opacity: 0.7 }}>
                    Scan the QR at the door
                  </Txt>
                </View>
                <Icon name="chevron-right" color={theme.onPrimary} size={20} />
              </View>
            </Card>

            {/* Two stat cards — steps (on-device pedometer) + hydration (real log). */}
            <View className="flex-row gap-md">
              <StatCard
                icon="footsteps"
                accent={health.activity}
                label="Step to walk"
                value={steps.toLocaleString()}
                unit="steps"
                sub={stepGoal ? `of ${stepGoal.toLocaleString()}` : undefined}
                onPress={() => router.push('/activity')}
                theme={theme}
              />
              <StatCard
                icon="drop"
                accent={health.oxygen}
                label="Drink Water"
                value={String(glasses)}
                unit={glasses === 1 ? 'glass' : 'glass'}
                sub={goalGlasses ? `of ${goalGlasses}` : undefined}
                onPress={() => router.push('/nutrition')}
                theme={theme}
              />
            </View>

            {/* Week calendar strip — the current week, today highlighted. */}
            <WeekStrip theme={theme} />

            {/* Meals — real logged meals per type with their calories; tap + to add.
               Always lists the four meal types so logging is one tap from Home. */}
            <MealsSection
              meals={nutrition?.meals ?? []}
              onAdd={() => {
                haptic.tap();
                router.push('/nutrition');
              }}
              theme={theme}
            />

            {/* ── Below the fold: the gym essentials, in the same card language ── */}

            {/* Membership status — real money path, kept prominent. */}
            <Card elevated onPress={() => router.push('/membership')}>
              <View className="flex-row items-center justify-between">
                <Txt variant="caption" className="text-mute">
                  MEMBERSHIP
                </Txt>
                {membership?.status ? (
                  <Badge label={membership.status.toUpperCase()} tone={STATUS_TONE[membership.status]} />
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
                <Icon name="chevron-right" color={theme.mute} size={20} />
              </View>
              {membership && (membership.status === 'expiring' || membership.status === 'expired') ? (
                <View className="mt-md">
                  <Button
                    title={membership.status === 'expired' ? 'Renew now' : 'Renew early'}
                    size="md"
                    onPress={() => router.push('/membership')}
                  />
                </View>
              ) : null}
            </Card>

            {/* Next class — entry point to the schedule. */}
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
                      {`${formatTime(nextClass.startsAt)} · ${relativeFromNow(nextClass.startsAt)}`}
                    </Txt>
                  </View>
                  <View className="flex-row items-center gap-sm">
                    {nextClass.seatsLeft != null ? (
                      <Badge label={`${nextClass.seatsLeft} seats`} tone="neutral" />
                    ) : null}
                    <Icon name="chevron-right" color={theme.mute} size={20} />
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
                  <Icon name="chevron-right" color={theme.mute} size={20} />
                </View>
              </Card>
            )}

            {/* Live occupancy */}
            <OccupancyCard occupancy={data?.occupancy} />
          </>
        )}

        {/* Spacer so content clears the floating tab bar / FAB */}
        <View className="h-2xl" />
      </View>
    </Screen>
  );
}

/** Round header action button (check-in / notifications). `accent` fills it with
 * the lime brand (used for the high-frequency check-in action). */
function HeaderButton({
  icon,
  label,
  onPress,
  theme,
  dot,
  accent,
}: {
  icon: 'scan' | 'bell' | 'calendar';
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useThemeColors>;
  dot?: boolean;
  accent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={label}
      className="h-[42px] w-[42px] items-center justify-center rounded-full border"
      style={{
        backgroundColor: accent ? theme.primary : theme.surface,
        borderColor: accent ? theme.primary : theme.hairline,
      }}
    >
      <Icon name={icon} color={accent ? theme.onPrimary : theme.body} size={20} />
      {dot ? (
        <View
          className="absolute right-[10px] top-[10px] h-[8px] w-[8px] rounded-full border-2"
          style={{ backgroundColor: theme.primary, borderColor: theme.surface }}
        />
      ) : null}
    </Pressable>
  );
}

/** Compact metric card (steps / water) — icon chip, label, big value + unit. */
function StatCard({
  icon,
  accent,
  label,
  value,
  unit,
  sub,
  onPress,
  theme,
}: {
  icon: 'footsteps' | 'drop';
  accent: string;
  label: string;
  value: string;
  unit: string;
  sub?: string;
  onPress: () => void;
  theme: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Card onPress={onPress} className="flex-1">
      <View
        className="mb-sm h-[36px] w-[36px] items-center justify-center rounded-full"
        style={{ backgroundColor: accent + '1F' }}
      >
        <Icon name={icon} color={accent} size={20} filled />
      </View>
      <Txt variant="body-sm" className="text-mute">
        {label}
      </Txt>
      <View className="mt-xxs flex-row items-baseline gap-xs">
        <Txt variant="display-sm" weight="600" className="text-ink">
          {value}
        </Txt>
        <Txt variant="body-sm" className="text-body">
          {unit}
        </Txt>
      </View>
      {sub ? (
        <Txt variant="caption" className="mt-xxs text-mute">
          {sub}
        </Txt>
      ) : null}
    </Card>
  );
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Week calendar strip — current week with paging; today gets the lime pill. */
function WeekStrip({ theme }: { theme: ReturnType<typeof useThemeColors> }) {
  const [offset, setOffset] = useState(0); // weeks from the current week
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const days = useMemo(() => {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + offset * 7); // Sunday of the week
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [today, offset]);

  const monthLabel = days[3]?.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) ?? '';

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Txt variant="body-lg" weight="600" className="text-ink">
          {monthLabel}
        </Txt>
        <View className="flex-row items-center gap-xs">
          <Pressable
            onPress={() => setOffset((o) => o - 1)}
            hitSlop={8}
            accessibilityLabel="Previous week"
            className="h-[32px] w-[32px] items-center justify-center rounded-full border border-hairline"
          >
            <Icon name="chevron-left" color={theme.body} size={16} />
          </Pressable>
          <Pressable
            onPress={() => setOffset((o) => o + 1)}
            hitSlop={8}
            accessibilityLabel="Next week"
            className="h-[32px] w-[32px] items-center justify-center rounded-full border border-hairline"
          >
            <Icon name="chevron-right" color={theme.body} size={16} />
          </Pressable>
        </View>
      </View>
      <View className="mt-md flex-row justify-between">
        {days.map((d, i) => {
          const isToday = d.getTime() === today.getTime();
          return (
            <View key={d.toISOString()} className="items-center gap-xs">
              <Txt variant="caption" className="text-mute">
                {DOW[i]}
              </Txt>
              <View
                className="h-[34px] w-[34px] items-center justify-center rounded-full"
                style={{ backgroundColor: isToday ? theme.primary : 'transparent' }}
              >
                <Txt
                  variant="body-sm"
                  weight={isToday ? '600' : '400'}
                  style={{ color: isToday ? theme.onPrimary : theme.body }}
                >
                  {d.getDate().toString().padStart(2, '0')}
                </Txt>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch time',
  dinner: 'Dinner',
  snack: 'Snacks',
};

/** Meal rows — one card per meal type with its logged calories + an add button. */
function MealsSection({
  meals,
  onAdd,
  theme,
}: {
  meals: NutritionMeal[];
  onAdd: () => void;
  theme: ReturnType<typeof useThemeColors>;
}) {
  // Sum logged calories per meal type (a member can log a type more than once).
  const kcalByType = useMemo(() => {
    const acc: Partial<Record<MealType, number>> = {};
    for (const m of meals) {
      if (!m.mealType) continue;
      acc[m.mealType] = (acc[m.mealType] ?? 0) + (m.totals?.kcal ?? 0);
    }
    return acc;
  }, [meals]);

  return (
    <View className="gap-md">
      {MEAL_ORDER.map((type) => {
        const kcal = kcalByType[type];
        return (
          <Card key={type} onPress={onAdd} className="flex-row items-center">
            <View
              className="h-[44px] w-[44px] items-center justify-center rounded-lg"
              style={{ backgroundColor: theme.warning + '1F' }}
            >
              <Icon name="flame" color={theme.warning} size={22} filled />
            </View>
            <View className="ml-md flex-1">
              <Txt variant="body-lg" weight="600" className="text-ink">
                {MEAL_LABEL[type]}
              </Txt>
              <Txt variant="body-sm" className="text-body">
                {kcal != null ? `${Math.round(kcal)} kcal` : 'Tap to log'}
              </Txt>
            </View>
            <View
              className="h-[36px] w-[36px] items-center justify-center rounded-full"
              style={{ backgroundColor: theme.surface2 }}
            >
              <Icon name="add" color={theme.ink} size={20} />
            </View>
          </Card>
        );
      })}
    </View>
  );
}
