import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Icon, Txt, colors } from '../../design-system';
import { useHealthSummary } from '../../api/queries';
import { HOME_METRICS, METRIC_META } from '../health/metrics';
import type { HealthMetricSeries } from '../../api/types';

/** Roll a metric's series into a single headline number per its agg rule. */
function headline(series?: HealthMetricSeries): number | null {
  const points = series?.points ?? [];
  if (points.length === 0) return null;
  const meta = series?.type ? METRIC_META[series.type] : undefined;
  const last = points[points.length - 1];
  if (!meta || meta.agg === 'latest') return last.total ?? null;
  if (meta.agg === 'avg') {
    const vals = points.map((p) => p.avg ?? p.total ?? 0);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return last.total ?? null; // sum metrics → today's total
}

/**
 * Home snapshot of today's wearable metrics. Renders only when there is health
 * data to show, so members without a connected device see no empty noise — the
 * Health screen itself drives connection. Real data only.
 */
export function HealthCard() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = useHealthSummary(today, today, HOME_METRICS.join(','));

  const byType = new Map(
    (data?.metrics ?? []).map((m) => [m.type, m] as const),
  );
  const tiles = HOME_METRICS.map((type) => ({
    type,
    meta: METRIC_META[type],
    value: headline(byType.get(type)),
  })).filter((t) => t.meta && t.value != null);

  if (tiles.length === 0) return null;

  return (
    <Pressable onPress={() => router.push('/health')}>
      <Card>
        <View className="flex-row items-center justify-between">
          <Txt variant="caption" className="text-mute">
            TODAY'S HEALTH
          </Txt>
          <Icon name="chevron-right" size={16} color={colors.mute} />
        </View>

        <View className="mt-sm flex-row flex-wrap gap-y-md">
          {tiles.map(({ type, meta, value }) => (
            <View key={type} className="w-1/2 flex-row items-center gap-sm">
              <Icon name={meta!.icon} size={18} color={meta!.accent} />
              <View>
                <Txt variant="body-md" weight="600" className="text-ink">
                  {meta!.format(value as number)}
                </Txt>
                <Txt variant="caption" className="text-mute">
                  {meta!.label}
                </Txt>
              </View>
            </View>
          ))}
        </View>
      </Card>
    </Pressable>
  );
}
