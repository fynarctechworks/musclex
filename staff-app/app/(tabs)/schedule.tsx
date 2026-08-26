import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { RowCard } from '@/ui/RowCard';
import { EmptyState, ErrorState } from '@/ui/States';
import { Loading } from '@/ui/Loading';
import { ScheduleCalendar, type DayMark } from '@/ui/ScheduleCalendar';
import { Meter } from '@/ui/Meter';
import { groupSessionsByDay, useSessionsInMonth } from '@/api/queries';
import { formatDate, formatTime, toLocalISODate } from '@/lib/format';
import type { ClassSession } from '@/api/types';
import { tokens } from '@/ui/tokens';

/**
 * Schedule — a day's classes, picked from a month calendar.
 *
 * Day-first rather than week-first: on a phone a week grid becomes unreadable,
 * and the question staff actually ask is "what is on today / on this day".
 */
export default function Schedule() {
  const [day, setDay] = React.useState(() => new Date());
  // The month being LOOKED at, which is not always the month of the selected
  // day — paging ahead should load that month without moving the selection.
  const [month, setMonth] = React.useState(() => new Date());

  const query = useSessionsInMonth(month);
  const byDay = React.useMemo(() => groupSessionsByDay(query.data ?? []), [query.data]);
  const sessions = byDay[toLocalISODate(day)] ?? [];

  // Every day in the fetched month that has classes, not just the selected
  // one — which is what the caption under the calendar has always claimed.
  const marks: DayMark[] = React.useMemo(
    () => Object.entries(byDay).map(([date, list]) => ({ date, count: list.length })),
    [byDay],
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Text className="text-2xl font-semibold text-foreground">Schedule</Text>

        <ScheduleCalendar selected={day} onSelect={setDay} onMonthChange={setMonth} marks={marks} />

        <View className="gap-2">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {formatDate(day)}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {sessions.length} {sessions.length === 1 ? 'class' : 'classes'}
            </Text>
          </View>

          {query.isLoading ? (
            <Loading />
          ) : query.error ? (
            <ErrorState onRetry={() => void query.refetch()} />
          ) : sessions.length === 0 ? (
            <EmptyState title="No classes" body="Nothing scheduled for this day." />
          ) : (
            <View className="gap-2">
              {[...sessions]
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map((s) => <SessionRow key={s.id} session={s} />)}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SessionRow({ session }: { session: ClassSession }) {
  const enrolled = session.enrolled_count ?? 0;
  const full = enrolled >= session.capacity;

  return (
    <Pressable
      onPress={() => router.push(`/class/${session.id}`)}
      className="gap-2 rounded-lg border border-border bg-card px-4 py-3"
      testID={`session-${session.id}`}>
      <View className="flex-row items-center gap-3">
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-base font-medium text-foreground">
            {session.name}
          </Text>
          <Text numberOfLines={1} className="text-sm text-muted-foreground">
            {formatTime(session.start_time)} – {formatTime(session.end_time)}
            {session.trainer?.full_name ? ` · ${session.trainer.full_name}` : ''}
          </Text>
        </View>
        <Badge variant={session.status === 'completed' ? 'secondary' : full ? 'warning' : 'success'}>
          <Text>{session.status === 'completed' ? 'Done' : full ? 'Full' : 'Open'}</Text>
        </Badge>
      </View>

      {/* Capacity at a glance — the thing staff check before letting someone in. */}
      <View className="gap-1">
        <Meter value={enrolled} max={session.capacity} tint={full ? '#f5a623' : tokens.foreground} />
        <Text className="text-xs text-muted-foreground">
          {enrolled} of {session.capacity} booked
          {session.waitlist_count ? ` · ${session.waitlist_count} waiting` : ''}
        </Text>
      </View>
    </Pressable>
  );
}
