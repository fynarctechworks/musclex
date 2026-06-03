import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  ActivityRings,
  BarChart,
  Card,
  CollapsingHeader,
  EmptyState,
  ErrorState,
  Icon,
  LineChart,
  SegmentedControl,
  SkeletonCard,
  Txt,
  health,
} from '../../src/design-system';
import type { BarDatum, IconName } from '../../src/design-system';
import { BackButton } from '../../src/navigation/BackButton';
import { track } from '../../src/analytics';
import { useHealthSummary } from '../../src/api/queries';
import { usePrefs } from '../../src/auth/prefs-store';
import { METRIC_META } from '../../src/features/health/metrics';
import type {
  HealthMetricSeries,
  HealthMetricType,
} from '../../src/api/types';

const ACTIVITY_TYPES = 'steps,distance_m,calories_active,active_minutes';
const DAY_MS = 86_400_000;
type Range = 'today' | 'week' | 'month';

/** Narrow weekday for a YYYY-MM-DD day string (parsed as local midnight). */
function weekday(day?: string): string {
  if (!day) return '';
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
}

/** Day-of-month for the monthly axis (sparse labels read better than 30 ticks). */
function dayNum(day?: string): string {
  if (!day) return '';
  return new Date(`${day}T00:00:00`).getDate().toString();
}

function pointsOf(series?: HealthMetricSeries) {
  return series?.points ?? [];
}

/** A compact sub-metric tile (distance / active energy / active minutes). */
function SubCard({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <View className="w-1/3 px-xxs">
      <Card>
        <Icon name={icon} size={18} color={health.activity} />
        <Txt variant="body-lg" weight="600" className="mt-xs text-ink">
          {value}
        </Txt>
        <Txt variant="caption" className="text-mute">
          {label}
        </Txt>
      </Card>
    </View>
  );
}

