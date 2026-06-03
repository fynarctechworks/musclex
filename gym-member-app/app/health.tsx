import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  ListRow,
  Screen,
  SkeletonCard,
  Txt,
} from '../src/design-system';
import { BackButton } from '../src/navigation/BackButton';
import { track } from '../src/analytics';
import {
  useHealthSummary,
  useWearableConnections,
  useConnectWearable,
  useRevokeWearable,
  useLogHealthSample,
} from '../src/api/queries';
import { ActivityRingsCard } from '../src/features/home/ActivityRingsCard';
import { MetricTrendCard } from '../src/features/health/MetricTrendCard';
import { healthBridge } from '../src/features/health/provider';
import { syncHealth, resetHealthCursor } from '../src/features/health/sync';
import { PROVIDER_LABELS } from '../src/features/health/metrics';
import { uuid } from '../src/lib/uuid';
import type { WearableConnection, WearableProvider } from '../src/api/types';

/** Which metric cards deep-link to a dedicated detail screen. */
const DETAIL_ROUTE: Partial<Record<string, '/sleep' | '/heart' | '/body'>> = {
  sleep_duration: '/sleep',
  heart_rate: '/heart',
  hr_resting: '/heart',
  hrv: '/heart',
  spo2: '/heart',
  body_weight: '/body',
  body_fat: '/body',
  vo2max: '/body',
};

function fmtDate(iso?: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function HealthScreen() {
  const router = useRouter();
  const summary = useHealthSummary();
  const connections = useWearableConnections();
  const connect = useConnectWearable();
  const revoke = useRevokeWearable();
  const logSample = useLogHealthSample();

  const [available, setAvailable] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [weight, setWeight] = useState('');

  const nativeProvider = healthBridge.provider as WearableProvider | null;

  useEffect(() => {
    track({ name: 'health_viewed' });
    healthBridge.isAvailable().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  const connected = (connections.data?.connections ?? []).filter(
    (c) => c.status === 'connected',
  );

  async function handleConnect() {
    if (!nativeProvider) return;
    const granted = await healthBridge.requestPermissions();
    if (!granted) {
      setSyncMsg('Permission was not granted on the device.');
      return;
    }
    await connect.mutateAsync({ provider: nativeProvider });
    track({ name: 'wearable_connected', provider: nativeProvider });
    await handleSync();
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    const res = await syncHealth();
    setSyncing(false);
    if (res.status === 'synced') {
      track({ name: 'health_synced', accepted: res.accepted ?? 0 });
      setSyncMsg(`Synced ${res.accepted ?? 0} new readings.`);
      summary.refetch();
    } else if (res.status === 'no-data') {
      setSyncMsg('Up to date — no new readings.');
    } else if (res.status === 'unavailable') {
      setSyncMsg('No health store available on this device.');
    } else {
      setSyncMsg(res.error ?? 'Sync failed.');
    }
  }

  async function handleRevoke(provider: string) {
    await revoke.mutateAsync(provider);
    track({ name: 'wearable_revoked', provider });
    await resetHealthCursor();
  }

  async function handleLogWeight() {
    const kg = parseFloat(weight);
    if (!Number.isFinite(kg) || kg <= 0) return;
    const now = new Date().toISOString();
    await logSample.mutateAsync({
      type: 'body_weight',
      value: kg,
      unit: 'kg',
      startAt: now,
      endAt: now,
      source: 'manual',
      sourceUuid: uuid(),
    });
    track({ name: 'health_manual_logged', metric: 'body_weight' });
    setWeight('');
    summary.refetch();
  }

  if (summary.isLoading) {
    return (
      <Screen scroll>
        <BackButton />
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  if (summary.isError) {
    return (
      <Screen>
        <BackButton />
        <ErrorState onRetry={() => summary.refetch()} />
      </Screen>
    );
  }

  const metrics = summary.data?.metrics ?? [];

  return (
    <Screen scroll onRefresh={() => summary.refetch()} refreshing={summary.isFetching}>
      <BackButton />
      <Txt variant="display-md" weight="600" className="mb-xs text-ink">
        Health
      </Txt>
      <Txt variant="body-sm" className="mb-lg text-mute">
        Your last 7 days, synced from your wearable and manual logs.
      </Txt>

      {/* ── Today's activity rings (renders only with real data) ── */}
      <View className="mb-lg">
        <ActivityRingsCard />
      </View>

      {/* ── Wellness tools ── */}
      <Card noPadding className="mb-lg">
        <ListRow
          label="Activity"
          value="Steps & movement"
          onPress={() => router.push('/activity')}
        />
        <ListRow
          label="Breathe"
          value="4-7-8 session"
          onPress={() => router.push('/mindfulness')}
          last
        />
      </Card>

      {/* ── Wearable connection ── */}
      <Card className="mb-lg">
        <Txt variant="caption" className="text-mute">
          CONNECTED DEVICES
        </Txt>

        {connected.length > 0 ? (
          connected.map((c: WearableConnection) => (
            <View
              key={c.provider}
              className="mt-sm flex-row items-center justify-between"
            >
              <View>
                <Txt variant="body-md" weight="500" className="text-ink">
                  {PROVIDER_LABELS[c.provider ?? ''] ?? c.provider}
                </Txt>
                <Txt variant="caption" className="text-mute">
                  Last sync {fmtDate(c.lastSyncedAt)}
                </Txt>
              </View>
              <Button
                title="Disconnect"
                variant="ghost"
                onPress={() => handleRevoke(c.provider!)}
                loading={revoke.isPending}
              />
            </View>
          ))
        ) : (
          <Txt variant="body-sm" className="mt-xs text-mute">
            No device connected yet.
          </Txt>
        )}

        <View className="mt-md gap-sm">
          {available && nativeProvider ? (
            <Button
              title={
                connected.some((c) => c.provider === nativeProvider)
                  ? 'Sync now'
                  : `Connect ${PROVIDER_LABELS[nativeProvider]}`
              }
              onPress={
                connected.some((c) => c.provider === nativeProvider)
                  ? handleSync
                  : handleConnect
              }
              loading={connect.isPending || syncing}
            />
          ) : (
            <Txt variant="caption" className="text-mute">
              {available === null
                ? 'Checking for a health store…'
                : 'Wearable sync needs the native app build (Apple Health / Health Connect). You can still log manually below.'}
            </Txt>
          )}
          {syncMsg ? (
            <Txt variant="caption" className="text-mute">
              {syncMsg}
            </Txt>
          ) : null}
        </View>
      </Card>

      {/* ── Manual entry ── */}
      <Card className="mb-lg">
        <Txt variant="caption" className="mb-sm text-mute">
          LOG MANUALLY
        </Txt>
        <View className="flex-row items-end gap-sm">
          <View className="flex-1">
            <Input
              label="Weight (kg)"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="e.g. 72.5"
            />
          </View>
          <Button
            title="Save"
            onPress={handleLogWeight}
            loading={logSample.isPending}
          />
        </View>
      </Card>

      {/* ── Metric trends ── */}
      {metrics.length > 0 ? (
        metrics.map((m) => {
          const route = m.type ? DETAIL_ROUTE[m.type] : undefined;
          return (
            <MetricTrendCard
              key={m.type}
              series={m}
              onPress={route ? () => router.push(route) : undefined}
            />
          );
        })
      ) : (
        <EmptyState
          icon="heart"
          title="No health data yet"
          message="Connect a wearable or log a reading to see your trends here."
        />
      )}
    </Screen>
  );
}
