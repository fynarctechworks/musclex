/**
 * Web outbox store. Web has no `expo-sqlite` native module (and its wa-sqlite
 * `.wasm` import breaks the static web export), so the web build uses this
 * in-memory implementation of the same repository surface as `db.ts`. Metro
 * resolves this file for `import './db'` on web automatically.
 *
 * Web is a dev/preview target (see README), not a production offline client, so
 * an in-memory queue that does not survive a full page reload is acceptable: the
 * sync loop still drains it within a session and the server dedupes by
 * idempotency key. The native build keeps the durable SQLite outbox.
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

let rows: OutboxRow[] = [];

export async function insertOutbox(row: OutboxRow): Promise<void> {
  rows.push({ ...row, status: 'pending', attempts: 0 });
}

export async function listPendingOutbox(): Promise<OutboxRow[]> {
  return rows
    .filter((r) => r.status === 'pending')
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r) => ({ ...r }));
}

export async function markOutboxDone(id: string): Promise<void> {
  const row = rows.find((r) => r.id === id);
  if (row) row.status = 'done';
}

export async function updateOutboxAttempt(
  id: string,
  attempts: number,
  status: 'pending' | 'failed',
  _lastError: string,
): Promise<void> {
  const row = rows.find((r) => r.id === id);
  if (row) {
    row.attempts = attempts;
    row.status = status;
  }
}

export async function countPendingOutbox(): Promise<number> {
  return rows.filter((r) => r.status === 'pending').length;
}

export async function deleteDoneOutbox(): Promise<void> {
  rows = rows.filter((r) => r.status !== 'done');
}
