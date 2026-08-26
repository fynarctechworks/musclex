import { Platform } from 'react-native';

import type { KVStore } from './persister';
import type { OutboxRow, OutboxStore } from './outbox';

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
const OUTBOX = 'checkin_outbox';

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
         );
         CREATE TABLE IF NOT EXISTS ${OUTBOX} (
           client_event_id TEXT PRIMARY KEY NOT NULL,
           gym_id          TEXT NOT NULL,
           member_id       TEXT NOT NULL,
           branch_id       TEXT NOT NULL,
           member_name     TEXT NOT NULL,
           checked_in_at   TEXT NOT NULL,
           attempts        INTEGER NOT NULL DEFAULT 0
         );
         CREATE INDEX IF NOT EXISTS ${OUTBOX}_gym ON ${OUTBOX} (gym_id);`,
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

/**
 * The queued-check-in outbox, in the same database as the query cache.
 *
 * Rows are addressed by `client_event_id`, which is also the server's
 * idempotency key — so "the id we store it under" and "the id that makes a
 * replay safe" cannot drift apart.
 *
 * Every read is filtered by gym. That filter is the thing standing between a
 * queued row and somebody else's audit trail, so it is applied in the QUERY
 * rather than after loading, where a later refactor could quietly drop it.
 */
export function createSqliteOutbox(): OutboxStore {
  return {
    async all(gymId) {
      const handle = await db();
      const rows = (await handle.getAllAsync(
        `SELECT * FROM ${OUTBOX} WHERE gym_id = ? ORDER BY checked_in_at ASC`,
        [gymId],
      )) as any[];
      return rows.map(toRow);
    },

    async add(row) {
      const handle = await db();
      await handle.runAsync(
        `INSERT OR REPLACE INTO ${OUTBOX}
           (client_event_id, gym_id, member_id, branch_id, member_name, checked_in_at, attempts)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.clientEventId, row.gymId, row.memberId, row.branchId, row.memberName,
         row.checkedInAt, row.attempts],
      );
    },

    async remove(ids) {
      if (ids.length === 0) return;
      const handle = await db();
      await handle.runAsync(
        `DELETE FROM ${OUTBOX} WHERE client_event_id IN (${ids.map(() => '?').join(',')})`,
        ids,
      );
    },

    async bumpAttempts(ids) {
      if (ids.length === 0) return;
      const handle = await db();
      await handle.runAsync(
        `UPDATE ${OUTBOX} SET attempts = attempts + 1
          WHERE client_event_id IN (${ids.map(() => '?').join(',')})`,
        ids,
      );
    },

    async purgeOtherGyms(gymId) {
      const handle = await db();
      await handle.runAsync(`DELETE FROM ${OUTBOX} WHERE gym_id <> ?`, [gymId]);
    },

    async count(gymId) {
      const handle = await db();
      const r = (await handle.getFirstAsync(
        `SELECT COUNT(*) AS n FROM ${OUTBOX} WHERE gym_id = ?`,
        [gymId],
      )) as { n: number } | null;
      return r?.n ?? 0;
    },
  };
}

function toRow(r: any): OutboxRow {
  return {
    clientEventId: r.client_event_id,
    gymId: r.gym_id,
    memberId: r.member_id,
    branchId: r.branch_id,
    memberName: r.member_name,
    checkedInAt: r.checked_in_at,
    attempts: r.attempts ?? 0,
  };
}

/** In-memory outbox for web and tests. */
export function createMemoryOutbox(): OutboxStore {
  let rows: OutboxRow[] = [];
  return {
    async all(gymId) {
      return rows
        .filter((r) => r.gymId === gymId)
        .sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt));
    },
    async add(row) {
      rows = rows.filter((r) => r.clientEventId !== row.clientEventId).concat(row);
    },
    async remove(ids) { rows = rows.filter((r) => !ids.includes(r.clientEventId)); },
    async bumpAttempts(ids) {
      rows = rows.map((r) =>
        ids.includes(r.clientEventId) ? { ...r, attempts: r.attempts + 1 } : r);
    },
    async purgeOtherGyms(gymId) { rows = rows.filter((r) => r.gymId === gymId); },
    async count(gymId) { return rows.filter((r) => r.gymId === gymId).length; },
  };
}
