import { useEffect } from 'react';
import { View } from 'react-native';
import {
  BarChart,
  Card,
  CollapsingHeader,
  EmptyState,
  ErrorState,
  SkeletonCard,
  Txt,
  health,
} from '../src/design-system';
import type { BarDatum } from '../src/design-system';
import { BackButton } from '../src/navigation/BackButton';
import { track } from '../src/analytics';
import { useHealthSummary } from '../src/api/queries';
import type { HealthMetricSeries } from '../src/api/types';

const SLEEP_TYPES = 'sleep_duration,sleep_deep,sleep_rem';

/** Seconds → "7h 32m" (or "32m" under an hour). */
function fmtDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

function pointsOf(series?: HealthMetricSeries) {
  return series?.points ?? [];
}

/** Narrow weekday for a YYYY-MM-DD day string (parsed as local midnight). */
function weekday(day?: string): string {
  if (!day) return '';
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'narrow',
  });
}

/** A single sleep-stage segment of the breakdown bar. */
function StageBar({
  segments,
  total,
}: {
  segments: { label: string; seconds: number; color: string }[];
  total: number;
}) {
  return (
    <View>
      <View className="h-[14px] flex-row overflow-hidden rounded-pill" style={{ width: '100%' }}>
        {segments.map((s) =>
          s.seconds > 0 ? (
            <View
              key={s.label}
              style={{ flex: s.seconds / total, backgroundColor: s.color }}
            />
          ) : null,
        )}
      </View>
      <View className="mt-sm flex-row flex-wrap gap-y-xs">
        {segments.map((s) => (
          <View key={s.label} className="w-1/3 flex-row items-center gap-xs">
            <View className="h-[8px] w-[8px] rounded-full" style={{ backgroundColor: s.color }} />
            <View>
              <Txt variant="caption" className="text-mute">
                {s.label}
              </Txt>
              <Txt variant="body-sm" weight="600" className="text-ink">
                {fmtDuration(s.seconds)}
              </Txt>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function SleepScreen() {
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  const summary = useHealthSummary(from, today, SLEEP_TYPES);

  useEffect(() => {
    track({ name: 'sleep_viewed' });
  }, []);

  const byType = new Map(
    (summary.data?.metrics ?? []).map((m) => [m.type, m] as const),
  );
  const duration = pointsOf(byType.get('sleep_duration'));
  const lastNight = duration[duration.length - 1];

  // 7-day nightly trend (hours), most recent night highlighted.
  const bars: BarDatum[] = duration.map((p, i) => ({
    label: weekday(p.day),
    value: (p.total ?? 0) / 3600,
    highlight: i === duration.length - 1,
  }));
  const avgSeconds =
    duration.length > 0
      ? duration.reduce((s, p) => s + (p.total ?? 0), 0) / duration.length
      : 0;

  // Stage breakdown for the most recent night — only when real stage data exists.
  const deepPt = pointsOf(byType.get('sleep_deep')).find((p) => p.day === lastNight?.day);
  const remPt = pointsOf(byType.get('sleep_rem')).find((p) => p.day === lastNight?.day);
  const deep = deepPt?.total ?? 0;
  const rem = remPt?.total ?? 0;
  const nightTotal = lastNight?.total ?? 0;
  const other = Math.max(0, nightTotal - deep - rem);
  const hasStages = deep > 0 || rem > 0;

  return (
    <CollapsingHeader
      title="Sleep"
      subtitle="Your last 7 nights"
      left={<BackButton className="" />}
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
      ) : duration.length === 0 ? (
        <EmptyState
          icon="chart"
          title="No sleep data yet"
          message="Connect a wearable that tracks sleep, or it will appear here after your next sync."
        />
      ) : (
        <>
          {/* Last night headline */}
          <Card elevated className="mb-md">
            <Txt variant="caption" className="text-mute">
              {`LAST NIGHT · ${weekday(lastNight?.day)
                ? new Date(`${lastNight?.day}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  })
                : ''}`}
            </Txt>
            <View className="mt-xs flex-row items-baseline gap-sm">
              <Txt variant="display-lg" weight="600" style={{ color: health.sleep }}>
                {fmtDuration(nightTotal)}
              </Txt>
            </View>
            <Txt variant="body-sm" className="mt-xxs text-mute">
              {`7-night average ${fmtDuration(avgSeconds)}`}
            </Txt>
          </Card>

          {/* Stage breakdown — real data only */}
          {hasStages ? (
            <Card className="mb-md">
              <Txt variant="caption" className="mb-md text-mute">
                STAGES
              </Txt>
              <StageBar
                total={Math.max(1, nightTotal)}
                segments={[
                  { label: 'Deep', seconds: deep, color: health.sleep },
                  { label: 'REM', seconds: rem, color: health.oxygen },
                  { label: 'Light / awake', seconds: other, color: '#3A3A40' },
                ]}
              />
            </Card>
          ) : null}

          {/* 7-night trend */}
          <Card>
            <Txt variant="caption" className="text-mute">
              NIGHTLY HOURS
            </Txt>
            <View className="mt-md">
              <BarChart data={bars} height={132} color={health.sleep} />
            </View>
          </Card>
        </>
      )}
    </CollapsingHeader>
  );
}
