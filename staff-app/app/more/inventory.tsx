import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataList } from '@/ui/DataList';
import { RowCard } from '@/ui/RowCard';
import { StatTile } from '@/ui/StatTile';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Can } from '@/rbac/Gate';
import { useProducts } from '@/api/queries';
import { useSession } from '@/auth/SessionProvider';
import { formatCurrency } from '@/lib/format';
import { describeStock, stockFor, stockVariant } from '@/lib/stock';
import type { Product } from '@/api/types';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * INVENTORY — what is on the shelf
 * ────────────────────────────────────────────────────────────────
 *
 * Read-only: `inventory.edit` is manager-level and the accountant who most
 * wants this screen has `view` + `export` only.
 *
 * "Needs attention" leads, because the question staff actually bring here is
 * "what am I about to run out of", not "list everything". Out-of-stock and
 * untracked are counted SEPARATELY: a product nobody set a stock record for is
 * not sold out, and conflating them is what made the seeded shop look fully
 * stocked while every sale failed.
 */
type Filter = 'attention' | 'all';

export default function Inventory() {
  const { session } = useSession();
  const currency = session?.studio?.currency ?? 'INR';

  const [filter, setFilter] = React.useState<Filter>('attention');
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useProducts();
  const all = query.data?.data ?? [];

  const counts = React.useMemo(() => {
    let out = 0, low = 0, untracked = 0;
    for (const p of all) {
      const s = stockFor(p);
      if (s.kind === 'out') out++;
      else if (s.kind === 'low') low++;
      else if (s.kind === 'untracked') untracked++;
    }
    return { out, low, untracked };
  }, [all]);

  const rows = React.useMemo(() => {
    const matches = (p: Product) =>
      !debounced ||
      p.product_name.toLowerCase().includes(debounced) ||
      (p.sku ?? '').toLowerCase().includes(debounced);

    const needsAttention = (p: Product) => {
      const k = stockFor(p).kind;
      return k === 'out' || k === 'low' || k === 'untracked';
    };

    return all
      .filter(matches)
      .filter((p) => (filter === 'attention' ? needsAttention(p) : true));
  }, [all, debounced, filter]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Inventory' }} />
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: tokens.background }}>
        <Can module="inventory">
          <View className="gap-3 px-4 pb-3 pt-3">
            {/*
              Two tiles, not three: three across a phone wraps every label onto
              two lines and reads worse than the numbers deserve.
            */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <StatTile label="Out of stock" value={String(counts.out)} hint="cannot be sold" />
              </View>
              <View className="flex-1">
                <StatTile label="Running low" value={String(counts.low)} hint="at reorder level" />
              </View>
            </View>

            {/*
              Untracked gets a line only when it is non-zero. It is a SETUP gap
              (nobody created a stock record) rather than a sales problem, and
              for most gyms it is permanently zero — a tile that always reads 0
              is noise that trains people to skip the whole row.
            */}
            {counts.untracked > 0 ? (
              <Text className="text-sm text-muted-foreground">
                {counts.untracked} product{counts.untracked === 1 ? '' : 's'} have no stock
                record — they cannot be sold until one is added.
              </Text>
            ) : null}

            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search products or SKU"
              autoCapitalize="none"
              testID="inventory-search"
            />

            <SegmentedControl
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              segments={[
                { value: 'attention', label: 'Needs attention' },
                { value: 'all', label: 'Everything' },
              ]}
              testID="inventory-filter"
            />
          </View>

          <DataList<Product>
            data={rows}
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => void query.refetch()}
            onRefresh={() => void query.refetch()}
            isRefreshing={query.isFetching && !query.isLoading}
            keyExtractor={(p) => p.id}
            emptyTitle={filter === 'attention' ? 'Nothing needs attention' : 'No products'}
            emptyBody={
              filter === 'attention'
                ? 'Every product is stocked above its reorder level.'
                : 'Products added on the web show up here.'
            }
            renderItem={({ item }) => {
              const state = stockFor(item);
              return (
                <RowCard
                  title={item.product_name}
                  subtitle={item.sku ?? undefined}
                  meta={formatCurrency(item.price, currency)}
                  chevron={false}
                  trailing={
                    <Badge variant={stockVariant(state)}>
                      <Text>{describeStock(state)}</Text>
                    </Badge>
                  }
                  testID={`product-${item.id}`}
                />
              );
            }}
          />
        </Can>
      </SafeAreaView>
    </>
  );
}
