import { Platform } from 'react-native';

/**
 * ────────────────────────────────────────────────────────────────
 * OUTBOX STORAGE
 * ────────────────────────────────────────────────────────────────
 *
 * Three backends, chosen by what actually works where:
 *
 *   native → SQLite (durable, survives force-quit)
 *   web    → localStorage (durable enough for a preview target)
 *   either → in-memory, if the above fails
 *
 * The fallback matters more than it looks. expo-sqlite loads its WASM lazily on
 * web, so the FIRST outbox write while offline could never open the database
 * and the caller hung forever on a spinner. Storage failing must degrade the
 * durability guarantee, never block the member from finishing a workout.
 */

export interface StoredItem {
  key: string;
  kind: string;
  payload: unknown;
  createdAt: number;
  attempts: number;
}

interface Backend {
  all(): Promise<StoredItem[]>;
  put(item: StoredItem): Promise<void>;
  remove(key: string): Promise<void>;
}

/* ── in-memory (last resort) ──────────────────────────────────── */

function memoryBackend(): Backend {
  const map = new Map<string, StoredItem>();
  return {
    async all() {
      return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
    },
    async put(item) {
      map.set(item.key, item);
    },
    async remove(key) {
      map.delete(key);
    },
  };
}

/* ── web: localStorage ────────────────────────────────────────── */

const WEB_KEY = 'musclex.outbox';

function webBackend(): Backend {
  const read = (): StoredItem[] => {
    try {
      return JSON.parse(globalThis.localStorage?.getItem(WEB_KEY) ?? '[]');
    } catch {
      return [];
    }
  };
  const save = (items: StoredItem[]) => {
    try {
      globalThis.localStorage?.setItem(WEB_KEY, JSON.stringify(items));
    } catch {
      /* quota or private mode: the in-flight send still happens */
    }
  };
  return {
    async all() {
      return read().sort((a, b) => a.createdAt - b.createdAt);
    },
    async put(item) {
      save([...read().filter((i) => i.key !== item.key), item]);
    },
    async remove(key) {
      save(read().filter((i) => i.key !== key));
    },
  };
}

/* ── native: SQLite ───────────────────────────────────────────── */

async function sqliteBackend(): Promise<Backend> {
  const SQLite = await import('expo-sqlite');
  const d = await SQLite.openDatabaseAsync('musclex.db');
  await d.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS outbox (
      key        TEXT PRIMARY KEY,
      kind       TEXT NOT NULL,
      payload    TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      attempts   INTEGER NOT NULL DEFAULT 0
    );
  `);
  return {
    async all() {
      const rows = await d.getAllAsync<{
        key: string;
        kind: string;
        payload: string;
        created_at: number;
        attempts: number;
      }>('SELECT * FROM outbox ORDER BY created_at ASC');
      return rows.map((r) => ({
        key: r.key,
        kind: r.kind,
        payload: JSON.parse(r.payload),
        createdAt: r.created_at,
        attempts: r.attempts,
      }));
    },
    async put(item) {
      await d.runAsync(
        'INSERT OR REPLACE INTO outbox (key, kind, payload, created_at, attempts) VALUES (?, ?, ?, ?, ?)',
        item.key,
        item.kind,
        JSON.stringify(item.payload),
        item.createdAt,
        item.attempts,
      );
    },
    async remove(key) {
      await d.runAsync('DELETE FROM outbox WHERE key = ?', key);
    },
  };
}

/* ── resolution ───────────────────────────────────────────────── */

let backend: Backend | null = null;
let opening: Promise<Backend> | null = null;

/** Never rejects and never hangs: a slow or broken store falls back to memory. */
export function store(): Promise<Backend> {
  if (backend) return Promise.resolve(backend);
  if (!opening) {
    const pick: Promise<Backend> =
      Platform.OS === 'web' ? Promise.resolve(webBackend()) : sqliteBackend();

    opening = Promise.race([
      pick,
      new Promise<Backend>((resolve) =>
        setTimeout(() => resolve(memoryBackend()), 3000),
      ),
    ])
      .catch(() => memoryBackend())
      .then((b) => {
        backend = b;
        return b;
      });
  }
  return opening;
}

/** Open the store early so the first write is never the one that pays for it. */
export function warmStore() {
  void store();
}
