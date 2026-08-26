import React from 'react';
import { View } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataList } from '@/ui/DataList';
import { RowCard } from '@/ui/RowCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Can } from '@/rbac/Gate';
import { useCurrentStaff, usePtSessions, useUpdatePtSession } from '@/api/queries';
import { useSession } from '@/auth/SessionProvider';
import { useToast } from '@/ui/Toast';
import { initialsOf } from '@/features/MemberRow';
import { formatDate, formatTime } from '@/lib/format';
import { describePtType, ptStatusVariant } from '@/lib/pt';
import type { TrainerSession } from '@/api/types';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * PT SESSIONS — one-to-one work, and who it belongs to
 * ────────────────────────────────────────────────────────────────
 *
 * A trainer signing in wants THEIR sessions, not the gym's. But the session
 * only carries the auth user id, and `trainer_id` is the staff row id — a
 * different column. Passing the wrong one makes the API answer "Trainer not
 * found", so the staff row is resolved first (the same lookup POS needed).
 *
 * Mine-vs-everyone is a real toggle rather than a hidden default, because a
 * manager opening this screen wants the opposite of what a trainer wants and
 * neither should have to guess which they are looking at.
 */

const FILTERS = [
  { value: 'scheduled', label: 'Upcoming' },
  { value: 'completed', label: 'Done' },
  { value: '', label: 'All' },
] as const;

export default function PtSessions() {
  const { session } = useSession();
  const toast = useToast();

  const staff = useCurrentStaff(session?.user?.id);
  const isTrainer = session?.user?.role === 'trainer';

  const [status, setStatus] = React.useState<string>('scheduled');
  // A trainer starts on their own list; anyone else starts on the gym's.
  const [mineOnly, setMineOnly] = React.useState(isTrainer);

  const trainerId = mineOnly ? staff.data?.id : undefined;
  // Hold the request until the staff row resolves. Asking for "mine" with no
  // trainer_id would quietly return the whole gym's sessions labelled as mine.
  const waitingForStaff = mineOnly && !staff.data;

  const query = usePtSessions({
    trainerId,
    status: status || undefined,
    enabled: !waitingForStaff,
  });
  const update = useUpdatePtSession();

  const sessions = waitingForStaff ? [] : (query.data?.data ?? []);

  async function setOutcome(item: TrainerSession, next: string) {
    try {
      await update.mutateAsync({ id: item.id, status: next });
      toast.show(
        next === 'completed'
          ? `Session with ${item.member?.full_name ?? 'member'} completed`
          : `Session marked ${next.replace(/_/g, ' ')}`,
      );
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Could not update', 'error');
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'PT sessions' }} />
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: tokens.background }}>
        <View className="gap-3 px-4 pb-3 pt-3">
          <SegmentedControl
            value={status}
            onChange={setStatus}
            segments={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
            testID="pt-status-filter"
          />
          {staff.data ? (
            <SegmentedControl
              value={mineOnly ? 'mine' : 'all'}
              onChange={(v) => setMineOnly(v === 'mine')}
              segments={[
                { value: 'mine', label: 'Mine' },
                { value: 'all', label: 'Everyone' },
              ]}
              testID="pt-scope-filter"
            />
          ) : null}
        </View>

        <DataList<TrainerSession>
          data={sessions}
          isLoading={query.isLoading || waitingForStaff}
          error={query.error}
          onRetry={() => void query.refetch()}
          onRefresh={() => void query.refetch()}
          isRefreshing={query.isFetching && !query.isLoading}
          keyExtractor={(x) => x.id}
          emptyTitle={mineOnly ? 'No sessions of yours' : 'No PT sessions'}
          emptyBody={
            status === 'scheduled'
              ? 'Nothing booked. Sessions booked on the web show up here.'
              : 'Nothing to show for this filter.'
          }
          renderItem={({ item }) => (
            <View className="gap-2">
              <RowCard
                initials={initialsOf(item.member?.full_name ?? '?')}
                title={item.member?.full_name ?? 'Member'}
                subtitle={`${formatDate(item.session_date)} · ${formatTime(item.session_date)} · ${item.session_duration} min`}
                meta={describePtType(item.session_type)}
                chevron={false}
                onPress={
                  item.member_id ? () => router.push(`/member/${item.member_id}`) : undefined
                }
                trailing={
                  <Badge variant={ptStatusVariant(item.status)}>
                    <Text>{item.status.replace(/_/g, ' ')}</Text>
                  </Badge>
                }
                testID={`pt-${item.id}`}
              />

              {/* Completing a session books trainer revenue and commission, so
                  it sits behind staff.edit — a trainer has staff.view only. */}
              {item.status === 'scheduled' ? (
                <Can module="staff" action="edit">
                  <View className="flex-row gap-2 px-1 pb-1">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={update.isPending}
                      onPress={() => void setOutcome(item, 'completed')}
                      testID={`pt-complete-${item.id}`}>
                      <Text>Completed</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={update.isPending}
                      onPress={() => void setOutcome(item, 'no_show')}
                      testID={`pt-noshow-${item.id}`}>
                      <Text>No show</Text>
                    </Button>
                  </View>
                </Can>
              ) : null}
            </View>
          )}
        />
      </SafeAreaView>
    </>
  );
}
