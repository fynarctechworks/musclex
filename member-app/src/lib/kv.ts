import { Platform } from 'react-native';

/**
 * ────────────────────────────────────────────────────────────────
 * KV — small durable values, surviving a force-quit
 * ────────────────────────────────────────────────────────────────
 *
 * Drafts and the rest-length preference were in-memory: they survived a tab
 * switch, which was the bug being fixed, but not the app being killed.
 *
 * This uses expo-sqlite, which is ALREADY a dependency (the outbox is built on
 * it), rather than adding AsyncStorage. Same durability, one less package —
 * and it deliberately does not share the outbox's table, because that one
 * carries writes owed to the server with attempt counts and idempotency keys.
 * A draft is local and worthless once sent; the two should not compete.
 *
 * ── The read model ──────────────────────────────────────────────
 *
 * SQLite is async, and the callers here are render paths: a comment box has to
 * seed its text on the first render, not a tick later. So this keeps a
 * synchronous in-memory cache in front of the database. `hydrate()` fills it
 * once at startup; reads hit the cache, writes go to both.
 *
 * Everything is best-effort. A failed write costs a draft; a thrown exception
 * while someone is typing costs the session.
 */

const web = Platform.OS === 'web';

/** Synchronous front for a database that is not. */
const cache = new Map<string, string>();

let db: import('expo-sqlite').SQLiteDatabase | null = null;
let hydrating: Promise<void> | null = null;

async function open() {
  if (db) return db;
  const SQLite = await import('expo-sqlite');
  // The same file the outbox uses, a separate table. One database handle is
  // cheaper than two, and these never contend: different tables, tiny writes.
  const d = await SQLite.openDatabaseAsync('musclex.db');
  await d.execAsync(
    'CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);',
  );
  db = d;
  return d;
}

/**
 * Load everything into the cache. Call once at startup, before the first
 * screen that reads a draft mounts.
 *
 * Never rejects: a broken store degrades to in-memory for the session, which
 * is exactly the behaviour this replaced.
 */
export function hydrate(): Promise<void> {
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      if (web) {
        const ls = globalThis.localStorage;
        if (!ls) return;
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          if (k) cache.set(k, ls.getItem(k) ?? '');
        }
        return;
      }
      const d = await open();
      const rows = await d.getAllAsync<{ key: string; value: string }>('SELECT * FROM kv');
      for (const r of rows) cache.set(r.key, r.value);
    } catch {
      /* memory-only for this session */
    }
  })();
  return hydrating;
}

/** Synchronous, because render paths need it. Empty until hydrate() lands. */
export function kvGet(key: string): string | null {
  return cache.get(key) ?? null;
}

export function kvSet(key: string, value: string): void {
  cache.set(key, value);
  try {
    if (web) {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    // Fire and forget: the cache already has it, so the member sees the right
    // thing whether or not the disk write wins.
    void open()
      .then((d) => d.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value))
      .catch(() => {});
  } catch {
    /* quota, private mode: the cache still serves this session */
  }
}

export function kvRemove(key: string): void {
  cache.delete(key);
  try {
    if (web) {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    void open()
      .then((d) => d.runAsync('DELETE FROM kv WHERE key = ?', key))
      .catch(() => {});
  } catch {
    /* already unreachable */
  }
}

/** Whether a key is present — distinguishes "cleared" from "stored empty". */
export function kvHas(key: string): boolean {
  return cache.has(key);
}
