import {
  MAX_ATTEMPTS,
  buildSyncBody,
  isQueueableFailure,
  makeRow,
  partitionResults,
  type OutboxRow,
} from '@/offline/outbox';

const base = { gymId: 'gym-a', memberId: 'm-1', branchId: 'b-1', memberName: 'Neha Patel' };

function row(over: Partial<OutboxRow> = {}): OutboxRow {
  return { ...makeRow(base), ...over };
}

describe('makeRow', () => {
  it('mints a distinct idempotency key per queued row', () => {
    expect(makeRow(base).clientEventId).not.toBe(makeRow(base).clientEventId);
  });

  it('stamps the time at the DOOR, not at sync time', () => {
    // Sending sync-time would corrupt attendance history and peak-hour data.
    const at = '2026-08-26T06:04:00.000Z';
    expect(makeRow({ ...base, checkedInAt: at }).checkedInAt).toBe(at);
  });

  it('defaults checkedInAt to now', () => {
    const before = Date.now();
    const t = Date.parse(makeRow(base).checkedInAt);
    expect(t).toBeGreaterThanOrEqual(before - 1000);
    expect(t).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('remembers which gym queued it', () => {
    expect(makeRow(base).gymId).toBe('gym-a');
  });
});

describe('buildSyncBody', () => {
  it('preserves the original check-in time per row', () => {
    const r = row({ checkedInAt: '2026-08-26T06:04:00.000Z' });
    expect(buildSyncBody([r]).check_ins[0].checked_in_at).toBe('2026-08-26T06:04:00.000Z');
  });

  it('carries the stable idempotency key so a replayed batch is not two visits', () => {
    const r = row();
    expect(buildSyncBody([r]).check_ins[0].client_event_id).toBe(r.clientEventId);
  });

  it('sends branch_id, which the DTO requires', () => {
    expect(buildSyncBody([row()]).check_ins[0].branch_id).toBe('b-1');
  });
});

describe('partitionResults', () => {
  it('drops a row the server accepted', () => {
    const r = row();
    const out = partitionResults([r], [
      { client_event_id: r.clientEventId, member_id: 'm-1', ok: true, retryable: false },
    ]);
    expect(out.drop).toEqual([r.clientEventId]);
    expect(out.retry).toEqual([]);
  });

  it('REPORTS a policy denial rather than dropping it silently', () => {
    // The staffer was promised this would sync. If it did not, the gym's
    // attendance is wrong and only they could have fixed it.
    const r = row();
    const out = partitionResults([r], [
      { client_event_id: r.clientEventId, member_id: 'm-1', ok: false, retryable: false,
        reason: 'cooldown' },
    ]);
    expect(out.denied).toEqual([
      { memberName: 'Neha Patel', reason: 'already checked in recently' },
    ]);
  });

  it('translates reason codes into something a staffer can act on', () => {
    const r = row();
    const denied = (reason: string) =>
      partitionResults([r], [
        { client_event_id: r.clientEventId, member_id: 'm-1', ok: false, retryable: false, reason },
      ]).denied[0].reason;

    expect(denied('membership_expired')).toBe('membership had expired');
    expect(denied('no_active_membership')).toBe('no active membership');
    // An unknown code still reads as prose rather than a snake_case token.
    expect(denied('some_new_rule')).toBe('some new rule');
  });

  it('does not report an ACCEPTED row as denied', () => {
    const r = row();
    const out = partitionResults([r], [
      { client_event_id: r.clientEventId, member_id: 'm-1', ok: true, retryable: false },
    ]);
    expect(out.denied).toEqual([]);
  });

  it('reports a row abandoned after too many attempts', () => {
    const r = row({ attempts: MAX_ATTEMPTS - 1 });
    const out = partitionResults([r], [
      { client_event_id: r.clientEventId, member_id: 'm-1', ok: false, retryable: true },
    ]);
    expect(out.denied).toEqual([
      { memberName: 'Neha Patel', reason: 'could not be synced' },
    ]);
  });

  it('drops a POLICY denial rather than retrying it forever', () => {
    // "Membership expired" is a final answer. Keeping it would wedge the queue
    // behind a row that can never succeed.
    const r = row();
    const out = partitionResults([r], [
      { client_event_id: r.clientEventId, member_id: 'm-1', ok: false, retryable: false,
        reason: 'membership_expired' },
    ]);
    expect(out.drop).toEqual([r.clientEventId]);
  });

  it('KEEPS a transient failure', () => {
    const r = row();
    const out = partitionResults([r], [
      { client_event_id: r.clientEventId, member_id: 'm-1', ok: false, retryable: true },
    ]);
    expect(out.retry).toEqual([r.clientEventId]);
  });

  it('keeps a row the server said nothing about', () => {
    // Might have landed, might not. The idempotency key makes a re-send safe,
    // so the safe direction is to keep it.
    const r = row();
    expect(partitionResults([r], []).retry).toEqual([r.clientEventId]);
  });

  it('keeps a row when the response has no results at all', () => {
    const r = row();
    expect(partitionResults([r], undefined).retry).toEqual([r.clientEventId]);
  });

  it('gives up on a row that has failed far too often', () => {
    const r = row({ attempts: MAX_ATTEMPTS - 1 });
    const out = partitionResults([r], [
      { client_event_id: r.clientEventId, member_id: 'm-1', ok: false, retryable: true },
    ]);
    expect(out.drop).toEqual([r.clientEventId]);
  });

  it('handles a partial batch — some land, some do not', () => {
    // The reason the endpoint returns per-row outcomes at all.
    const a = row(); const b = row(); const c = row();
    const out = partitionResults([a, b, c], [
      { client_event_id: a.clientEventId, member_id: 'm-1', ok: true, retryable: false },
      { client_event_id: b.clientEventId, member_id: 'm-1', ok: false, retryable: true },
      { client_event_id: c.clientEventId, member_id: 'm-1', ok: false, retryable: false },
    ]);
    expect(out.drop.sort()).toEqual([a.clientEventId, c.clientEventId].sort());
    expect(out.retry).toEqual([b.clientEventId]);
  });

  it('ignores a verdict for a row that was not in this batch', () => {
    const r = row();
    const out = partitionResults([r], [
      { client_event_id: 'someone-else', member_id: 'm-9', ok: true, retryable: false },
    ]);
    expect(out.retry).toEqual([r.clientEventId]);
    expect(out.drop).toEqual([]);
  });
});

describe('isQueueableFailure', () => {
  it('queues when there was no response at all — the offline case', () => {
    expect(isQueueableFailure(new Error('Network request failed'))).toBe(true);
  });

  it('queues a 5xx', () => {
    expect(isQueueableFailure({ status: 503 })).toBe(true);
  });

  it('does NOT queue a 4xx', () => {
    // The server refused this check-in. Queueing would promise the staffer it
    // goes through later when it never will.
    expect(isQueueableFailure({ status: 403 })).toBe(false);
    expect(isQueueableFailure({ status: 400 })).toBe(false);
    expect(isQueueableFailure({ status: 404 })).toBe(false);
  });

  it('does not queue a 401 — the session is the problem, not the network', () => {
    expect(isQueueableFailure({ status: 401 })).toBe(false);
  });

  it('queues a request that timed out', () => {
    // The common gym failure: associated to the wifi, dead uplink, so fetch
    // hangs rather than failing. The client surfaces that as status 0.
    expect(isQueueableFailure({ status: 0 })).toBe(true);
  });
});
