import { flushOutbox } from '@/offline/flush';
import { makeRow } from '@/offline/outbox';
import { createMemoryOutbox } from '@/offline/sqlite-store';
import { api } from '@/api/client';

jest.mock('@/api/client', () => ({ api: { post: jest.fn() } }));
const post = api.post as jest.Mock;

const A = { gymId: 'gym-a', memberId: 'm-1', branchId: 'b-1', memberName: 'Neha Patel' };
const B = { gymId: 'gym-b', memberId: 'm-9', branchId: 'b-9', memberName: 'Other Gym Member' };

beforeEach(() => post.mockReset());

describe('flushOutbox', () => {
  it('does nothing when the queue is empty', async () => {
    const store = createMemoryOutbox();
    expect(await flushOutbox(store, 'gym-a')).toEqual({ synced: 0, kept: 0, failed: false });
    expect(post).not.toHaveBeenCalled();
  });

  it('does nothing when there is no signed-in gym', async () => {
    const store = createMemoryOutbox();
    await store.add(makeRow(A));
    await flushOutbox(store, null);
    expect(post).not.toHaveBeenCalled();
  });

  it('sends a queued row and removes it once accepted', async () => {
    const store = createMemoryOutbox();
    const row = makeRow(A);
    await store.add(row);
    post.mockResolvedValue({
      results: [{ client_event_id: row.clientEventId, member_id: 'm-1', ok: true, retryable: false }],
    });

    const out = await flushOutbox(store, 'gym-a');
    expect(out).toEqual({ synced: 1, kept: 0, failed: false });
    expect(await store.count('gym-a')).toBe(0);
  });

  it('NEVER sends another gym rows', async () => {
    // The property that matters most: flushing gym A's rows under gym B's
    // token would push A's member ids into B's audit trail.
    const store = createMemoryOutbox();
    await store.add(makeRow(A));
    await store.add(makeRow(B));
    post.mockResolvedValue({ results: [] });

    await flushOutbox(store, 'gym-b');

    const body = post.mock.calls[0][1];
    expect(body.check_ins).toHaveLength(1);
    expect(body.check_ins[0].member_id).toBe('m-9');
  });

  it('keeps rows when the request itself fails — still offline', async () => {
    const store = createMemoryOutbox();
    await store.add(makeRow(A));
    post.mockRejectedValue(new Error('Network request failed'));

    const out = await flushOutbox(store, 'gym-a');
    expect(out.failed).toBe(true);
    expect(await store.count('gym-a')).toBe(1);
  });

  it('does not throw when the network fails', async () => {
    // A rejected promise here would surface as an unhandled error inside an
    // AppState listener.
    const store = createMemoryOutbox();
    await store.add(makeRow(A));
    post.mockRejectedValue(new Error('boom'));
    await expect(flushOutbox(store, 'gym-a')).resolves.toBeDefined();
  });

  it('records an attempt on every row it failed to deliver', async () => {
    const store = createMemoryOutbox();
    await store.add(makeRow(A));
    post.mockRejectedValue(new Error('offline'));

    await flushOutbox(store, 'gym-a');
    expect((await store.all('gym-a'))[0].attempts).toBe(1);
  });

  it('drops the accepted rows and keeps the rest of a partial batch', async () => {
    const store = createMemoryOutbox();
    const ok = makeRow(A);
    const transient = makeRow(A);
    await store.add(ok);
    await store.add(transient);
    post.mockResolvedValue({
      results: [
        { client_event_id: ok.clientEventId, member_id: 'm-1', ok: true, retryable: false },
        { client_event_id: transient.clientEventId, member_id: 'm-1', ok: false, retryable: true },
      ],
    });

    const out = await flushOutbox(store, 'gym-a');
    expect(out).toMatchObject({ synced: 1, kept: 1 });
    const left = await store.all('gym-a');
    expect(left.map((r) => r.clientEventId)).toEqual([transient.clientEventId]);
  });

  it('sends the ORIGINAL check-in time, not the sync time', async () => {
    const store = createMemoryOutbox();
    await store.add(makeRow({ ...A, checkedInAt: '2026-08-26T06:04:00.000Z' }));
    post.mockResolvedValue({ results: [] });

    await flushOutbox(store, 'gym-a');
    expect(post.mock.calls[0][1].check_ins[0].checked_in_at).toBe('2026-08-26T06:04:00.000Z');
  });

  it('batches a large backlog rather than sending one enormous body', async () => {
    const store = createMemoryOutbox();
    for (let i = 0; i < 120; i++) await store.add(makeRow(A));
    post.mockResolvedValue({ results: [] });

    await flushOutbox(store, 'gym-a');
    expect(post).toHaveBeenCalledTimes(3); // 50 + 50 + 20
  });

  it('stops after the first failing batch instead of hammering', async () => {
    const store = createMemoryOutbox();
    for (let i = 0; i < 120; i++) await store.add(makeRow(A));
    post.mockRejectedValue(new Error('offline'));

    await flushOutbox(store, 'gym-a');
    expect(post).toHaveBeenCalledTimes(1);
  });
});
