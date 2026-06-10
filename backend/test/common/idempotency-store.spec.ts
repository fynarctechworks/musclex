import { ConfigService } from '@nestjs/config';
import { IdempotencyStore, IdempotencyRef } from '../../src/common/idempotency/idempotency-store.service';

/**
 * Exercises the in-memory fallback path (no Redis) — deterministic and enough
 * to prove the claim/replay/conflict state machine.
 */
describe('IdempotencyStore (in-memory fallback)', () => {
  const config = { get: (_k: string) => undefined } as unknown as ConfigService;
  let store: IdempotencyStore;

  const ref = (over: Partial<IdempotencyRef> = {}): IdempotencyRef => ({
    tenantId: 'gym-1',
    userId: 'user-1',
    endpoint: 'POST PaymentsController#recordCash',
    key: 'key-abc',
    requestHash: 'hash-1',
    ...over,
  });

  beforeEach(() => {
    store = new IdempotencyStore(config);
  });

  it('first claim is fresh', async () => {
    expect(await store.claim(ref())).toEqual({ kind: 'fresh' });
  });

  it('a second claim while in progress conflicts', async () => {
    await store.claim(ref());
    expect(await store.claim(ref())).toEqual({ kind: 'conflict', reason: 'in_progress' });
  });

  it('replays the stored response after complete', async () => {
    await store.claim(ref());
    await store.complete(ref(), 201, { id: 'pay_1' });
    expect(await store.claim(ref())).toEqual({
      kind: 'replay',
      status: 201,
      body: { id: 'pay_1' },
    });
  });

  it('flags reuse of the same key with a different body', async () => {
    await store.claim(ref());
    await store.complete(ref(), 201, { id: 'pay_1' });
    expect(await store.claim(ref({ requestHash: 'hash-2' }))).toEqual({
      kind: 'conflict',
      reason: 'key_reused',
    });
  });

  it('release allows the key to be claimed fresh again', async () => {
    await store.claim(ref());
    await store.release(ref());
    expect(await store.claim(ref())).toEqual({ kind: 'fresh' });
  });

  it('scopes keys by tenant — same key in another gym is independent', async () => {
    await store.claim(ref());
    expect(await store.claim(ref({ tenantId: 'gym-2' }))).toEqual({ kind: 'fresh' });
  });

  it('hashRequest is stable and body-sensitive', () => {
    expect(store.hashRequest({ a: 1 })).toBe(store.hashRequest({ a: 1 }));
    expect(store.hashRequest({ a: 1 })).not.toBe(store.hashRequest({ a: 2 }));
  });
});
