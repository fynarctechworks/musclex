import { View } from 'react-native';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ListRow,
  Screen,
  SkeletonCard,
  Txt,
} from '../src/design-system';
import { ScreenHeader } from '../src/navigation/ScreenHeader';
import { useVisits, useVisitSummary } from '../src/api/queries';
import { formatDate } from '../src/lib/format';

const METHOD_LABEL: Record<string, string> = {
  qr: 'QR',
  manual: 'Manual',
  facial: 'Face',
  biometric_device: 'Biometric',
  member_app: 'App',
};

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Visit history — the member's own check-ins, with a small per-month rollup.
 * Previously the app had no way to see past visits at all (only aggregate
 * streak counts on Home).
 */
export default function VisitsScreen() {
  const summary = useVisitSummary(6);
  const list = useVisits(50);

  const visits = list.data?.visits ?? [];
  const maxMonth = Math.max(1, ...(summary.data?.months ?? []).map((m) => m.count));

  return (
    <Screen>
      <ScreenHeader title="Visit history" />

      {summary.isLoading ? (
        <SkeletonCard />
      ) : summary.data ? (
        <Card>
          <View className="flex-row gap-lg">
            <View>
              <Txt variant="display-sm" weight="700" className="text-ink">
                {summary.data.thisMonthVisits}
              </Txt>
              <Txt variant="caption" className="text-mute">
                This month
              </Txt>
            </View>
            <View>
              <Txt variant="display-sm" weight="700" className="text-ink">
                {summary.data.totalVisits}
              </Txt>
              <Txt variant="caption" className="text-mute">
                Last 6 months
              </Txt>
            </View>
          </View>

          {summary.data.months.length > 0 && (
            <View className="mt-lg gap-xs">
              {summary.data.months.map((m) => (
                <View key={m.month} className="flex-row items-center gap-sm">
                  <Txt variant="caption" className="w-20 text-mute">
                    {monthLabel(m.month)}
                  </Txt>
                  <View className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <View
                      className="h-2 rounded-full bg-accent"
                      style={{ width: `${(m.count / maxMonth) * 100}%` }}
                    />
                  </View>
                  <Txt variant="caption" className="w-6 text-right text-body">
                    {m.count}
                  </Txt>
                </View>
              ))}
            </View>
          )}
        </Card>
      ) : null}

      <View className="mt-md">
        {list.isLoading ? (
          <SkeletonCard />
        ) : list.isError ? (
          <Card>
            <ErrorState
              compact
              onRetry={list.refetch}
              retrying={list.isRefetching}
            />
          </Card>
        ) : visits.length === 0 ? (
          <Card>
            <EmptyState
              title="No visits yet"
              message="Your check-ins will appear here once you scan in at the gym."
            />
          </Card>
        ) : (
          <Card>
            {visits.map((v, i) => (
              <ListRow
                key={v.id}
                label={v.checkedInAt ? formatDate(v.checkedInAt) : '—'}
                value={[
                  v.branchName,
                  METHOD_LABEL[v.method] ?? v.method,
                  v.durationMinutes != null ? `${v.durationMinutes} min` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                last={i === visits.length - 1}
                right={
                  v.status !== 'success' ? (
                    <Badge tone="error" label={v.status} />
                  ) : undefined
                }
              />
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}
