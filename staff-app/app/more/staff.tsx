import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataList } from '@/ui/DataList';
import { RowCard } from '@/ui/RowCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Can } from '@/rbac/Gate';
import { useStaff } from '@/api/queries';
import { initialsOf } from '@/features/MemberRow';
import { callNumber } from '@/lib/contact';
import { titleiseSlug } from '@/lib/format';
import type { StaffRow } from '@/api/types';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * STAFF — who works here
 * ────────────────────────────────────────────────────────────────
 *
 * Read-only. Hiring, editing and payroll are `staff.create`/`edit` and belong
 * to Phase 11; this is the list a manager checks on the floor — who is on the
 * team, what they do, and how to reach them.
 *
 * SALARY IS NEVER SHOWN, even to an owner who is entitled to receive it.
 * `StripSecretsInterceptor` sends it only to owner/brand_owner, and a manager
 * glancing at a shared phone in a staff room should not be the way a gym's pay
 * scale gets around. Payroll is its own permissioned screen, later.
 */
export default function Staff() {
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [onlyActive, setOnlyActive] = React.useState(true);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useStaff();
  const all = query.data?.data ?? [];

  const rows = React.useMemo(() => {
    return all
      .filter((s) => (onlyActive ? s.is_active !== false && s.status !== 'inactive' : true))
      .filter((s) =>
        !debounced ||
        s.full_name.toLowerCase().includes(debounced) ||
        (s.role ?? '').toLowerCase().includes(debounced) ||
        (s.employee_code ?? '').toLowerCase().includes(debounced));
  }, [all, debounced, onlyActive]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Staff' }} />
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: tokens.background }}>
        <Can module="staff">
          <View className="gap-3 px-4 pb-3 pt-3">
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search name, role or code"
              autoCapitalize="none"
              testID="staff-search"
            />
            <SegmentedControl
              value={onlyActive ? 'active' : 'all'}
              onChange={(v) => setOnlyActive(v === 'active')}
              segments={[
                { value: 'active', label: 'Active' },
                { value: 'all', label: 'Everyone' },
              ]}
              testID="staff-filter"
            />
          </View>

          <DataList<StaffRow>
            data={rows}
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => void query.refetch()}
            onRefresh={() => void query.refetch()}
            isRefreshing={query.isFetching && !query.isLoading}
            keyExtractor={(s) => s.id}
            emptyTitle="No staff"
            emptyBody={
              debounced ? `Nothing matched “${debounced}”.` : 'Staff added on the web appear here.'
            }
            renderItem={({ item }) => (
              <RowCard
                initials={initialsOf(item.full_name)}
                title={item.full_name}
                subtitle={[titleiseSlug(item.role), item.employee_code]
                  .filter(Boolean).join(' · ') || undefined}
                meta={item.branch?.name ?? undefined}
                chevron={false}
                // Tapping calls: on a gym floor the reason you opened this list
                // is almost always to reach the person, not to read about them.
                // A row with no number is deliberately not pressable, so it
                // does not look tappable and then do nothing.
                onPress={item.phone ? () => void callNumber(item.phone!) : undefined}
                trailing={
                  item.is_active === false || item.status === 'inactive' ? (
                    <Badge variant="secondary"><Text>Inactive</Text></Badge>
                  ) : (
                    <Badge variant="success"><Text>Active</Text></Badge>
                  )
                }
                testID={`staff-${item.id}`}
              />
            )}
          />
        </Can>
      </SafeAreaView>
    </>
  );
}
