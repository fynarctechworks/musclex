import {
  createPersister,
  scopeKey,
  shouldPersistQuery,
  OFFLINE_MAX_AGE_MS,
} from '../persister';
import { createMemoryStore } from '../sqlite-store';
import type { PersistedClient } from '@tanstack/query-persist-client-core';

const GYM_A = { gymId: 'gym-a', branchId: 'br-1', userId: 'u-1' };
const GYM_B = { gymId: 'gym-b', branchId: 'br-1', userId: 'u-1' };

function blob(marker: string): PersistedClient {
  return { timestamp: 0, buster: 'b', clientState: { mutations: [], queries: [marker] as any } };
}

describe('scopeKey', () => {
  it('separates two gyms', () => {
    expect(scopeKey(GYM_A)).not.toBe(scopeKey(GYM_B));
  });

  it('separates two branches of the SAME gym', () => {
    // Branch is a data boundary too — switching sites must not show the
    // previous site's member list.
    expect(scopeKey({ ...GYM_A, branchId: 'br-1' }))
      .not.toBe(scopeKey({ ...GYM_A, branchId: 'br-2' }));
  });

  it('separates two staffers sharing a front-desk device', () => {
    expect(scopeKey({ ...GYM_A, userId: 'u-1' }))
      .not.toBe(scopeKey({ ...GYM_A, userId: 'u-2' }));
  });

  it('does not let absent fields collide into one key', () => {
    // 'a:-' vs '-:a' — a naive join would make these the same string.
    expect(scopeKey({ gymId: 'a', branchId: null, userId: null }))
      .not.toBe(scopeKey({ gymId: null, branchId: 'a', userId: null }));
  });

  it('is stable for the same scope', () => {
    expect(scopeKey(GYM_A)).toBe(scopeKey({ ...GYM_A }));
  });

  it('treats empty string and null alike', () => {
    expect(scopeKey({ gymId: '', branchId: 'b', userId: 'c' }))
      .toBe(scopeKey({ gymId: null, branchId: 'b', userId: 'c' }));
  });
});

describe('createPersister', () => {
  it('round-trips a cache', async () => {
    const store = createMemoryStore();
    const p = createPersister(store, GYM_A);
    await p.persistClient(blob('x'));
    expect(await p.restoreClient()).toEqual(blob('x'));
  });

  it('CANNOT read another gym cache', async () => {
    // The isolation property, stated as a test.
    const store = createMemoryStore();
    await createPersister(store, GYM_A).persistClient(blob('gym-a-members'));
    expect(await createPersister(store, GYM_B).restoreClient()).toBeUndefined();
  });

  it('returns undefined rather than throwing on a corrupt blob', async () => {
    // A truncated write must not brick startup on every subsequent launch.
    const store = createMemoryStore();
    await store.set(scopeKey(GYM_A), '{not json');
    expect(await createPersister(store, GYM_A).restoreClient()).toBeUndefined();
  });

  it('removeClient clears only its own scope', async () => {
    const store = createMemoryStore();
    await createPersister(store, GYM_A).persistClient(blob('a'));
    await createPersister(store, GYM_B).persistClient(blob('b'));
    await createPersister(store, GYM_A).removeClient();

    expect(await createPersister(store, GYM_A).restoreClient()).toBeUndefined();
    expect(await createPersister(store, GYM_B).restoreClient()).toEqual(blob('b'));
  });

  it('survives a store that throws on write', async () => {
    // A full disk degrades the cache; it must not crash the app.
    const broken = { ...createMemoryStore(), set: async () => { throw new Error('disk full'); } };
    await expect(createPersister(broken, GYM_A).persistClient(blob('x'))).resolves.toBeUndefined();
  });

  it('survives a store that throws on read', async () => {
    const broken = { ...createMemoryStore(), get: async () => { throw new Error('io'); } };
    await expect(createPersister(broken, GYM_A).restoreClient()).resolves.toBeUndefined();
  });
});

describe('shouldPersistQuery', () => {
  const ok = (key: unknown[]) => ({ queryKey: key, state: { status: 'success' } }) as any;

  it.each([['dashboard'], ['members'], ['schedule']])('persists %s', (head) => {
    expect(shouldPersistQuery(ok([head]))).toBe(true);
  });

  it.each([['payments'], ['pos'], ['reports'], ['staff']])(
    'does NOT persist %s — allowlist, so new keys default to off',
    (head) => {
      expect(shouldPersistQuery(ok([head]))).toBe(false);
    },
  );

  it('does not persist an errored query', () => {
    // Restoring an error as if it were data is worse than no cache.
    expect(shouldPersistQuery({ queryKey: ['members'], state: { status: 'error' } } as any)).toBe(false);
  });

  it('does not persist a pending query', () => {
    expect(shouldPersistQuery({ queryKey: ['members'], state: { status: 'pending' } } as any)).toBe(false);
  });

  it('ignores a non-string key head', () => {
    expect(shouldPersistQuery(ok([{ weird: true }]))).toBe(false);
    expect(shouldPersistQuery(ok([]))).toBe(false);
  });
});

describe('OFFLINE_MAX_AGE_MS', () => {
  it('spans one shift but not two', () => {
    // A membership that lapsed overnight must not still read "active" at the
    // door the next morning.
    expect(OFFLINE_MAX_AGE_MS).toBeLessThan(24 * 60 * 60 * 1000);
    expect(OFFLINE_MAX_AGE_MS).toBeGreaterThanOrEqual(8 * 60 * 60 * 1000);
  });
});
