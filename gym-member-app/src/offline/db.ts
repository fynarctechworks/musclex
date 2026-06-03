import * as SQLite from 'expo-sqlite';

/**
 * Local outbox store (TRD §8 "SQLite + outbox + idempotency"), native impl.
 *
 * This module exposes a small *semantic* repository (insert/listPending/…) rather
 * than leaking raw SQL to callers, so the web build can swap in an in-memory
 * implementation (`db.web.ts`) that Metro resolves automatically. Web has no
 * `expo-sqlite` native module — and its wa-sqlite `.wasm` import breaks the
 * static web export — so keeping SQLite behind this seam is what lets the app
 * bundle for web at all. Later phases can add read caches here.
 */
export interface OutboxRow {
  id: string;
  kind: string;
  payload: string;
  idempotencyKey: string;
  status: 'pending' | 'done' | 'failed';
  attempts: number;
  createdAt: number;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
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

export async function insertOutbox(row: OutboxRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO outbox (id, kind, payload, idempotency_key, status, attempts, created_at)
     VALUES (?, ?, ?, ?, 'pending', 0, ?)`,
    row.id,
    row.kind,
    row.payload,
    row.idempotencyKey,
    row.createdAt,
  );
}

export async function listPendingOutbox(): Promise<OutboxRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    kind: string;
    payload: string;
    idempotency_key: string;
    attempts: number;
    created_at: number;
  }>(
    `SELECT id, kind, payload, idempotency_key, attempts, created_at FROM outbox
     WHERE status = 'pending' ORDER BY created_at ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    payload: r.payload,
    idempotencyKey: r.idempotency_key,
    status: 'pending',
    attempts: r.attempts,
    createdAt: r.created_at,
  }));
}

export async function markOutboxDone(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE outbox SET status = 'done' WHERE id = ?`, id);
}

export async function updateOutboxAttempt(
  id: string,
  attempts: number,
  status: 'pending' | 'failed',
  lastError: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE outbox SET attempts = ?, status = ?, last_error = ? WHERE id = ?`,
    attempts,
    status,
    lastError,
    id,
  );
}

export async function countPendingOutbox(): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) as n FROM outbox WHERE status = 'pending'`,
  );
  return r?.n ?? 0;
}

export async function deleteDoneOutbox(): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM outbox WHERE status = 'done'`);
}
