import React from 'react';
import { View } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Can } from '@/rbac/Gate';
import { Input } from '@/components/ui/input';
import { DataList } from '@/ui/DataList';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { MemberRow } from '@/features/MemberRow';
import { useMembers } from '@/api/queries';
import type { Member } from '@/api/types';
import { tokens } from '@/ui/tokens';

type Filter = 'all' | 'active' | 'inactive';

/**
 * Members list — the first screen backed by live data.
 *
 * Search and status are sent to the API rather than filtered client-side: a
 * large gym has thousands of members and only the first page is in memory, so
 * filtering locally would silently search one page and report "not found".
 */
export default function Members() {
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<Filter>('all');
  const [debounced, setDebounced] = React.useState('');

  // Debounced so typing does not fire a request per keystroke.
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useMembers({
    search: debounced || undefined,
    status: filter === 'all' ? undefined : filter,
    limit: 20,
  });

  const members = query.data?.data ?? [];
  const total = query.data?.total ?? 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <View className="gap-3 px-4 pb-3 pt-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-baseline gap-2">
            <Text className="text-2xl font-semibold text-foreground">Members</Text>
            {query.isSuccess ? (
              <Text className="text-sm text-muted-foreground">{total}</Text>
            ) : null}
          </View>
          {/* Adding a member needs members.create — a trainer can view but not add. */}
          <Can module="members" action="create">
            <Link href="/member/new" asChild>
              <Button size="sm" variant="outline" testID="members-add">
                <Text>Add</Text>
              </Button>
            </Link>
          </Can>
        </View>

        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, phone or code"
          autoCapitalize="none"
          testID="members-search"
        />

        <SegmentedControl
          value={filter}
          onChange={setFilter}
          segments={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </View>

      <DataList<Member>
        data={members}
        isLoading={query.isLoading}
        isRefreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        error={query.error}
        dataUpdatedAt={query.dataUpdatedAt}
        onRetry={() => void query.refetch()}
        keyExtractor={(m) => m.id}
        emptyTitle={debounced ? 'No matches' : 'No members yet'}
        emptyBody={
          debounced
            ? `Nothing matched “${debounced}”.`
            : 'Members added on the web or at the desk will appear here.'
        }
        renderItem={({ item }) => (
          <MemberRow
            member={item}
            onPress={() => router.push(`/member/${item.id}`)}
          />
        )}
      />
    </SafeAreaView>
  );
}
