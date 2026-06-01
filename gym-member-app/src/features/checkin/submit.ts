import { api } from '../../api/endpoints';
import { NetworkError } from '../../api/client';
import { enqueue } from '../../offline/outbox';
import { uuid } from '../../lib/uuid';
import type { CheckInRequest, CheckInResult } from '../../api/types';

export interface CheckInOutcome {
  /** true when offline: queued in the outbox and will reconcile on reconnect. */
  queued: boolean;
  result?: CheckInResult;
}

/**
 * Submit a check-in. Tries the server directly for an instant result (streak,
 * dedupe). If offline, queues it in the outbox under the SAME idempotency key so
 * the later retry can't double-count (TRD §8). Non-network errors (e.g. expired
 * membership) propagate so the UI can show the reason.
 */
export async function submitCheckIn(token?: string): Promise<CheckInOutcome> {
  const body: CheckInRequest = {
    method: token ? 'qr' : 'manual',
    token,
    occurredAt: new Date().toISOString(),
  };
  const key = uuid();
  try {
    const result = await api.checkIn(body, key);
    return { queued: false, result };
  } catch (err) {
    if (err instanceof NetworkError) {
      await enqueue({ kind: 'checkin', body }, key);
      return { queued: true };
    }
    throw err;
  }
}
