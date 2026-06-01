import * as SQLite from 'expo-sqlite';

/**
 * Local SQLite store (TRD §8 "SQLite + outbox + idempotency"). Phase-1 holds the
 * write outbox; later phases can add read caches (home, today's workout) here.
 */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('fitsync.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS outbox (
          id              TEXT PRIMARY KEY NOT NULL,
          kind            TEXT NOT NULL,
          payload         TEXT NOT NULL,
          idempotency_key TEXT NOT NULL,
          status          TEXT NOT NULL DEFAULT 'pending',
          attempts        INTEGER NOT NULL DEFAULT 0,
          last_error      TEXT,
          created_at      INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, created_at);
      `);
      return db;
    });
  }
  return dbPromise;
}
