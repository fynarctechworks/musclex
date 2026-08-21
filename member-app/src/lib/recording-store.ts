import { Platform } from 'react-native';
import type { RecordState } from './recorder';

/**
 * ────────────────────────────────────────────────────────────────
 * RECORDING PERSISTENCE — a run must survive the app dying
 * ────────────────────────────────────────────────────────────────
 *
 * An in-progress recording lived only in React state. That is fine until iOS
 * or Android reclaims a backgrounded app — which they do, routinely, to a
 * process holding GPS — and then somebody's hour-long run is simply gone.
 * There is no worse failure mode a tracker has: it is not a feature that broke,
 * it is work that cannot be redone.
 *
 * Proven, not theorised: a cold launch during testing destroyed a two-minute
 * recording that had 66 fixes in it.
 *
 * Deliberately its own store rather than the outbox. The outbox FLUSHES what
 * it holds to the server, and a half-finished recording is precisely the thing
 * that must not be sent anywhere until the member presses Finish.
 *
 * Same three-backend shape as the outbox, for the same reasons: SQLite where
 * it is durable, localStorage on web, memory when neither loads — because
 * storage failing must never stop somebody recording.
 */

const KEY = 'musclex.recording.v1';
/** Older than this and it is not a recording anyone still wants resumed. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface SavedRecording {
  sport: string;
  savedAt: number;
  state: RecordState;
}

interface Slot {
  read(): Promise<SavedRecording | null>;
  write(value: SavedRecording): Promise<void>;
  clear(): Promise<void>;
}

function memorySlot(): Slot {
  let held: SavedRecording | null = null;
  return {
    async read() {
      return held;
    },
    async write(v) {
      held = v;
    },
    async clear() {
      held = null;
    },
  };
}

function webSlot(): Slot {
  return {
    async read() {
      try {
        const raw = globalThis.localStorage?.getItem(KEY);
        return raw ? (JSON.parse(raw) as SavedRecording) : null;
      } catch {
        return null;
      }
    },
    async write(v) {
      try {
        globalThis.localStorage?.setItem(KEY, JSON.stringify(v));
      } catch {
        /* quota or private mode — the recording still runs in memory */
      }
    },
    async clear() {
      try {
        globalThis.localStorage?.removeItem(KEY);
      } catch {
        /* nothing to do */
      }
    },
  };
}

async function sqliteSlot(): Promise<Slot> {
  const SQLite = await import('expo-sqlite');
  const d = await SQLite.openDatabaseAsync('musclex.db');
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS recording (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return {
    async read() {
      const row = await d.getFirstAsync<{ value: string }>(
        'SELECT value FROM recording WHERE key = ?',
        KEY,
      );
      if (!row) return null;
      try {
        return JSON.parse(row.value) as SavedRecording;
      } catch {
        return null;
      }
    },
    async write(v) {
      await d.runAsync(
        'INSERT OR REPLACE INTO recording (key, value) VALUES (?, ?)',
        KEY,
        JSON.stringify(v),
      );
    },
    async clear() {
      await d.runAsync('DELETE FROM recording WHERE key = ?', KEY);
    },
  };
}

let slot: Promise<Slot> | null = null;

function open(): Promise<Slot> {
  if (slot) return slot;
  slot = (async () => {
    if (Platform.OS === 'web') return webSlot();
    try {
      return await sqliteSlot();
    } catch {
      return memorySlot();
    }
  })();
  return slot;
}

/**
 * Save the recording so far.
 *
 * Failure is swallowed on purpose: a write that could not happen must not
 * interrupt a run in progress. The next tick tries again.
 */
export async function saveRecording(sport: string, state: RecordState): Promise<void> {
  try {
    (await open()).write({ sport, savedAt: Date.now(), state });
  } catch {
    /* the recording continues regardless */
  }
}

/**
 * A recording left behind by an app that died, if there is one worth resuming.
 *
 * Anything older than a day, or with no points, is dropped rather than offered
 * — being asked to resume a run from last week is noise.
 */
export async function loadRecording(): Promise<SavedRecording | null> {
  try {
    const saved = await (await open()).read();
    if (!saved) return null;
    if (Date.now() - saved.savedAt > MAX_AGE_MS) {
      await clearRecording();
      return null;
    }
    if (!saved.state?.points?.length) return null;
    return saved;
  } catch {
    return null;
  }
}

export async function clearRecording(): Promise<void> {
  try {
    await (await open()).clear();
  } catch {
    /* nothing to do */
  }
}
