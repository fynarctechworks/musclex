import { useEffect } from 'react';
import { View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  Screen,
  SkeletonCard,
  Txt,
} from '../src/design-system';
import { ScreenHeader } from '../src/navigation/ScreenHeader';
import { track } from '../src/analytics';
import { useHealthSummary } from '../src/api/queries';
import { MetricTrendCard } from '../src/features/health/MetricTrendCard';
import type { HealthMetricType } from '../src/api/types';

const HEART_TYPES: HealthMetricType[] = ['hr_resting', 'heart_rate', 'hrv', 'spo2'];

export default function HeartScreen() {
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  const summary = useHealthSummary(from, today, HEART_TYPES.join(','));

  useEffect(() => {
    track({ name: 'heart_viewed' });
  }, []);

  const byType = new Map(
    (summary.data?.metrics ?? []).map((m) => [m.type, m] as const),
  );
  // Render in a clinically sensible order, only the metrics that have data.
  const series = HEART_TYPES.map((t) => byType.get(t)).filter(
    (s): s is NonNullable<typeof s> => !!s && (s.points?.length ?? 0) > 0,
  );

  return (
    <Screen scroll onRefresh={() => summary.refetch()} refreshing={summary.isFetching}>
      <ScreenHeader title="Heart" className="mb-xs" />
      <Txt variant="body-sm" className="mb-lg text-body">
        Your last 7 days
      </Txt>
      <View className="gap-md">
        {summary.isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : summary.isError ? (
          <ErrorState onRetry={() => summary.refetch()} />
        ) : series.length === 0 ? (
          <EmptyState
            icon="heart"
            title="No heart data yet"
            message="Connect a wearable that tracks heart rate, or it will appear here after your next sync."
          />
        ) : (
          series.map((s) => <MetricTrendCard key={s.type} series={s} />)
        )}
      </View>
    </Screen>
  );
}
