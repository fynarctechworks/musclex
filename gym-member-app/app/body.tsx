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

const BODY_TYPES: HealthMetricType[] = ['body_weight', 'body_fat', 'vo2max'];

export default function BodyScreen() {
  // Body composition moves slowly — a 30-day window reads better than 7.
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  const summary = useHealthSummary(from, today, BODY_TYPES.join(','));

  useEffect(() => {
    track({ name: 'body_viewed' });
  }, []);

  const byType = new Map(
    (summary.data?.metrics ?? []).map((m) => [m.type, m] as const),
  );
  const series = BODY_TYPES.map((t) => byType.get(t)).filter(
    (s): s is NonNullable<typeof s> => !!s && (s.points?.length ?? 0) > 0,
  );

  return (
    <Screen scroll onRefresh={() => summary.refetch()} refreshing={summary.isFetching}>
      <ScreenHeader title="Body" className="mb-xs" />
      <Txt variant="body-sm" className="mb-lg text-body">
        Your last 30 days
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
            icon="chart"
            title="No body data yet"
            message="Log your weight on the Health screen, or connect a smart scale to see trends here."
          />
        ) : (
          series.map((s) => <MetricTrendCard key={s.type} series={s} />)
        )}
      </View>
    </Screen>
  );
}
