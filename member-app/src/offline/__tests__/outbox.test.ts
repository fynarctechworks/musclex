import { ApiError, OfflineError } from '../../api/client';

/**
 * The outbox is the one piece whose failure loses a member's workout, so its
 * contract is pinned here:
 *
 *   - a network failure QUEUES rather than throwing
 *   - a retry reuses the SAME idempotency key (the server dedupes on it)
 *   - a 4xx is dropped, not retried forever — refused is not lost
 *   - flush stops at the first network failure instead of hammering a dead link
 */

// `mock`-prefixed names are the only ones jest lets a mock factory close over.
const mockSent: { kind: string; key: string }[] = [];
const mockState = { mode: 'ok' as 'ok' | 'offline' | 'refused' };

jest.mock('../../api/endpoints', () => {
  const { OfflineError: Offline, ApiError: Api } = jest.requireActual('../../api/client');
  const record = (kind: string, key: string) => {
    if (mockState.mode === 'offline') return Promise.reject(new Offline());
    if (mockState.mode === 'refused') return Promise.reject(new Api('BAD_REQUEST', 'nope', 400));
    mockSent.push({ kind, key });
    return Promise.resolve({ ok: true });
  };
  return {
    api: {
      logFreestyle: (_sets: unknown, key: string) => record('workout_log', key),
      logAssignedWorkout: (_id: string, _s: unknown, key: string) => record('workout_log', key),
      checkIn: (key: string) => record('checkin', key),
      logWater: (_ml: number, key: string) => record('water', key),
      logMeal: (_b: unknown, key: string) => record('meal', key),
    },
  };
});

// Make SQLite unavailable. That both keeps this test about queue behaviour
// rather than storage, and exercises the memory fallback — the path that must
// hold when the store cannot open, which is exactly when a member is offline.
jest.mock('expo-sqlite', () => {
  throw new Error('no sqlite in tests');
});

import { flush, pendingCount, write } from '../outbox';

beforeEach(async () => {
  mockSent.length = 0;
  mockState.mode = 'ok';
  // Drain anything a previous test left behind.
  await flush().catch(() => {});
});

describe('write', () => {
  it('sends immediately when online and leaves nothing queued', async () => {
    const res = await write('water', { amountMl: 250 }, 'k-online');
    expect(res.queued).toBe(false);
    expect(mockSent).toHaveLength(1);
    expect(await pendingCount()).toBe(0);
  });

  it('queues instead of throwing when the request never reaches the server', async () => {
    mockState.mode = 'offline';
    const res = await write('workout_log', { sets: [] }, 'k-offline');
    expect(res.queued).toBe(true);
    expect(mockSent).toHaveLength(0);
    expect(await pendingCount()).toBe(1);
  });

  it('drops a refused write rather than retrying it forever', async () => {
    mockState.mode = 'refused';
    await expect(write('water', { amountMl: 1 }, 'k-refused')).rejects.toBeInstanceOf(ApiError);
    expect(await pendingCount()).toBe(0);
  });
});

describe('flush', () => {
  it('reuses the original idempotency key, so a retry cannot double-log', async () => {
    mockState.mode = 'offline';
    await write('workout_log', { sets: [] }, 'k-stable');
    expect(await pendingCount()).toBe(1);

    mockState.mode = 'ok';
    const res = await flush();
    expect(res.sent).toBe(1);
    expect(mockSent[0].key).toBe('k-stable');
    expect(await pendingCount()).toBe(0);
  });

  it('stops at the first network failure instead of draining blindly', async () => {
    mockState.mode = 'offline';
    await write('water', { amountMl: 1 }, 'k-a');
    await write('water', { amountMl: 2 }, 'k-b');
    expect(await pendingCount()).toBe(2);

    const res = await flush();
    expect(res.sent).toBe(0);
    expect(res.remaining).toBe(2);
  });

  it('discards queued items the server refuses and keeps going', async () => {
    mockState.mode = 'offline';
    await write('water', { amountMl: 1 }, 'k-bad');
    mockState.mode = 'refused';
    const res = await flush();
    expect(res.sent).toBe(0);
    expect(res.remaining).toBe(0);
  });
});

describe('OfflineError', () => {
  it('is distinguishable from a refusal, which is what the queue decision turns on', () => {
    expect(new OfflineError()).toBeInstanceOf(OfflineError);
    expect(new ApiError('X', 'y', 400)).not.toBeInstanceOf(OfflineError);
  });
});
