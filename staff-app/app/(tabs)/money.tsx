import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { DataList } from '@/ui/DataList';
import { RowCard } from '@/ui/RowCard';
import { StatTile } from '@/ui/StatTile';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Can } from '@/rbac/Gate';
import { EmptyState } from '@/ui/States';
import { useDashboardKpis, usePayments } from '@/api/queries';
import { useSession } from '@/auth/SessionProvider';
import { formatCurrency, formatCurrencyCompact, formatRelative } from '@/lib/format';
import {
  PAYMENT_PAID, PAYMENT_PENDING, paymentVariant, statusParam,
  type PaymentFilter,
} from '@/lib/payment-status';
import type { Payment } from '@/api/types';
import { tokens } from '@/ui/tokens';

type Row = Payment & { member?: { full_name?: string } | null };
type Filter = PaymentFilter;

/**
 * Money — payments taken, and what is outstanding.
 *
 * The whole screen sits behind `<Can module="payments">`: a trainer has no
 * payments permission and must not see gym revenue. The tab is already hidden
 * for them, but a deep link would otherwise reach this route.
 */
export default function Money() {
  const [filter, setFilter] = React.useState<Filter>('all');
  const { session } = useSession();
  const currency = session?.studio?.currency ?? 'INR';

  const kpis = useDashboardKpis();
  const query = usePayments({ status: statusParam(filter), limit: 20 });
  const rows = query.data?.data ?? [];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <Can
        module="payments"
        fallback={
          <EmptyState
            title="Not available"
            body="Your role does not include payments."
          />
        }>
        <View className="gap-3 px-4 pb-3 pt-2">
          <Text className="text-2xl font-semibold text-foreground">Money</Text>

          <View className="flex-row gap-3">
            <StatTile
              className="flex-1"
              label="This month"
              value={formatCurrencyCompact(kpis.data?.monthly_revenue ?? 0, currency)}
              intent="up-is-good"
            />
            <StatTile
              className="flex-1"
              label="Expiring soon"
              value={String(kpis.data?.expiring_soon_count ?? 0)}
              intent="up-is-bad"
              hint="chase renewals"
            />
          </View>

          <SegmentedControl
            value={filter}
            onChange={setFilter}
            segments={[
              { value: 'all', label: 'All' },
              // 'paid' — NOT 'completed'. See lib/payment-status.ts: the old
              // value matched no row the product has ever written.
              { value: PAYMENT_PAID, label: 'Paid' },
              { value: PAYMENT_PENDING, label: 'Pending' },
            ]}
          />
        </View>

        <DataList<Row>
          data={rows}
          isLoading={query.isLoading}
          isRefreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          error={query.error}
          onRetry={() => void query.refetch()}
          keyExtractor={(p) => p.id}
          emptyTitle="No payments"
          emptyBody="Payments taken at the desk or online appear here."
          renderItem={({ item }) => (
            <RowCard
              title={formatCurrency(item.amount, item.currency ?? currency)}
              subtitle={item.member?.full_name ?? item.receipt_number ?? undefined}
              meta={[
                item.payment_method,
                item.paid_at ? formatRelative(item.paid_at) : null,
              ].filter(Boolean).join(' · ')}
              trailing={
                <Badge variant={paymentVariant(item.status)}>
                  <Text>{item.status}</Text>
                </Badge>
              }
              chevron={false}
            />
          )}
        />
      </Can>
    </SafeAreaView>
  );
}
