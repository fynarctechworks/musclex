import { DEFAULT_TIMEOUT_MS, request } from '@/api/client';

jest.mock('@/auth/session-store', () => ({
  getSession: () => null,
  clearSession: jest.fn(),
  patchSession: jest.fn(),
}));

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; jest.useRealTimers(); });

/**
 * A gym's "offline" is usually a live wifi association with a dead uplink,
 * where fetch hangs instead of failing. Without a deadline the check-in button
 * spins forever and the offline queue never gets its chance.
 */
describe('request timeout', () => {
  it('gives up on a request that never settles', async () => {
    global.fetch = jest.fn(
      (_url: any, init: any) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        }),
    ) as any;

    await expect(request('/anything', { timeoutMs: 20 })).rejects.toMatchObject({ status: 0 });
  });

  it('reports a timeout as status 0, which the outbox treats as queueable', async () => {
    global.fetch = jest.fn(
      (_url: any, init: any) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        }),
    ) as any;

    await expect(request('/anything', { timeoutMs: 20 }))
      .rejects.toMatchObject({ message: 'The network is not responding' });
  });

  it('does not interfere with a request that answers in time', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true, status: 200,
      headers: { get: () => null },
      json: async () => ({ hello: 'world' }),
    })) as any;

    await expect(request('/anything')).resolves.toEqual({ hello: 'world' });
  });

  it('still honours a caller abort', async () => {
    // A screen unmounting must cancel its request, and that is NOT a network
    // condition to queue over.
    const external = new AbortController();
    global.fetch = jest.fn(
      (_url: any, init: any) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        }),
    ) as any;

    const p = request('/anything', { signal: external.signal });
    external.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('has a default deadline short enough that a member is not left standing', () => {
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(5_000);
    expect(DEFAULT_TIMEOUT_MS).toBeLessThanOrEqual(20_000);
  });
});
