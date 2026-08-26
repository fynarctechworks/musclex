import React from 'react';
import { View } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { DataList } from '@/ui/DataList';
import { RowCard } from '@/ui/RowCard';
import { StatTile } from '@/ui/StatTile';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Can } from '@/rbac/Gate';
import { useVisits } from '@/api/queries';
import { initialsOf } from '@/features/MemberRow';
import { formatRelative, formatTime, titleiseSlug, toLocalISODate } from '@/lib/format';
import type { Visit } from '@/api/types';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * VISITS — who came in, and who was turned away
 * ────────────────────────────────────────────────────────────────
 *
 * A DENIED attempt is still a recorded visit, and it is the more interesting
 * row: somebody stood at the door and did not get in. They are shown alongside
 * successes rather than filtered out, with the reason, because "27 visits
 * today" that quietly excludes four refusals is a number that hides the thing
 * a manager needs to act on.
 */
type Range = 'today' | 'week' | 'month';

const RANGES: Array<{ value: Range; label: string; days: number }> = [
  { value: 'today', label: 'Today', days: 0 },
  { value: 'week', label: '7 days', days: 6 },
  { value: 'month', label: '30 days', days: 29 },
];

export default function Visits() {
  const [range, setRange] = React.useState<Range>('week');

  const { from, to } = React.useMemo(() => {
    const days = RANGES.find((r) => r.value === range)?.days ?? 6;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return { from: start, to: end };
  }, [range]);

  const query = useVisits({ from, to, limit: 100 });
  const rows = query.data?.data ?? [];

  const counts = React.useMemo(() => {
    let ok = 0, denied = 0;
    for (const v of rows) {
      if (v.status && v.status !== 'success') denied++;
      else ok++;
    }
    return { ok, denied };
  }, [rows]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Visits' }} />
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: tokens.background }}>
        <Can module="check_ins">
          <View className="gap-3 px-4 pb-3 pt-3">
            <SegmentedControl
              value={range}
              onChange={(v) => setRange(v as Range)}
              segments={RANGES.map((r) => ({ value: r.value, label: r.label }))}
              testID="visits-range"
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <StatTile label="Came in" value={String(counts.ok)} hint="successful" />
              </View>
              <View className="flex-1">
                {/* Shown even at zero: a manager checking whether anyone was
                    turned away needs the answer, and an absent tile reads as
                    "not measured" rather than "none". */}
                <StatTile label="Turned away" value={String(counts.denied)} hint="denied entry" />
              </View>
            </View>
          </View>

          <DataList<Visit>
            data={rows}
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => void query.refetch()}
            onRefresh={() => void query.refetch()}
            isRefreshing={query.isFetching && !query.isLoading}
            keyExtractor={(v) => v.id}
            emptyTitle="No visits"
            emptyBody="Nobody checked in during this period."
            renderItem={({ item }) => {
              const denied = Boolean(item.status && item.status !== 'success');
              const today = toLocalISODate(new Date(item.checked_in_at)) === toLocalISODate(new Date());
              return (
                <RowCard
                  initials={initialsOf(item.member?.full_name ?? '?')}
                  title={item.member?.full_name ?? 'Member'}
                  subtitle={item.member?.member_code ?? undefined}
                  meta={[
                    // Today reads better as a clock time; older visits as
                    // "3 days ago" — nobody cares that it was 7:04am last Tuesday.
                    today ? formatTime(item.checked_in_at) : formatRelative(item.checked_in_at),
                    titleiseSlug(item.checkin_method),
                    denied ? titleiseSlug(item.failure_reason, 'Denied') : null,
                  ].filter(Boolean).join(' · ')}
                  onPress={
                    item.member_id ? () => router.push(`/member/${item.member_id}`) : undefined
                  }
                  trailing={
                    denied ? (
                      <Badge variant="warning"><Text>Turned away</Text></Badge>
                    ) : undefined
                  }
                  testID={`visit-${item.id}`}
                />
              );
            }}
          />
        </Can>
      </SafeAreaView>
    </>
  );
}
