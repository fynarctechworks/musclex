import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataList } from '@/ui/DataList';
import { RowCard } from '@/ui/RowCard';
import { StatTile } from '@/ui/StatTile';
import { Sheet } from '@/ui/Sheet';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Can } from '@/rbac/Gate';
import {
  useCreateExpense, useExpenseCategories, useExpenseSummary, useExpenses,
} from '@/api/queries';
import { useSession } from '@/auth/SessionProvider';
import { useToast } from '@/ui/Toast';
import { formatCurrency, formatCurrencyCompact, formatDate, toAmount } from '@/lib/format';
import { toLocalISODate } from '@/lib/format';
import type { Expense } from '@/api/types';
import { tokens } from '@/ui/tokens';

/** "1 entry", not "1 entries". */
function pluralEntries(n: number): string {
  return `${n} ${n === 1 ? 'entry' : 'entries'}`;
}

/**
 * ────────────────────────────────────────────────────────────────
 * EXPENSES — what the gym spent
 * ────────────────────────────────────────────────────────────────
 *
 * The summary endpoint REQUIRES a branch and 400s without one, while the list
 * happily spans branches. So on "All branches" the tiles are hidden rather
 * than firing a request that can only fail — an error card where a number
 * should be teaches staff to ignore the row.
 *
 * Recording is append-only server-side (expenses are modelled as events), so
 * there is no edit here by design: a correction is a new entry, which is what
 * an auditable ledger wants.
 */
export default function Expenses() {
  const { session } = useSession();
  const toast = useToast();
  const currency = session?.studio?.currency ?? 'INR';

  const branchId = session?.activeBranchId ?? null;
  const list = useExpenses({ branchId });
  const summary = useExpenseSummary(branchId);
  const categories = useExpenseCategories();
  const create = useCreateExpense();

  const [recording, setRecording] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [vendor, setVendor] = React.useState('');
  const [categoryId, setCategoryId] = React.useState<string>('');
  const [error, setError] = React.useState<string | null>(null);

  const cats = categories.data ?? [];
  React.useEffect(() => {
    if (!categoryId && cats.length > 0) setCategoryId(cats[0].id);
  }, [cats, categoryId]);

  const rows = list.data?.data ?? [];

  async function save() {
    setError(null);
    const value = Number(amount);

    if (!branchId) {
      // The DTO requires a branch. Guessing one would file a Bandra expense
      // against Andheri, which is worse than refusing.
      setError('Pick a single branch before recording an expense.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (description.trim().length < 2) {
      setError('Say what the expense was for.');
      return;
    }
    if (!categoryId) {
      setError('Pick a category.');
      return;
    }

    try {
      await create.mutateAsync({
        branchId,
        categoryId,
        amount: Math.round(value * 100) / 100,
        description: description.trim(),
        expenseDate: toLocalISODate(new Date()),
        vendor: vendor.trim() || undefined,
      });
      setAmount(''); setDescription(''); setVendor('');
      setRecording(false);
      toast.show('Expense recorded');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record that expense');
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Expenses' }} />
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: tokens.background }}>
        <Can module="payments">
          <View className="gap-3 px-4 pb-3 pt-3">
            {branchId && summary.data ? (
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <StatTile
                    label="Today"
                    value={formatCurrencyCompact(summary.data.today.total, currency)}
                    hint={pluralEntries(summary.data.today.count)}
                  />
                </View>
                <View className="flex-1">
                  <StatTile
                    label="This month"
                    value={formatCurrencyCompact(summary.data.month.total, currency)}
                    hint={pluralEntries(summary.data.month.count)}
                  />
                </View>
              </View>
            ) : !branchId ? (
              <Text className="text-sm text-muted-foreground">
                Totals need a single branch — pick one from the switcher to see them.
              </Text>
            ) : null}

            <Can module="payments" action="create">
              <Button onPress={() => setRecording(true)} testID="record-expense">
                <Text>Record an expense</Text>
              </Button>
            </Can>
          </View>

          <DataList<Expense>
            data={rows}
            isLoading={list.isLoading}
            error={list.error}
            onRetry={() => void list.refetch()}
            onRefresh={() => void list.refetch()}
            isRefreshing={list.isFetching && !list.isLoading}
            keyExtractor={(e) => e.id}
            emptyTitle="No expenses"
            emptyBody="Money the gym spends shows up here once recorded."
            renderItem={({ item }) => (
              <RowCard
                title={formatCurrency(toAmount(item.amount), item.currency ?? currency)}
                subtitle={item.description}
                meta={[
                  item.category_ref?.name ?? item.category ?? null,
                  item.vendor,
                  formatDate(item.expense_date),
                ].filter(Boolean).join(' · ')}
                chevron={false}
                trailing={
                  item.payment_method ? (
                    <Badge variant="secondary">
                      <Text>{item.payment_method.replace(/_/g, ' ')}</Text>
                    </Badge>
                  ) : undefined
                }
                testID={`expense-${item.id}`}
              />
            )}
          />
        </Can>
      </SafeAreaView>

      {/* Sibling of the list — a sheet nested inside one renders off-screen. */}
      <Sheet
        open={recording}
        onClose={() => setRecording(false)}
        title="Record an expense"
        snapPoints={['70%']}>
        <View className="gap-3 px-4 pb-6">
          <View className="gap-1">
            <Label><Text>Amount</Text></Label>
            <Input
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              testID="expense-amount"
            />
          </View>

          <View className="gap-1">
            <Label><Text>What for</Text></Label>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="Electricity — August"
              testID="expense-description"
            />
          </View>

          <View className="gap-1">
            <Label><Text>Vendor (optional)</Text></Label>
            <Input value={vendor} onChangeText={setVendor} placeholder="MSEB"
                   testID="expense-vendor" />
          </View>

          {cats.length > 0 ? (
            <View className="gap-1">
              <Label><Text>Category</Text></Label>
              <SegmentedControl
                value={categoryId}
                onChange={setCategoryId}
                segments={cats.slice(0, 3).map((c) => ({ value: c.id, label: c.name }))}
                testID="expense-category"
              />
              {cats.length > 3 ? (
                <SegmentedControl
                  value={categoryId}
                  onChange={setCategoryId}
                  segments={cats.slice(3, 6).map((c) => ({ value: c.id, label: c.name }))}
                />
              ) : null}
            </View>
          ) : (
            <Text className="text-sm text-muted-foreground">
              No expense categories yet — add them on the web first.
            </Text>
          )}

          {error ? (
            <Text className="text-sm" style={{ color: tokens.destructive }}>{error}</Text>
          ) : null}

          <Button onPress={save} disabled={create.isPending} testID="save-expense">
            <Text>{create.isPending ? 'Saving…' : 'Record'}</Text>
          </Button>
        </View>
      </Sheet>
    </>
  );
}
