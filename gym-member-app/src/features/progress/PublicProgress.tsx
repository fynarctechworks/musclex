import { useState } from 'react';
import { View } from 'react-native';
import {
  Card,
  EmptyState,
  Screen,
  SegmentedControl,
  SkeletonCard,
  Txt,
} from '../../design-system';
import { useWeightSeries, usePublicHealthDaily } from '../../api/queries';
import { formatDate } from '../../lib/format';

type Range = '1M' | '3M' | 'all';
const RANGE_DAYS: Record<Range, number> = { '1M': 30, '3M': 90, all: 365 };

function Stat({ label, value, unit }: { label: string; value?: string | null; unit?: string }) {
  return (
    <Card soft className="flex-1">
      <Txt variant="caption" className="text-mute">
        {label}
      </Txt>
      <View className="mt-xs flex-row items-end gap-xxs">
        <Txt variant="display-sm" weight="600" className="text-ink">
          {value ?? '—'}
        </Txt>
        {unit ? <Txt variant="caption" className="mb-[3px] text-mute">{unit}</Txt> : null}
      </View>
    </Card>
  );
}

/**
 * Progress for gym-less PUBLIC users: personal weight + steps history from the
 * app_user-scoped public endpoints (no gym data). Gym members keep the richer
 * gym Progress screen (body metrics + photos) — this is the public counterpart.
 */
export function PublicProgress() {
  const [range, setRange] = useState<Range>('3M');
  const days = RANGE_DAYS[range];
  const weight = useWeightSeries(days);
  const health = usePublicHealthDaily(days);

  const entries = weight.data?.entries ?? [];
  const latest = weight.data?.latest?.weightKg ?? null;
  const oldest = entries.length ? entries[entries.length - 1].weightKg : null;
  const change = latest != null && oldest != null ? latest - oldest : null;

  const healthDays = health.data?.days ?? [];
  const avgSteps =
    healthDays.length > 0
      ? Math.round(healthDays.reduce((s, d) => s + (d.steps ?? 0), 0) / healthDays.length)
      : null;

  const loading = weight.isLoading || health.isLoading;

  return (
    <Screen
      scroll
      onRefresh={() => {
        weight.refetch();
        health.refetch();
      }}
      refreshing={weight.isRefetching}
    >
      <Txt variant="display-md" weight="600" className="text-ink">
        Progress
      </Txt>
      <Txt variant="body-sm" className="mt-xxs text-body">
        Your personal trends
      </Txt>

      <View className="mt-md">
        <SegmentedControl
          options={[
            { label: '1M', value: '1M' },
            { label: '3M', value: '3M' },
            { label: 'All', value: 'all' },
          ]}
          value={range}
          onChange={(v) => setRange(v as Range)}
        />
      </View>

      {loading ? (
        <View className="mt-md gap-md">
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <View className="mt-md gap-md">
          <View className="flex-row gap-md">
            <Stat label="WEIGHT" value={latest != null ? latest.toFixed(1) : null} unit="kg" />
            <Stat
              label="CHANGE"
              value={change != null ? `${change > 0 ? '+' : ''}${change.toFixed(1)}` : null}
              unit="kg"
            />
            <Stat label="AVG STEPS" value={avgSteps != null ? avgSteps.toLocaleString() : null} />
          </View>

          <Card>
            <Txt variant="caption" className="text-mute">
              WEIGH-INS
            </Txt>
            {entries.length > 0 ? (
              <View className="mt-sm gap-xs">
                {entries.slice(0, 12).map((e) => (
                  <View
                    key={e.date}
                    className="flex-row items-center justify-between border-b border-hairline py-sm"
                  >
                    <Txt variant="body-sm" className="text-body">
                      {formatDate(e.date)}
                    </Txt>
                    <Txt variant="body-md" weight="600" className="text-ink">
                      {e.weightKg.toFixed(1)} kg
                    </Txt>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState
                compact
                icon="chart"
                title="No weigh-ins yet"
                message="Log your weight from Home to start tracking."
              />
            )}
          </Card>
        </View>
      )}
    </Screen>
  );
}
