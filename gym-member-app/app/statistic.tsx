import { useMemo } from 'react';
import { View } from 'react-native';
import {
  BarChart,
  Card,
  Icon,
  Screen,
  Txt,
  health,
  useThemeColors,
} from '../src/design-system';
import type { BarDatum } from '../src/design-system';
import {
  useNutritionToday,
  useHealthSummary,
  useWeightSeries,
} from '../src/api/queries';
import { usePrefs } from '../src/auth/prefs-store';
import { ScreenHeader } from '../src/navigation/ScreenHeader';
import type { HealthMetricSeries, HealthMetricType, HealthSummary } from '../src/api/types';

const DAY = 86_400_000;
const ML_PER_GLASS = 250;
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Pull one metric's daily points out of the summary, keyed by YYYY-MM-DD. */
function seriesFor(summary: HealthSummary | undefined, type: HealthMetricType): Map<string, number> {
  const m: HealthMetricSeries | undefined = summary?.metrics?.find((s) => s.type === type);
  const out = new Map<string, number>();
  for (const p of m?.points ?? []) {
    if (p.day != null && p.total != null) out.set(p.day.slice(0, 10), p.total);
    else if (p.day != null && p.avg != null) out.set(p.day.slice(0, 10), p.avg);
  }
  return out;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function StatisticScreen() {
  const theme = useThemeColors();
  const { data: nutrition } = useNutritionToday();
  const { data: weight } = useWeightSeries(30);

  // Last 7 days of health metrics (real wearable/device data; empty without one).
  const to = useMemo(() => new Date(), []);
  const from = useMemo(() => new Date(to.getTime() - 6 * DAY), [to]);
  const { data: summary } = useHealthSummary(
    dayKey(from),
    dayKey(to),
    'calories_active,active_minutes,heart_rate,hr_resting',
  );

  const energyGoal = usePrefs((s) => s.goals.activeEnergy);

  // ── Headline: today's calorie intake vs target (always real from the BFF). ──
  const kcalIn = Math.round(nutrition?.totals?.kcal ?? 0);
  const kcalTarget = Math.round(nutrition?.goal?.kcal ?? 0);

  // ── Weekly active-energy bars (real burned calories, % of the daily goal). ──
  const activeCals = seriesFor(summary, 'calories_active');
  const week = useMemo<BarDatum[]>(() => {
    const days: BarDatum[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(to.getTime() - i * DAY);
      days.push({
        label: WEEKDAY[d.getDay()],
        value: activeCals.get(dayKey(d)) ?? 0,
        highlight: i === 0,
      });
    }
    return days;
  }, [activeCals, to]);
  const hasWeek = week.some((d) => d.value > 0);

  // ── 2×2 grid metrics ──
  const activeMin = seriesFor(summary, 'active_minutes');
  const todayMin = activeMin.get(dayKey(to)) ?? 0;
  const exerciseHrs = todayMin > 0 ? (todayMin / 60).toFixed(1) : null;

  const hr = seriesFor(summary, 'heart_rate');
  const hrRest = seriesFor(summary, 'hr_resting');
  const bpm = Math.round(hr.get(dayKey(to)) ?? hrRest.get(dayKey(to)) ?? 0) || null;

  const latestWeight = weight?.latest?.weightKg ?? weight?.entries?.[weight.entries.length - 1]?.weightKg ?? null;

  const waterMl = nutrition?.waterMl ?? 0;
  const glasses = Math.round(waterMl / ML_PER_GLASS);

  return (
    <Screen scroll>
      {/* Header — back · title · overflow (the reference top bar). */}
      <ScreenHeader title="Statistic" className="mb-lg" onMore={() => {}} />

      {/* Calories headline */}
      <Txt variant="body-md" className="text-mute">
        Calories
      </Txt>
      <View className="mt-xs flex-row items-end justify-between">
        <View className="flex-row items-baseline gap-xs">
          <Txt variant="display-2xl" weight="700" className="text-ink">
            {kcalIn.toLocaleString()}
          </Txt>
          <Txt variant="body-md" className="text-body">
            Kcal
          </Txt>
        </View>
        {kcalTarget > 0 ? (
          <Txt variant="body-sm" className="mb-xs text-mute">
            {`Target: ${kcalTarget.toLocaleString()} Kcal`}
          </Txt>
        ) : null}
      </View>

      {/* Weekly active-energy bars (% of daily goal) */}
      <View className="mt-lg">
        {hasWeek ? (
          <BarChart data={week} height={200} showValues percentOf={energyGoal} />
        ) : (
          <Card soft>
            <View className="items-center py-md">
              <Icon name="activity" color={theme.mute} size={26} />
              <Txt variant="body-md" weight="600" className="mt-sm text-ink">
                No activity data yet
              </Txt>
              <Txt variant="body-sm" className="mt-xxs text-center text-body">
                Connect a wearable or use the step tracker to see your weekly energy burn.
              </Txt>
            </View>
          </Card>
        )}
      </View>

      {/* 2×2 metric grid */}
      <View className="mt-lg gap-md">
        <View className="flex-row gap-md">
          <MetricCard icon="activity" accent={health.activity} label="Exercise" value={exerciseHrs ?? '—'} unit={exerciseHrs ? 'hours' : ''} theme={theme} />
          <MetricCard icon="heart" accent={health.heart} label="BPM" value={bpm != null ? String(bpm) : '—'} unit={bpm != null ? 'bpm' : ''} theme={theme} />
        </View>
        <View className="flex-row gap-md">
          <MetricCard icon="dumbbell" accent={health.body} label="Weight" value={latestWeight != null ? latestWeight.toFixed(1) : '—'} unit={latestWeight != null ? 'kg' : ''} theme={theme} />
          <MetricCard icon="drop" accent={health.oxygen} label="Water" value={String(glasses)} unit={glasses === 1 ? 'glass' : 'glass'} theme={theme} />
        </View>
      </View>

      <View className="h-2xl" />
    </Screen>
  );
}

function MetricCard({
  icon,
  accent,
  label,
  value,
  unit,
  theme,
}: {
  icon: 'activity' | 'heart' | 'dumbbell' | 'drop';
  accent: string;
  label: string;
  value: string;
  unit: string;
  theme: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Card className="flex-1">
      <View className="flex-row items-center gap-sm">
        <View
          className="h-[34px] w-[34px] items-center justify-center rounded-full"
          style={{ backgroundColor: accent + '1F' }}
        >
          <Icon name={icon} color={accent} size={18} filled />
        </View>
        <Txt variant="body-md" weight="500" className="text-ink">
          {label}
        </Txt>
      </View>
      <View className="mt-md flex-row items-baseline gap-xs">
        <Txt variant="display-sm" weight="600" className="text-ink">
          {value}
        </Txt>
        {unit ? (
          <Txt variant="body-sm" className="text-body">
            {unit}
          </Txt>
        ) : null}
      </View>
    </Card>
  );
}
