import { View } from 'react-native';
import { Card, Icon, LineChart, Txt } from '../../design-system';
import { METRIC_META } from './metrics';
import type { HealthMetricSeries } from '../../api/types';

/** Headline value for a series, per its rollup rule. */
function headlineOf(values: number[], agg: 'sum' | 'avg' | 'latest'): number {
  if (values.length === 0) return 0;
  if (agg === 'avg') return values.reduce((a, b) => a + b, 0) / values.length;
  return values[values.length - 1]; // latest / today's total
}

/**
 * A single health metric's trend card — category-accented icon, headline number,
 * and a sparkline of the period. Real data only: the caller passes a real
 * `member_health_daily` series; nothing is computed beyond display roll-up.
 *
 * Shared by the Health, Heart and Body screens. Pass `onPress` to deep-link the
 * card to a detail screen (the Health dashboard does this for sleep/heart/body).
 */
export function MetricTrendCard({
  series,
  onPress,
}: {
  series: HealthMetricSeries;
  onPress?: () => void;
}) {
  const meta = series.type ? METRIC_META[series.type] : undefined;
  if (!meta) return null;

  const points = series.points ?? [];
  const values = points.map((p) =>
    meta.agg === 'avg' ? p.avg ?? p.total ?? 0 : p.total ?? 0,
  );
  const headline = headlineOf(values, meta.agg);

  return (
    <Card
      className="mb-md"
      onPress={onPress}
      accessibilityLabel={onPress ? `View ${meta.label} details` : undefined}
      accessibilityHint={onPress ? 'Opens the detailed trend screen' : undefined}
    >
      <View className="flex-row items-center gap-sm">
        <Icon name={meta.icon} size={18} color={meta.accent} />
        <Txt variant="caption" className="text-mute">
          {meta.label.toUpperCase()}
        </Txt>
      </View>
      <Txt variant="display-md" weight="600" className="mt-xs text-ink">
        {meta.format(headline)}
      </Txt>
      {values.length >= 2 ? (
        <View className="mt-sm">
          <LineChart values={values} height={72} width={320} color={meta.accent} />
        </View>
      ) : null}
    </Card>
  );
}
