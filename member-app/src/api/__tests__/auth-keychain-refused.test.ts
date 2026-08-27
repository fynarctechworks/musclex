/**
 * A KEYCHAIN THAT REFUSES TO STORE must not end the session.
 *
 * The bug this pins made sign-in look like it silently bounced. On a build
 * whose entitlements are missing — which every plain simulator build is —
 * SecureStore throws "A required entitlement isn't present" on every write, so
 * `put` returned false and nothing was saved.
 *
 * That was survivable while `restoreSession` only ran at launch. It stopped
 * being survivable once the root layout could remount mid-session: the remount
 * re-ran the restore, read null, and reset a signed-in member to signed-out,
 * so the gate sent them back to sign-in the instant they left it. Sign-in
 * itself was working perfectly the whole time — the token was simply thrown
 * away a few milliseconds later.
 *
 * The same refusal happens for real on a locked device and after a restore
 * from backup, so this is not a simulator-only concern. A refused write may
 * cost persistence across a RESTART. It may never cost the session in hand.
 */

const mockRefused = () => Promise.reject(new Error("A required entitlement isn't present."));

jest.mock('../supabase', () => ({
  supabase: () => null,
  otpConfigured: () => false,
}));

// Every write is refused and every read comes back empty — the exact behaviour
// of SecureStore in a build with no keychain entitlement.
jest.mock('expo-secure-store', () => ({
  setItemAsync: () => mockRefused(),
  getItemAsync: () => Promise.resolve(null),
  deleteItemAsync: () => Promise.resolve(),
}));

import { refresh, restoreSession, signIn, signOut } from '../auth';
import { getToken } from '../client';

const respond = (body: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 401, json: () => Promise.resolve(body) } as Response);

beforeEach(async () => {
  await signOut();
  jest.restoreAllMocks();
});

it('signs in even though every keychain write is refused', async () => {
  jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
    respond({ tokens: { accessToken: 'access-1', refreshToken: 'refresh-1' } }),
  );

  await expect(signIn('9877000111', '000000')).resolves.toEqual({ status: 'signed-in' });
  expect(getToken()).toBe('access-1');
});

it('restores that session on a remount, which is what bounced the member', async () => {
  jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
    respond({ tokens: { accessToken: 'access-1', refreshToken: 'refresh-1' } }),
  );
  await signIn('9877000111', '000000');

  // The root layout remounting re-runs exactly this. Before the fix it read
  // null from the refused keychain and returned false, and the gate treated
  // that as a sign-out.
  await expect(restoreSession()).resolves.toBe(true);
  expect(getToken()).toBe('access-1');
});

it('can still refresh, so the session survives past the access-token lifetime', async () => {
  jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
    respond({ tokens: { accessToken: 'access-1', refreshToken: 'refresh-1' } }),
  );
  await signIn('9877000111', '000000');

  // The refresh token was refused by the keychain too; without a mirror there
  // is nothing to present here and the member is signed out every 15 minutes.
  jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
    respond({ accessToken: 'access-2', refreshToken: 'refresh-2' }),
  );
  await expect(refresh()).resolves.toBe(true);
  expect(getToken()).toBe('access-2');
});

it('signing out really ends it — the mirror is cleared with the keychain', async () => {
  jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
    respond({ tokens: { accessToken: 'access-1', refreshToken: 'refresh-1' } }),
  );
  await signIn('9877000111', '000000');
  await signOut();

  // A mirror that outlived signOut would restore a signed-out member on the
  // next remount, which is the same bug pointing the other way.
  await expect(restoreSession()).resolves.toBe(false);
  expect(getToken()).toBeNull();
});
