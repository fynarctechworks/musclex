import { uuidv4 } from '@/lib/uuid';

/**
 * ────────────────────────────────────────────────────────────────
 * CHECK-IN OUTBOX — the door keeps working when the network does not
 * ────────────────────────────────────────────────────────────────
 *
 * A gym doorway at 6am with no signal still has a queue of people in it. The
 * desk cannot tell them to come back when the router is fixed, so a check-in
 * that fails to send is held and replayed later against
 * `POST /check-ins/sync`, which exists for exactly this and returns per-ROW
 * outcomes rather than a single count.
 *
 * Three properties this has to get right, in order of how badly they hurt:
 *
 * 1. TENANT SCOPE. A queued row belongs to the gym that queued it. Flushing
 *    gym A's rows under gym B's token would push A's member ids into B's audit
 *    trail. Rows are stamped with their gym and only ever flushed under a
 *    matching session.
 *
 * 2. THE ORIGINAL TIME. `checked_in_at` is when the member actually walked in,
 *    not when the queue drained. Sending sync-time would silently corrupt
 *    attendance history and peak-hour analytics — the backend takes an
 *    `occurred_at` precisely so this stays honest.
 *
 * 3. EXACTLY ONCE. `client_event_id` is minted at ENQUEUE and never changes,
 *    so a batch that is retried — bad signal mid-flush, two "Sync now" taps,
 *    an app resumed twice — cannot become two visits.
 *
 * A row is dropped when the server reaches a DECISION about it, including a
 * policy denial: "membership expired" is a final answer, and re-sending it
 * forever would wedge the queue behind a row that can never succeed.
 */

export type OutboxRow = {
  /** Stable idempotency key, minted once at enqueue. */
  clientEventId: string;
  /** The gym this row belongs to. Never flushed under a different one. */
  gymId: string;
  memberId: string;
  branchId: string;
  /** ISO instant the member actually presented themselves. */
  checkedInAt: string;
  memberName: string;
  /** Failed flush attempts so far. */
  attempts: number;
};

/** Per-row verdict returned by POST /check-ins/sync. */
export type SyncResult = {
  client_event_id?: string;
  member_id: string;
  ok: boolean;
  retryable: boolean;
  reason?: string;
};

export interface OutboxStore {
  all(gymId: string): Promise<OutboxRow[]>;
  add(row: OutboxRow): Promise<void>;
  remove(clientEventIds: string[]): Promise<void>;
  bumpAttempts(clientEventIds: string[]): Promise<void>;
  /** Drop everything not belonging to `gymId` — used on session change. */
  purgeOtherGyms(gymId: string): Promise<void>;
  count(gymId: string): Promise<number>;
}

/**
 * Give up on a row after this many failed flushes.
 *
 * Not a network-retry limit — transient failures are cheap and we keep those.
 * This catches a row that is somehow permanently unsendable and would
 * otherwise be retried on every foreground for the life of the install.
 */
export const MAX_ATTEMPTS = 25;

export function makeRow(input: {
  gymId: string;
  memberId: string;
  branchId: string;
  memberName: string;
  checkedInAt?: string;
  clientEventId?: string;
}): OutboxRow {
  return {
    clientEventId: input.clientEventId ?? uuidv4(),
    gymId: input.gymId,
    memberId: input.memberId,
    branchId: input.branchId,
    memberName: input.memberName,
    // Stamped HERE, at the door — not when the queue eventually drains.
    checkedInAt: input.checkedInAt ?? new Date().toISOString(),
    attempts: 0,
  };
}

/** The request body for a flush. */
export function buildSyncBody(rows: OutboxRow[]) {
  return {
    check_ins: rows.map((r) => ({
      member_id: r.memberId,
      branch_id: r.branchId,
      checkin_method: 'manual',
      checked_in_at: r.checkedInAt,
      client_event_id: r.clientEventId,
    })),
  };
}

/**
 * Decide what happens to each row after a flush.
 *
 * Split out from the I/O so the rules can be tested exhaustively — this is
 * where an "exactly once" system usually goes wrong.
 */
export function partitionResults(
  sent: OutboxRow[],
  results: SyncResult[] | undefined,
): { drop: string[]; retry: string[] } {
  const drop: string[] = [];
  const retry: string[] = [];

  const byId = new Map<string, SyncResult>();
  for (const r of results ?? []) {
    if (r.client_event_id) byId.set(r.client_event_id, r);
  }

  for (const row of sent) {
    const result = byId.get(row.clientEventId);

    // No verdict came back for this row. It may or may not have landed, and
    // the idempotency key makes a re-send safe, so keep it.
    if (!result) {
      retry.push(row.clientEventId);
      continue;
    }

    // Accepted, or refused on policy grounds. Either way the server has
    // decided and re-sending changes nothing — a denial kept forever would
    // wedge the queue behind a row that can never succeed.
    if (result.ok || !result.retryable) {
      drop.push(row.clientEventId);
      continue;
    }

    // Give up on a row that has failed far too often to be transient.
    if (row.attempts + 1 >= MAX_ATTEMPTS) drop.push(row.clientEventId);
    else retry.push(row.clientEventId);
  }

  return { drop, retry };
}

/**
 * Should a failed check-in be queued, or reported as an error?
 *
 * Only network-class failures queue. A 4xx is the server refusing this
 * check-in — queueing it would promise the staffer it will go through later
 * when it never will, which is worse than saying so at the counter.
 */
export function isQueueableFailure(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (typeof status !== 'number') return true; // no response at all — offline
  return status >= 500 || status === 0;
}
