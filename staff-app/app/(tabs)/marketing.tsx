import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataList } from '@/ui/DataList';
import { RowCard } from '@/ui/RowCard';
import { StatTile } from '@/ui/StatTile';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Can } from '@/rbac/Gate';
import { useLeadFunnel, useLeads, useUpdateLeadStatus } from '@/api/queries';
import { useToast } from '@/ui/Toast';
import { initialsOf } from '@/features/MemberRow';
import { callNumber } from '@/lib/contact';
import { formatRelative, titleiseSlug } from '@/lib/format';
import { describeLeadStatus, leadVariant, nextStatus } from '@/lib/leads';
import type { Lead } from '@/api/types';
import { TabBackRow } from '@/ui/TabBackRow';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * MARKETING — the leads worth chasing
 * ────────────────────────────────────────────────────────────────
 *
 * Leads, not campaigns. A campaign is authored at a desk — audiences, copy,
 * scheduling — while a LEAD is chased on a phone between other jobs, which is
 * what this device is for. Campaign management stays on the web.
 *
 * The default view is "Open": new and contacted. A list that leads with the
 * ones already converted or lost is a report, and this is a work queue.
 */
type Filter = 'open' | 'new' | 'contacted' | 'trial_scheduled' | 'converted' | 'lost';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'trial_scheduled', label: 'Trials' },
  { value: 'converted', label: 'Joined' },
  { value: 'lost', label: 'Lost' },
];

export default function Marketing() {
  const toast = useToast();
  const [filter, setFilter] = React.useState<Filter>('open');

  // "Open" is not a server status — it is new + contacted, so it is fetched
  // unfiltered and narrowed here. Every other filter is sent to the server.
  const serverStatus = filter === 'open' ? undefined : filter;
  const query = useLeads({ status: serverStatus, limit: 100 });
  const funnel = useLeadFunnel();
  const advance = useUpdateLeadStatus();

  const all = query.data?.data ?? [];
  const rows = filter === 'open'
    ? all.filter((l) => !l.status || l.status === 'new' || l.status === 'contacted')
    : all;

  async function moveOn(lead: Lead) {
    const next = nextStatus(lead.status);
    if (!next) return;
    try {
      await advance.mutateAsync({ id: lead.id, status: next });
      toast.show(`${lead.full_name} → ${describeLeadStatus(next)}`);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Could not update', 'error');
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Leads' }} />
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: tokens.background }}>
        <Can module="marketing">
          <View className="gap-3 px-4 pb-3 pt-3">
            <TabBackRow tab="marketing" />
            {funnel.data ? (
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <StatTile label="Leads" value={String(funnel.data.total_leads)} hint="all time" />
                </View>
                <View className="flex-1">
                  <StatTile
                    label="Conversion"
                    value={`${Math.round(funnel.data.conversion_rate)}%`}
                    hint={`${funnel.data.by_status?.converted ?? 0} joined`}
                  />
                </View>
              </View>
            ) : null}

            <SegmentedControl
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              segments={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
              testID="leads-filter"
            />
          </View>

          <DataList<Lead>
            data={rows}
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => void query.refetch()}
            onRefresh={() => { void query.refetch(); void funnel.refetch(); }}
            isRefreshing={query.isFetching && !query.isLoading}
            keyExtractor={(l) => l.id}
            emptyTitle={filter === 'open' ? 'Nothing to chase' : 'No leads'}
            emptyBody={
              filter === 'open'
                ? 'Every lead has been contacted or closed.'
                : 'Leads captured on the web or the join page show up here.'
            }
            renderItem={({ item }) => {
              const next = nextStatus(item.status);
              return (
                <View className="gap-2">
                  <RowCard
                    initials={initialsOf(item.full_name)}
                    title={item.full_name}
                    subtitle={titleiseSlug(item.lead_source, 'Unknown source')}
                    meta={item.created_at ? formatRelative(item.created_at) : undefined}
                    chevron={false}
                    // Calling is the job. A lead with no number is not
                    // pressable rather than tappable-and-inert.
                    onPress={item.phone ? () => void callNumber(item.phone!) : undefined}
                    trailing={
                      <Badge variant={leadVariant(item.status)}>
                        <Text>{describeLeadStatus(item.status)}</Text>
                      </Badge>
                    }
                    testID={`lead-${item.id}`}
                  />

                  {/* Only ever the NEXT step. 'Joined' is absent by design —
                      it needs the convert endpoint that creates the member. */}
                  {next ? (
                    <Can module="marketing" action="edit">
                      <View className="px-1 pb-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={advance.isPending}
                          onPress={() => void moveOn(item)}
                          testID={`lead-advance-${item.id}`}>
                          <Text>Mark {describeLeadStatus(next).toLowerCase()}</Text>
                        </Button>
                      </View>
                    </Can>
                  ) : null}
                </View>
              );
            }}
          />
        </Can>
      </SafeAreaView>
    </>
  );
}