export default function ActivityScreen() {
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 29 * DAY_MS).toISOString().slice(0, 10);
  const summary = useHealthSummary(from, today, ACTIVITY_TYPES);
  const goals = usePrefs((s) => s.goals);
  const [range, setRange] = useState<Range>('today');

  useEffect(() => {
    track({ name: 'activity_viewed' });
  }, []);

  const byType = new Map(
    (summary.data?.metrics ?? []).map((m) => [m.type, m] as const),
  );
  const stepPts = pointsOf(byType.get('steps'));
  const todayPt = stepPts[stepPts.length - 1];

  /** Today's total for a sum-metric (the last/only daily point). */
  const totalToday = (type: HealthMetricType): number => {
    const pts = pointsOf(byType.get(type));
    return pts[pts.length - 1]?.total ?? 0;
  };

  const stepsToday = todayPt?.total ?? 0;
  const stepGoal = goals.steps || 1;
  const stepPct = Math.round(Math.min(stepsToday / stepGoal, 1) * 100);

  // Three real rings scored against the member's editable targets.
  const rings = [
    { progress: stepsToday / stepGoal, color: health.activity },
    { progress: totalToday('calories_active') / (goals.activeEnergy || 1), color: health.body },
    { progress: totalToday('active_minutes') / (goals.activeMinutes || 1), color: health.mind },
  ];

  // 7-day step totals (week tab), most recent day highlighted.
  const weekBars: BarDatum[] = stepPts.slice(-7).map((p, i, arr) => ({
    label: weekday(p.day),
    value: p.total ?? 0,
    highlight: i === arr.length - 1,
  }));
  const weekTotal = stepPts.slice(-7).reduce((s, p) => s + (p.total ?? 0), 0);

  // 30-day step trend (month tab).
  const monthVals = stepPts.map((p) => p.total ?? 0);
  const monthTotal = monthVals.reduce((s, v) => s + v, 0);
  const monthPeak = stepPts.reduce(
    (best, p) => ((p.total ?? 0) > (best.total ?? 0) ? p : best),
    stepPts[0] ?? { total: 0 },
  );

  const fmtSteps = METRIC_META.steps!.format;

  return (
    <CollapsingHeader
      title="Activity"
      subtitle="Steps & movement"
      left={<BackButton className="" />}
      right={
        <SegmentedControl<Range>
          options={[
            { label: 'Today', value: 'today' },
            { label: 'Week', value: 'week' },
            { label: 'Month', value: 'month' },
          ]}
          value={range}
          onChange={setRange}
        />
      }
      onRefresh={() => summary.refetch()}
      refreshing={summary.isFetching}
    >
      {summary.isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : summary.isError ? (
        <ErrorState onRetry={() => summary.refetch()} />
      ) : stepPts.length === 0 ? (
        <EmptyState
          icon="flash"
          title="No activity data yet"
          message="Connect a wearable that tracks steps, or it will appear here after your next sync."
        />
      ) : range === 'today' ? (
        <>
          {/* Today's ring + goal progress */}
          <Card elevated className="mb-md">
            <Txt variant="caption" className="text-mute">
              TODAY
            </Txt>
            <View className="mt-sm flex-row items-center">
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <ActivityRings rings={rings} size={132} strokeWidth={13} gap={4}>
                  <View className="items-center">
                    <Txt variant="display-sm" weight="600" className="text-ink">
                      {fmtSteps(stepsToday)}
                    </Txt>
                    <Txt variant="caption" className="text-mute">
                      STEPS
                    </Txt>
                  </View>
                </ActivityRings>
              </View>
              <View className="ml-lg flex-1">
                <Txt variant="display-md" weight="600" style={{ color: health.activity }}>
                  {`${stepPct}%`}
                </Txt>
                <Txt variant="body-sm" className="mt-xxs text-body">
                  {`of your ${fmtSteps(stepGoal)} step goal`}
                </Txt>
              </View>
            </View>
          </Card>

          {/* Sub-metrics — real daily totals from member_health_daily */}
          <View className="-mx-xxs flex-row">
            <SubCard
              icon="pin"
              label="Distance"
              value={METRIC_META.distance_m!.format(totalToday('distance_m'))}
            />
            <SubCard
              icon="flame"
              label="Active energy"
              value={METRIC_META.calories_active!.format(totalToday('calories_active'))}
            />
            <SubCard
              icon="flash"
              label="Active min"
              value={METRIC_META.active_minutes!.format(totalToday('active_minutes'))}
            />
          </View>
        </>
      ) : range === 'week' ? (
        <Card>
          <Txt variant="caption" className="text-mute">
            STEPS · LAST 7 DAYS
          </Txt>
          <View
            className="mt-md"
            accessibilityLabel={`Steps over the last 7 days: ${fmtSteps(weekTotal)} total`}
          >
            <BarChart data={weekBars} height={150} color={health.activity} />
          </View>
          <Txt variant="body-sm" className="mt-sm text-body">
            {`${fmtSteps(weekTotal)} steps this week`}
          </Txt>
        </Card>
      ) : (
        <Card>
          <Txt variant="caption" className="text-mute">
            STEPS · LAST 30 DAYS
          </Txt>
          {monthVals.length >= 2 ? (
            <View
              className="mt-md"
              accessibilityLabel={`Steps over the last 30 days: ${fmtSteps(
                monthTotal,
              )} total, peak ${fmtSteps(monthPeak.total ?? 0)} on ${monthPeak.day ?? 'n/a'}`}
            >
              <LineChart
                values={monthVals}
                height={150}
                width={320}
                color={health.activity}
              />
              <View className="mt-xs flex-row justify-between">
                <Txt variant="caption" className="text-mute">
                  {dayNum(stepPts[0]?.day)}
                </Txt>
                <Txt variant="caption" className="text-mute">
                  {dayNum(stepPts[stepPts.length - 1]?.day)}
                </Txt>
              </View>
            </View>
          ) : (
            <Txt variant="body-sm" className="mt-sm text-mute">
              Not enough history yet — keep syncing to see your monthly trend.
            </Txt>
          )}
          <Txt variant="body-sm" className="mt-sm text-body">
            {`${fmtSteps(monthTotal)} steps in 30 days`}
          </Txt>
        </Card>
      )}

      {stepPts.length > 0 ? (
        <Txt variant="caption" className="mt-lg text-mute">
          Steps come from your connected wearable.
        </Txt>
      ) : null}
    </CollapsingHeader>
  );
}
