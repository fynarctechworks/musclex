import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TriangleAlert } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { StatTile } from '@/ui/StatTile';
import { Sparkline } from '@/charts';
import { RowCard } from '@/ui/RowCard';
import { EmptyState, ErrorState } from '@/ui/States';
import { Loading } from '@/ui/Loading';
import { BranchSwitcher } from '@/features/BranchSwitcher';
import {
  useActivityFeed, useDashboardAlerts, useDashboardKpis, useDashboardPulse,
} from '@/api/queries';
import { useSession } from '@/auth/SessionProvider';
import { formatCurrencyCompact, formatNumber, formatRelative } from '@/lib/format';
import type { PulseMetric } from '@/api/types';
import { tokens } from '@/ui/tokens';

/**
 * Dashboard — the first screen staff see.
 *
 * Each section is its own query so a slow or failing one cannot blank the
 * screen. Sections render independently: KPIs may be live while alerts retry.
 */
export default function Dashboard() {
  const { session } = useSession();
  const currency = session?.studio?.currency ?? 'INR';

  const kpis = useDashboardKpis();
  const pulse = useDashboardPulse();
  const alerts = useDashboardAlerts();
  const activity = useActivityFeed();

  const refreshing =
    kpis.isRefetching || pulse.isRefetching || alerts.isRefetching || activity.isRefetching;

  const refreshAll = React.useCallback(() => {
    void kpis.refetch(); void pulse.refetch();
    void alerts.refetch(); void activity.refetch();
  }, [kpis, pulse, alerts, activity]);

  const firstName = (session?.user?.full_name ?? '').split(' ')[0];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={tokens.mutedForeground} />
        }>
        <View className="gap-3">
          <View>
            <Text className="text-2xl font-semibold text-foreground">
              {firstName ? `Hello, ${firstName}` : 'Today'}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {session?.studio?.name ?? ''}
            </Text>
          </View>
          <BranchSwitcher />
        </View>

        {/* ── Headline numbers ── */}
        {kpis.isLoading ? (
          <Loading />
        ) : kpis.error ? (
          <ErrorState onRetry={() => void kpis.refetch()} />
        ) : kpis.data ? (
          <View className="gap-3">
            <View className="flex-row gap-3">
              <StatTile
                className="flex-1"
                label="Active members"
                value={formatNumber(kpis.data.active_members, currency)}
                intent="up-is-good"
                {...deltaOf(pulse.data?.active_members)}
              />
              <StatTile
                className="flex-1"
                label="Expiring soon"
                value={formatNumber(kpis.data.expiring_soon_count, currency)}
                // More expiries is bad news, even though the arrow points up.
                intent="up-is-bad"
                hint="next 30 days"
              />
            </View>
            <View className="flex-row gap-3">
              <StatTile
                className="flex-1"
                label="Revenue this month"
                value={formatCurrencyCompact(kpis.data.monthly_revenue, currency)}
                intent="up-is-good"
                {...deltaOf(pulse.data?.mrr)}
              />
              <StatTile
                className="flex-1"
                label="Attendance"
                value={`${Math.round(kpis.data.avg_attendance_rate)}%`}
                intent="up-is-good"
                hint="average"
              />
            </View>
          </View>
        ) : null}

        {/* ── Member trend ── */}
        {pulse.data?.active_members?.sparkline?.length ? (
          <View className="rounded-lg border border-border bg-card p-4">
            <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Members trend
            </Text>
            <View className="items-center pt-2">
              <Sparkline values={pulse.data.active_members.sparkline} width={280} height={44} />
            </View>
          </View>
        ) : null}

        {/* ── Needs attention ── */}
        <Section title="Needs attention">
          {alerts.isLoading ? (
            <Loading />
          ) : alerts.error ? (
            <ErrorState onRetry={() => void alerts.refetch()} />
          ) : (alerts.data ?? []).length === 0 ? (
            <EmptyState title="Nothing needs attention" body="No expiring memberships or lapsed members." />
          ) : (
            <View className="gap-2">
              {(alerts.data ?? []).slice(0, 5).map((a) => (
                <RowCard
                  key={a.id}
                  title={a.message}
                  titleLines={3}
                  leading={
                    <TriangleAlert
                      size={18}
                      color={a.severity === 'high' ? tokens.destructive : tokens.mutedForeground}
                    />
                  }
                  trailing={
                    a.severity === 'high'
                      ? <Badge variant="destructive"><Text>Urgent</Text></Badge>
                      : undefined
                  }
                  chevron={false}
                />
              ))}
            </View>
          )}
        </Section>

        {/* ── Live activity ── */}
        <Section title="Recent activity">
          {activity.isLoading ? (
            <Loading />
          ) : activity.error ? (
            <ErrorState onRetry={() => void activity.refetch()} />
          ) : (activity.data ?? []).length === 0 ? (
            <EmptyState title="No activity yet" body="Check-ins and payments appear here as they happen." />
          ) : (
            <View className="gap-2">
              {(activity.data ?? []).slice(0, 8).map((item) => (
                <RowCard
                  key={item.id}
                  title={item.member_name ?? item.message}
                  subtitle={item.branch_name ?? undefined}
                  meta={formatRelative(item.timestamp)}
                  chevron={false}
                />
              ))}
            </View>
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Map a pulse metric onto StatTile's delta props; omit when the API sends null. */
function deltaOf(metric: PulseMetric | undefined) {
  if (!metric || metric.delta_pct === null || metric.delta_pct === undefined) return {};
  return { deltaPercent: metric.delta_pct, hint: metric.delta_label ?? undefined };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </Text>
      {children}
    </View>
  );
}
