import React from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loading } from '@/ui/Loading';
import { EmptyState, ErrorState } from '@/ui/States';
import { Sheet } from '@/ui/Sheet';
import { LineChart } from '@/charts';
import { Can } from '@/rbac/Gate';
import { useBodyStats, useMember, useRecordBodyStats } from '@/api/queries';
import { useToast } from '@/ui/Toast';
import { deltaFor, latestWith, seriesFor, toNumber } from '@/lib/progress';
import { formatDate } from '@/lib/format';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER PROGRESS — what a trainer opens mid-session
 * ────────────────────────────────────────────────────────────────
 *
 * Weight carries the chart because it is the number gyms actually record every
 * time; the rest are shown as latest-with-change, which is how a trainer talks
 * about them ("waist is down 3cm since March").
 *
 * A metric with ONE reading shows no change rather than 0.0. Those are
 * different facts, and "0.0" tells a member their training did nothing when
 * the truth is nobody has measured them twice.
 */

const METRICS = [
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'body_fat', label: 'Body fat', unit: '%' },
  { key: 'muscle_mass', label: 'Muscle mass', unit: 'kg' },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'waist', label: 'Waist', unit: 'cm' },
  { key: 'hips', label: 'Hips', unit: 'cm' },
  { key: 'arms', label: 'Arms', unit: 'cm' },
  { key: 'thighs', label: 'Thighs', unit: 'cm' },
] as const;

export default function MemberProgress() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();

  const member = useMember(id);
  const stats = useBodyStats(id);
  const record = useRecordBodyStats(id);

  const [recording, setRecording] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, string>>({});

  const rows = stats.data ?? [];
  const weightSeries = seriesFor(rows, 'weight');

  async function save() {
    // Only fields the trainer actually filled. Sending blanks as 0 would
    // record a member as weighing nothing.
    const values: Record<string, number> = {};
    for (const [k, v] of Object.entries(draft)) {
      const n = toNumber(v);
      if (n !== null) values[k] = n;
    }

    if (Object.keys(values).length === 0) {
      toast.show('Enter at least one measurement', 'error');
      return;
    }

    try {
      await record.mutateAsync(values);
      setDraft({});
      setRecording(false);
      toast.show('Measurements recorded');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Could not save', 'error');
    }
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: member.data?.full_name ?? 'Progress' }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{ padding: 16, gap: 16 }}>
        {stats.isLoading ? (
          <Loading />
        ) : stats.error ? (
          <ErrorState onRetry={() => void stats.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No measurements yet"
            body="Record a first set to start tracking progress."
          />
        ) : (
          <>
            {weightSeries.length >= 2 ? (
              <View className="gap-2 rounded-xl border border-border bg-card p-4">
                <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Weight
                </Text>
                <LineChart values={weightSeries} width={300} height={120} />
                <Text className="text-sm text-muted-foreground">
                  {weightSeries.length} readings · {formatDate(rows[rows.length - 1].recorded_at)} to{' '}
                  {formatDate(rows[0].recorded_at)}
                </Text>
              </View>
            ) : null}

            <View className="gap-2">
              {METRICS.map((m) => {
                const latest = latestWith(rows, m.key);
                if (!latest) return null;
                const value = toNumber(latest[m.key]);
                const delta = deltaFor(rows, m.key);

                return (
                  <View
                    key={m.key}
                    className="flex-row items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                    testID={`metric-${m.key}`}>
                    <View>
                      <Text className="text-base font-medium text-foreground">{m.label}</Text>
                      <Text className="text-xs text-muted-foreground">
                        {formatDate(latest.recorded_at)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-lg font-semibold text-foreground">
                        {value} {m.unit}
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: delta ? deltaTint(m.key, delta.change) : tokens.mutedForeground }}>
                        {delta ? formatDelta(delta.change, m.unit) : 'first reading'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <Can module="members" action="edit">
          <Button onPress={() => setRecording(true)} testID="record-measurements">
            <Text>Record measurements</Text>
          </Button>
        </Can>
      </ScrollView>

      {/* Sibling of the scroll view — a sheet nested inside one renders off-screen. */}
      <Sheet
        open={recording}
        onClose={() => setRecording(false)}
        title="Record measurements"
        snapPoints={['75%']}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Text className="text-sm text-muted-foreground">
            Fill in whatever was measured — blanks are left alone rather than recorded as zero.
          </Text>
          {METRICS.map((m) => (
            <View key={m.key} className="gap-1">
              <Label><Text>{m.label} ({m.unit})</Text></Label>
              <Input
                value={draft[m.key] ?? ''}
                onChangeText={(t) => setDraft((d) => ({ ...d, [m.key]: t.replace(/[^0-9.]/g, '') }))}
                keyboardType="decimal-pad"
                placeholder="—"
                testID={`input-${m.key}`}
              />
            </View>
          ))}
          <Button onPress={save} disabled={record.isPending} testID="save-measurements">
            <Text>{record.isPending ? 'Saving…' : 'Save'}</Text>
          </Button>
        </ScrollView>
      </Sheet>
    </>
  );
}

/**
 * Down is good for some measures and bad for others, so the tint follows the
 * METRIC rather than the sign. Colouring every decrease green would congratulate
 * a member on losing muscle.
 */
const LOWER_IS_BETTER = new Set(['weight', 'body_fat', 'waist', 'hips']);

function deltaTint(metric: string, change: number): string {
  if (change === 0) return tokens.mutedForeground;
  const good = LOWER_IS_BETTER.has(metric) ? change < 0 : change > 0;
  return good ? tokens.success : tokens.mutedForeground;
}

function formatDelta(change: number, unit: string): string {
  const rounded = Math.round(change * 10) / 10;
  if (rounded === 0) return `no change`;
  return `${rounded > 0 ? '+' : ''}${rounded} ${unit}`;
}
