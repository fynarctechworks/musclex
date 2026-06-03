import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../api/endpoints';
import { uuid } from '../../lib/uuid';
import { healthBridge } from './provider';
import type { HealthIngestResult } from '../../api/types';

const CURSOR_KEY = 'health:lastSyncAt';
/** First sync pulls a bounded backfill window rather than all history. */
const BACKFILL_DAYS = 30;
const MAX_BATCH = 1000;

export interface SyncOutcome {
  status: 'synced' | 'unavailable' | 'no-data' | 'error';
  accepted?: number;
  duplicates?: number;
  error?: string;
}

async function getCursor(): Promise<Date> {
  const raw = await AsyncStorage.getItem(CURSOR_KEY);
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(Date.now() - BACKFILL_DAYS * 86_400_000);
}

/**
 * Pull new samples from the OS health store and push them to the BFF.
 *
 * Idempotent end-to-end: the cursor only advances on a successful ingest, and
 * the server dedupes on (type, source, sourceUuid) — so a crash mid-sync or a
 * re-run just re-sends, never double-counts. Safe to call on app focus.
 */
export async function syncHealth(): Promise<SyncOutcome> {
  try {
    if (!(await healthBridge.isAvailable())) {
      return { status: 'unavailable' };
    }

    const since = await getCursor();
    const startedAt = new Date();
    const samples = await healthBridge.readSamples(since);

    if (samples.length === 0) {
      await AsyncStorage.setItem(CURSOR_KEY, startedAt.toISOString());
      return { status: 'no-data' };
    }

    let accepted = 0;
    let duplicates = 0;
    for (let i = 0; i < samples.length; i += MAX_BATCH) {
      const batch = samples.slice(i, i + MAX_BATCH);
      const res: HealthIngestResult = await api.ingestHealth(batch, uuid());
      accepted += res.accepted ?? 0;
      duplicates += res.duplicates ?? 0;
    }

    // Advance the cursor only after every batch landed.
    await AsyncStorage.setItem(CURSOR_KEY, startedAt.toISOString());
    return { status: 'synced', accepted, duplicates };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'Health sync failed',
    };
  }
}

/** Clear the sync cursor (e.g. on logout or when a provider is revoked). */
export async function resetHealthCursor(): Promise<void> {
  await AsyncStorage.removeItem(CURSOR_KEY);
}

/** Does this build have a usable OS health store? */
export function healthProvider() {
  return healthBridge.provider;
}
