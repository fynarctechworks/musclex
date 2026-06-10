import { api } from '../../api/endpoints';
import { uuid } from '../../lib/uuid';
import { queryClient } from '../../lib/query-client';
import { useStepsStore } from './steps-store';
import type { HealthSampleInput } from '../../api/types';

/**
 * Push on-device pedometer steps to the BFF so they flow into the daily health
 * rollups (Home/Health server views, history) alongside wearable data.
 *
 * Append-only-safe: we send only the DELTA since the last push for each day, as a
 * step sample. The server rollup sums same-day step samples, so deltas reconstruct
 * the day's total without double counting; the stable `sourceUuid` + the unique
 * (member,type,source,source_uuid) index make re-sends idempotent. Steps are sent
 * as source `manual` (real device steps, user's own phone, no wearable connection
 * required) — and the rollup's conflict-resolution ranks a real wearable above
 * `manual`, so if the member also syncs a watch, the watch wins (no double count).
 *
 * Only the cursor advances on success, so a failed/offline push just retries next
 * tick. Safe to call frequently — a no-op when there is no new delta.
 */
export async function syncSteps(): Promise<void> {
  const s = useStepsStore.getState();
  if (!s.hydrated) return;

  const pending: { day: string; total: number; input: HealthSampleInput }[] = [];
  for (const [day, totalRaw] of Object.entries(s.byDay)) {
    const total = Math.round(totalRaw);
    const sent = s.syncedByDay[day] ?? 0;
    const delta = total - sent;
    if (delta <= 0) continue;

    // Use noon-local of the day as the sample timestamp so it lands in that day's
    // rollup bucket regardless of timezone; today uses "now".
    const ts = day === s.dayKey ? new Date() : new Date(`${day}T12:00:00`);
    pending.push({
      day,
      total,
      input: {
        type: 'steps',
        value: delta,
        unit: 'count',
        startAt: ts.toISOString(),
        endAt: ts.toISOString(),
        source: 'manual',
        // Unique per delta (sent→total), so re-sends dedupe but new deltas insert.
        sourceUuid: `phone-steps-${day}-${sent}-${total}`,
      },
    });
  }

  if (pending.length === 0) return;

  try {
    await api.ingestHealth(
      pending.map((p) => p.input),
      uuid(),
    );
    const store = useStepsStore.getState();
    for (const p of pending) store.markSynced(p.day, p.total);
    // Refresh server-backed health views (Health screen, summary consumers).
    queryClient.invalidateQueries({ queryKey: ['health', 'summary'] });
  } catch {
    // Leave the cursor; retry on the next foreground / interval tick.
  }
}
