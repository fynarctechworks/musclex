import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { healthBridge } from './provider';
import { syncHealth } from './sync';

/**
 * Auto-sync the OS health store on launch + whenever the app returns to the
 * foreground, so steps / HR / sleep land WITHOUT the member having to open the
 * Health screen and tap "Sync now". Mirrors the offline-outbox foreground drain.
 *
 * Cheap + safe to call unconditionally: `syncHealth()` first checks
 * `healthBridge.isAvailable()` (false on web / Expo Go / no health store) and
 * only POSTs when there are new samples. We invalidate the health-summary query
 * family only when new readings actually arrived, so Home/Activity/Health refresh
 * immediately without a refetch storm.
 */
export function useAutoHealthSync(opts: { enabled?: boolean } = {}) {
  const { enabled = true } = opts;
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const run = async () => {
      if (!(await healthBridge.isAvailable())) return;
      const res = await syncHealth();
      if (!cancelled && res.status === 'synced' && (res.accepted ?? 0) > 0) {
        qc.invalidateQueries({ queryKey: ['health', 'summary'] });
      }
    };

    void run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void run();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [qc, enabled]);
}
