import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { StatTile } from '@/ui/StatTile';
import { Meter } from '@/ui/Meter';
import { Loading } from '@/ui/Loading';
import { EmptyState, ErrorState } from '@/ui/States';
import { Can } from '@/rbac/Gate';
import { useFinanceDashboard, useMonthlyReport } from '@/api/queries';
import { useSession } from '@/auth/SessionProvider';
import { formatCurrency, formatCurrencyCompact, titleiseSlug } from '@/lib/format';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * REPORTS — the month, told honestly
 * ────────────────────────────────────────────────────────────────
 *
 * Headline numbers are gym-wide; the P&L needs a branch, because that is how
 * the API divides them. Rather than hide that, the screen shows what it can
 * and says plainly what the branch switcher would unlock.
 *
 * Profit is shown even when it is NEGATIVE and tinted plainly rather than in
 * alarm red. A gym that spent more than it took this month needs to see the
 * number, not be shouted at by its own back office.
 */
export default function Reports() {
  const { session } = useSession();
  const currency = session?.studio?.currency ?? 'INR';
  const branchId = session?.activeBranchId ?? null;

  const finance = useFinanceDashboard();
  const monthly = useMonthlyReport(branchId);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <Can
        module="reports"
        fallback={<EmptyState title="Reports" body="You do not have access to reports." />}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
          <Text className="text-2xl font-semibold text-foreground">Reports</Text>

          {finance.isLoading ? (
            <Loading />
          ) : finance.error ? (
            <ErrorState onRetry={() => void finance.refetch()} />
          ) : finance.data ? (
            <>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <StatTile
                    label="Revenue this month"
                    value={formatCurrencyCompact(finance.data.total_revenue_this_month, currency)}
                    hint={describeGrowth(finance.data.revenue_growth_percent)}
                  />
                </View>
                <View className="flex-1">
                  <StatTile
                    label="MRR"
                    value={formatCurrencyCompact(finance.data.monthly_recurring_revenue, currency)}
                    hint={`${finance.data.active_subscriptions} subscriptions`}
                  />
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <StatTile
                    label="Avg member value"
                    value={formatCurrencyCompact(finance.data.average_member_value, currency)}
                    hint={`${finance.data.active_members} active`}
                  />
                </View>
                <View className="flex-1">
                  <StatTile
                    label="Refunds"
                    value={formatCurrencyCompact(finance.data.refund_total_this_month, currency)}
                    hint={`${Math.round(finance.data.refund_rate * 100) / 100}% of revenue`}
                  />
                </View>
              </View>
            </>
          ) : null}

          {!branchId ? (
            <View className="rounded-xl border border-border bg-card p-4">
              <Text className="text-sm text-muted-foreground">
                Pick a branch from the switcher to see this month&apos;s profit and loss.
                The gym-wide numbers above cover every branch.
              </Text>
            </View>
          ) : monthly.isLoading ? (
            <Loading />
          ) : monthly.error ? (
            <ErrorState onRetry={() => void monthly.refetch()} />
          ) : monthly.data ? (
            <MonthlyPanel data={monthly.data} currency={currency} />
          ) : null}
        </ScrollView>
      </Can>
    </SafeAreaView>
  );
}

function MonthlyPanel({
  data, currency,
}: { data: NonNullable<ReturnType<typeof useMonthlyReport>['data']>; currency: string }) {
  const categories = Object.entries(data.expenses_by_category)
    .sort(([, a], [, b]) => b - a);
  const biggest = categories[0]?.[1] ?? 0;
  const inProfit = data.profit >= 0;

  return (
    <>
      <View className="gap-3 rounded-xl border border-border bg-card p-4">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {data.period} · profit and loss
        </Text>

        <Line label="Revenue" value={formatCurrency(data.net_revenue, currency)} />
        {data.total_refunds > 0 ? (
          <Line label="Refunds" value={`−${formatCurrency(data.total_refunds, currency)}`} />
        ) : null}
        <Line label="Expenses" value={`−${formatCurrency(data.total_expenses, currency)}`} />

        <View className="mt-1 border-t border-border pt-3">
          <Line
            label={inProfit ? 'Profit' : 'Loss'}
            value={formatCurrency(Math.abs(data.profit), currency)}
            strong
            // Plain, not alarm red. A month in the red is information the
            // accountant needs, not an error they made.
            tint={inProfit ? tokens.success : tokens.foreground}
          />
        </View>

        <Text className="text-xs text-muted-foreground">
          {data.transaction_count} transaction{data.transaction_count === 1 ? '' : 's'}
        </Text>
      </View>

      {categories.length > 0 ? (
        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Where it went
          </Text>
          {categories.map(([slug, amount]) => (
            <View key={slug} className="gap-1">
              <View className="flex-row items-baseline justify-between">
                <Text className="text-sm text-foreground">{titleiseSlug(slug)}</Text>
                <Text className="text-sm text-muted-foreground">
                  {formatCurrency(amount, currency)}
                </Text>
              </View>
              {/* Bars are relative to the LARGEST category, not to total spend:
                  against the total, everything but rent is an invisible sliver. */}
              <Meter value={amount} max={Math.max(biggest, 1)} />
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

function Line({
  label, value, strong, tint,
}: { label: string; value: string; strong?: boolean; tint?: string }) {
  return (
    <View className="flex-row items-baseline justify-between">
      <Text className={strong ? 'text-base font-semibold text-foreground' : 'text-sm text-foreground'}>
        {label}
      </Text>
      <Text
        className={strong ? 'text-lg font-semibold' : 'text-sm text-muted-foreground'}
        style={tint ? { color: tint } : undefined}>
        {value}
      </Text>
    </View>
  );
}

/** "+483% on last month", or a plain note when there is nothing to compare. */
function describeGrowth(percent: number): string {
  if (!Number.isFinite(percent) || percent === 0) return 'vs last month';
  const rounded = Math.round(percent);
  return `${rounded > 0 ? '+' : ''}${rounded}% on last month`;
}
