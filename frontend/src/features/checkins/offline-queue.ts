import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { OfflineCheckIn } from './types';

interface CheckInDB extends DBSchema {
  offlineCheckIns: {
    key: string;
    value: OfflineCheckIn;
    indexes: { 'by-date': string };
  };
}

const DB_NAME = 'musclex-checkins';
const DB_VERSION = 1;
const STORE_NAME = 'offlineCheckIns';

let dbPromise: Promise<IDBPDatabase<CheckInDB>> | null = null;

function getDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<CheckInDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by-date', 'checked_in_at');
      },
    });
  }
  return dbPromise;
}

export const offlineQueue = {
  async add(checkIn: OfflineCheckIn) {
    const db = await getDB();
    if (!db) return;
    await db.add(STORE_NAME, checkIn);
  },

  async getAll(): Promise<OfflineCheckIn[]> {
    const db = await getDB();
    if (!db) return [];
    return db.getAllFromIndex(STORE_NAME, 'by-date');
  },

  async count(): Promise<number> {
    const db = await getDB();
    if (!db) return 0;
    return db.count(STORE_NAME);
  },

  async remove(id: string) {
    const db = await getDB();
    if (!db) return;
    await db.delete(STORE_NAME, id);
  },

  async clear() {
    const db = await getDB();
    if (!db) return;
    await db.clear(STORE_NAME);
  },
};
