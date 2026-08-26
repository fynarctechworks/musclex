import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { DataList } from '@/ui/DataList';
import { RowCard } from '@/ui/RowCard';
import { Can } from '@/rbac/Gate';
import { useMembershipPlans } from '@/api/queries';
import { useSession } from '@/auth/SessionProvider';
import { formatCurrency } from '@/lib/format';
import { describeDuration, monthlyEquivalent } from '@/lib/plans';
import type { MembershipPlan } from '@/api/types';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBERSHIP PLANS — what the gym sells
 * ────────────────────────────────────────────────────────────────
 *
 * The screen a staffer opens mid-conversation with somebody deciding whether
 * to join, so it answers the question they are actually asked: not just the
 * headline price, but what that works out to per month. A desk comparing a
 * ₹2,400 monthly against a ₹24,000 annual should not be doing division in
 * front of the customer.
 *
 * Read-only: creating and pricing plans is `members.create`/`edit` and belongs
 * with the rest of Phase 10's admin.
 */
export default function Memberships() {
  const { session } = useSession();
  const currency = session?.studio?.currency ?? 'INR';

  const query = useMembershipPlans();
  const plans = query.data ?? [];

  const active = plans.filter((p) => p.is_active !== false);
  const inactive = plans.filter((p) => p.is_active === false);
  // Inactive plans still matter — a member may be ON one — but they must never
  // be offered to somebody joining today, so they sort to the bottom.
  const ordered = [...active, ...inactive];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Membership plans' }} />
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: tokens.background }}>
        <Can module="members">
          <DataList<MembershipPlan>
            data={ordered}
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => void query.refetch()}
            onRefresh={() => void query.refetch()}
            isRefreshing={query.isFetching && !query.isLoading}
            keyExtractor={(p) => p.id}
            emptyTitle="No plans"
            emptyBody="Plans created on the web show up here."
            renderItem={({ item }) => {
              const perMonth = monthlyEquivalent(item);
              const isActive = item.is_active !== false;
              return (
                <RowCard
                  title={item.name}
                  subtitle={item.description ?? undefined}
                  meta={[
                    describeDuration(item),
                    // Only worth saying when it differs from the headline —
                    // repeating "₹2,400 · ₹2,400/mo" on a monthly plan is noise.
                    perMonth && Math.round(perMonth) !== Math.round(Number(item.price))
                      ? `${formatCurrency(Math.round(perMonth), currency)}/mo`
                      : null,
                  ].filter(Boolean).join(' · ')}
                  chevron={false}
                  trailing={
                    <View className="items-end gap-1">
                      <Text className="text-base font-semibold text-foreground">
                        {formatCurrency(item.price, currency)}
                      </Text>
                      {!isActive ? (
                        <Badge variant="secondary"><Text>Retired</Text></Badge>
                      ) : null}
                    </View>
                  }
                  testID={`plan-${item.id}`}
                />
              );
            }}
          />
        </Can>
      </SafeAreaView>
    </>
  );
}
