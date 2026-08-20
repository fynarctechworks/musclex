/**
 * Auth token handling.
 *
 * The regression this pins: /auth/session and /auth/dev/session return their
 * tokens nested under `tokens`, but /auth/refresh returns them at the TOP
 * level. Reading only the nested shape made every refresh look like a rejection
 * and signed the member out every 15 minutes — the access-token lifetime.
 */

const mockStore = new Map<string, string>();

jest.mock('../supabase', () => ({
  supabase: () => null, // exercise the dev-bypass path; the OTP branch is Supabase's own
  otpConfigured: () => false,
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: (k: string, v: string) => {
    mockStore.set(k, v);
    return Promise.resolve();
  },
  getItemAsync: (k: string) => Promise.resolve(mockStore.get(k) ?? null),
  deleteItemAsync: (k: string) => {
    mockStore.delete(k);
    return Promise.resolve();
  },
}));

import { refresh, signIn, signOut, toE164, digits } from '../auth';
import { getToken } from '../client';

const respond = (body: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 401, json: () => Promise.resolve(body) } as Response);

beforeEach(async () => {
  mockStore.clear();
  await signOut();
  jest.restoreAllMocks();
});

describe('signIn', () => {
  it('accepts the nested { tokens } shape the session routes return', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
      respond({ tokens: { accessToken: 'access-1', refreshToken: 'refresh-1' } }),
    );
    await expect(signIn('9877000111', '000000')).resolves.toEqual({ status: 'signed-in' });
    expect(getToken()).toBe('access-1');
  });

  it('surfaces the server message when the code is wrong', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => respond({ error: { message: 'Bad code' } }, false));
    await expect(signIn('9877000111', '999999')).rejects.toThrow('Bad code');
  });
});

describe('refresh', () => {
  it('accepts the TOP-LEVEL shape /auth/refresh actually returns', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
      respond({ tokens: { accessToken: 'a', refreshToken: 'stored-refresh' } }),
    );
    await signIn('9877000111', '000000');

    jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
      respond({ accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 }),
    );
    await expect(refresh()).resolves.toBe(true);
    expect(getToken()).toBe('access-2');
  });

  it('still accepts a nested shape, so either server response works', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => respond({ tokens: { accessToken: 'a', refreshToken: 'r' } }));
    await signIn('9877000111', '000000');

    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => respond({ tokens: { accessToken: 'access-3' } }));
    await expect(refresh()).resolves.toBe(true);
    expect(getToken()).toBe('access-3');
  });

  it('reports false when the server rejects the refresh token', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => respond({ tokens: { accessToken: 'a', refreshToken: 'r' } }));
    await signIn('9877000111', '000000');

    jest.spyOn(globalThis, 'fetch').mockImplementation(() => respond({}, false));
    await expect(refresh()).resolves.toBe(false);
  });

  it('reports false rather than throwing when there is no refresh token at all', async () => {
    await expect(refresh()).resolves.toBe(false);
  });

  it('throws OfflineError rather than false when the network is down, so a tunnel never signs anyone out', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => respond({ tokens: { accessToken: 'a', refreshToken: 'r' } }));
    await signIn('9877000111', '000000');

    jest.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new Error('network')));
    await expect(refresh()).rejects.toThrow();
  });
});

describe('multi-gym', () => {
  it('asks the member to choose when the phone maps to several gyms', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
      respond({
        tokens: null,
        tenantChoices: [
          { tenantId: 't1', gymName: 'Iron Temple' },
          { tenantId: 't2', gymName: 'FitZone' },
        ],
      }),
    );
    const res = await signIn('9877000111', '000000');
    expect(res.status).toBe('choose-gym');
    // No scope was chosen, so nothing may be stored yet.
    expect(getToken()).toBeNull();
  });

  it('completes once a gym is picked', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => respond({ tokens: { accessToken: 'scoped', refreshToken: 'r' } }));
    const res = await signIn('9877000111', '000000', 't1');
    expect(res.status).toBe('signed-in');
    expect(getToken()).toBe('scoped');
  });
});

describe('phone helpers', () => {
  it('strips formatting', () => {
    expect(digits('+91 98770 00111')).toBe('919877000111');
  });

  it('assumes +91 when no country code is given', () => {
    expect(toE164('9877000111')).toBe('+919877000111');
  });

  it('does not double-prefix a number that already has 91', () => {
    expect(toE164('919877000111')).toBe('+919877000111');
  });
});
