"use client";

import { openDB, type IDBPDatabase } from "idb";

/**
 * Thin IndexedDB cache for the dashboard's read-only payloads. Used by the
 * mobile shell so users opening the app on a flaky 4G connection see the
 * last-known dashboard immediately, with an honest "last synced X ago"
 * banner instead of an indefinite spinner.
 *
 * One object store keyed by `cache_key`, value carries `{ data, ts }`.
 */

const DB_NAME = "fitsync-dashboard";
const DB_VERSION = 1;
const STORE = "cache";

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDb(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB not available on server"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

export interface CachedPayload<T> {
  data: T;
  ts: number;
}

export async function offlineGet<T>(key: string): Promise<CachedPayload<T> | null> {
  try {
    const db = await getDb();
    const value = await db.get(STORE, key);
    if (!value) return null;
    return value as CachedPayload<T>;
  } catch {
    return null;
  }
}

export async function offlineSet<T>(key: string, data: T): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE, { data, ts: Date.now() }, key);
  } catch {
    // Cache write failures are non-fatal; we still have the live data in memory.
  }
}

export async function offlineDelete(key: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE, key);
  } catch {
    // ignore
  }
}

export const OfflineCacheKeys = {
  pulse: (branchId?: string) => `pulse:${branchId ?? "all"}`,
  actions: (branchId?: string) => `actions:${branchId ?? "all"}`,
  briefing: (branchId?: string) => `briefing:${branchId ?? "all"}`,
} as const;
