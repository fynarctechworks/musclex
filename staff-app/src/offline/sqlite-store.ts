import { Platform } from 'react-native';

import type { KVStore } from './persister';

/**
 * expo-sqlite backing for the offline cache.
 *
 * SQLite rather than AsyncStorage because member-app already depends on it, so
 * the version is pinned and the native module is one the team has shipped
 * before. The cache is a handful of rows, so nothing here needs to be clever.
 *
 * The module is loaded LAZILY, and via `require` rather than dynamic `import`.
 * `sqlite-store` is reached from the provider tree, which also renders on web
 * (`run web`) and under Jest — neither of which has the native module. Dynamic
 * `import()` additionally fails outright under Jest without
 * --experimental-vm-modules, so `require` is the form that works in all three
 * places while still not loading anything until first use.
 */

const TABLE = 'query_cache';

let dbPromise: Promise<any> | null = null;

async function db(): Promise<any> {
  if (!dbPromise) {
    dbPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sqlite = require('expo-sqlite');
      const handle = await sqlite.openDatabaseAsync('musclex-staff-cache.db');
      await handle.execAsync(
        `CREATE TABLE IF NOT EXISTS ${TABLE} (
           scope      TEXT PRIMARY KEY NOT NULL,
           payload    TEXT NOT NULL,
           updated_at INTEGER NOT NULL
         );`,
      );
      return handle;
    })().catch((e) => {
      // Reset so a later call can retry rather than being stuck on a rejected
      // promise for the life of the process.
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

/** True where a native SQLite module actually exists. */
export function offlineCacheSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export function createSqliteStore(): KVStore {
  return {
    async get(key) {
      const handle = await db();
      const row = (await handle.getFirstAsync(
        `SELECT payload FROM ${TABLE} WHERE scope = ?`,
        [key],
      )) as { payload: string } | null;
      return row?.payload ?? null;
    },

    async set(key, value) {
      const handle = await db();
      await handle.runAsync(
        `INSERT INTO ${TABLE} (scope, payload, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(scope) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
        [key, value, Date.now()],
      );
    },

    async remove(key) {
      const handle = await db();
      await handle.runAsync(`DELETE FROM ${TABLE} WHERE scope = ?`, [key]);
    },

    async removeAllExcept(key) {
      const handle = await db();
      await handle.runAsync(`DELETE FROM ${TABLE} WHERE scope <> ?`, [key]);
    },
  };
}

/**
 * An in-memory stand-in for web and for tests.
 *
 * Web keeps working (nothing persists across a reload, which is correct — a
 * browser profile is not a gym's phone) and tests get a store with no native
 * dependency.
 */
export function createMemoryStore(): KVStore {
  const map = new Map<string, string>();
  return {
    async get(key) { return map.get(key) ?? null; },
    async set(key, value) { map.set(key, value); },
    async remove(key) { map.delete(key); },
    async removeAllExcept(key) {
      for (const k of [...map.keys()]) if (k !== key) map.delete(k);
    },
  };
}
