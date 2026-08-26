import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { DataList } from '@/ui/DataList';
import { RowCard } from '@/ui/RowCard';
import { Can } from '@/rbac/Gate';
import { useBranches } from '@/api/queries';
import { callNumber } from '@/lib/contact';
import type { Branch } from '@/api/types';
import { tokens } from '@/ui/tokens';

/**
 * Branches — the gym's sites.
 *
 * Read-only. Creating and editing branches is `branches.create`/`edit` and,
 * more to the point, is a desktop job: addresses, opening hours and capacity
 * are set up once and rarely from a phone.
 *
 * Most fields are optional in the schema and commonly null, so every line here
 * is conditional. A row that renders "null · null · null" is worse than a row
 * that just says the branch name.
 */
export default function Branches() {
  const query = useBranches();
  const branches = query.data ?? [];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Branches' }} />
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: tokens.background }}>
        <Can module="branches">
          <DataList<Branch>
            data={branches}
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => void query.refetch()}
            onRefresh={() => void query.refetch()}
            isRefreshing={query.isFetching && !query.isLoading}
            keyExtractor={(b) => b.id}
            emptyTitle="No branches"
            emptyBody="Sites added on the web show up here."
            renderItem={({ item }) => {
              const inactive = item.is_active === false || item.status === 'inactive';
              const hours =
                item.opening_time && item.closing_time
                  ? `${item.opening_time}–${item.closing_time}`
                  : null;
              return (
                <RowCard
                  title={item.name}
                  subtitle={[item.address, item.city].filter(Boolean).join(', ') || undefined}
                  meta={[
                    item.code,
                    hours,
                    item.capacity ? `capacity ${item.capacity}` : null,
                  ].filter(Boolean).join(' · ') || undefined}
                  // Same reasoning as the staff list: a row with no number is
                  // not pressable rather than tappable-and-inert.
                  onPress={item.phone ? () => void callNumber(item.phone!) : undefined}
                  chevron={false}
                  trailing={
                    inactive ? (
                      <Badge variant="secondary"><Text>Closed</Text></Badge>
                    ) : (
                      <Badge variant="success"><Text>Open</Text></Badge>
                    )
                  }
                  testID={`branch-${item.id}`}
                />
              );
            }}
          />
        </Can>
      </SafeAreaView>
    </>
  );
}
