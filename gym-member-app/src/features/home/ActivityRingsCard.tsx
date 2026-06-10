import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ActivityRings,
  Card,
  Icon,
  Txt,
  useThemeColors,
  health,
  type RingSpec,
} from '../../design-system';
import { useHealthSummary } from '../../api/queries';
import { usePrefs } from '../../auth/prefs-store';
import { useStepsStore } from '../steps/steps-store';
import { METRIC_META } from '../health/metrics';
import type { HealthMetricSeries, HealthMetricType } from '../../api/types';

const RING_METRICS: { type: HealthMetricType; color: string; ringLabel: string }[] = [
  { type: 'calories_active', color: health.activity, ringLabel: 'Move' },
  { type: 'active_minutes', color: health.mind, ringLabel: 'Active' },
  { type: 'steps', color: health.oxygen, ringLabel: 'Steps' },
];

/** Today's total for a sum-metric series (the last/only daily point). */
function todayTotal(series?: HealthMetricSeries): number {
  const points = series?.points ?? [];
  if (points.length === 0) return 0;
  return points[points.length - 1].total ?? 0;
}

/**
 * Signature activity-rings hero (One UI / Samsung-Health adaptation). Three
 * concentric rings — Move (active energy), Active (minutes), Steps — each scored
 * against the member's daily target from prefs.
 *
 * Real data only: values come from `member_health_daily` via the summary
 * endpoint; targets are documented defaults the member can edit. Renders nothing
 * until at least one ring has real data, so members without a wearable see no
 * empty hero (mirrors `HealthCard`).
 */
export function ActivityRingsCard() {
  const router = useRouter();
  const theme = useThemeColors();
  const today = new Date().toISOString().slice(0, 10);
  const goals = usePrefs((s) => s.goals);
  const { data } = useHealthSummary(
    today,
    today,
    RING_METRICS.map((m) => m.type).join(','),
  );

  const byType = new Map((data?.metrics ?? []).map((m) => [m.type, m] as const));

  const goalFor: Record<HealthMetricType, number> = {
    calories_active: goals.activeEnergy,
    active_minutes: goals.activeMinutes,
    steps: goals.steps,
  } as Record<HealthMetricType, number>;

  // Prefer the live on-device step count (counts as you walk, no wearable needed)
  // over the server rollup for the steps ring; the rest come from the health store.
  const localSteps = useStepsStore((s) => s.byDay[s.dayKey] ?? 0);

  const rows = RING_METRICS.map((m) => {
    const value =
      m.type === 'steps'
        ? Math.max(todayTotal(byType.get(m.type)), localSteps)
        : todayTotal(byType.get(m.type));
    const goal = goalFor[m.type] || 1;
    return {
      ...m,
      value,
      goal,
      progress: Math.min(value / goal, 1),
      meta: METRIC_META[m.type],
    };
  });

  // Honest empty-state: no real data on any ring → render nothing.
  if (rows.every((r) => r.value <= 0)) return null;

  const rings: RingSpec[] = rows.map((r) => ({ progress: r.progress, color: r.color }));
  const stepsRow = rows.find((r) => r.type === 'steps');

  return (
    <Card elevated onPress={() => router.push('/activity')}>
      <View className="flex-row items-center justify-between">
        <Txt variant="caption" className="text-mute">
          TODAY&apos;S ACTIVITY
        </Txt>
        <Pressable
          onPress={() => router.push('/settings/goals')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Edit activity goals"
          className="flex-row items-center gap-xxs"
        >
          <Txt variant="caption" className="text-mute">
            EDIT GOALS
          </Txt>
          <Icon name="chevron-right" size={14} color={theme.mute} />
        </Pressable>
      </View>
      <View className="mt-sm flex-row items-center">
        {/* Rings are decorative — the legend (right) states every value in text,
            so screen readers read the legend, not the ring's duplicate center. */}
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ActivityRings rings={rings} size={132} strokeWidth={13} gap={4}>
            <View className="items-center">
              <Txt variant="display-sm" weight="600" className="text-ink">
                {stepsRow?.meta?.format(stepsRow.value) ?? '0'}
              </Txt>
              <Txt variant="caption" className="text-mute">
                STEPS
              </Txt>
            </View>
          </ActivityRings>
        </View>

        <View className="ml-lg flex-1 gap-sm">
          {rows.map((r) => (
            <View key={r.type} className="flex-row items-center gap-sm">
              <View
                className="h-[10px] w-[10px] rounded-full"
                style={{ backgroundColor: r.color }}
              />
              <View className="flex-1">
                <Txt variant="caption" className="text-mute">
                  {r.ringLabel.toUpperCase()}
                </Txt>
                <Txt variant="body-sm" weight="600" className="text-ink">
                  {`${r.meta?.format(r.value) ?? r.value} / ${r.meta?.format(r.goal) ?? r.goal}`}
                </Txt>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}
