import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_BASE, OfflineError, setToken } from './client';
import { otpConfigured, supabase } from './supabase';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER SESSION
 * ────────────────────────────────────────────────────────────────
 *
 * The access token is a gym-scoped member JWT, so it never sits in plain
 * storage: native uses the Keychain/Keystore via SecureStore. SecureStore has
 * no web implementation, so the web build (a dev/preview target only) falls
 * back to localStorage.
 *
 * Sign-in is phone + OTP:
 *   1. POST /auth/otp/request  — the backend asks Supabase to send the code
 *   2. Supabase verifies the code and returns a Supabase access token
 *   3. POST /auth/session      — trades that token for a gym-scoped member session
 *
 * The gym is resolved from the phone number server-side, so members never see
 * a tenant id. A phone that maps to several gyms comes back as `tenantChoices`
 * instead of tokens, and the caller picks one.
 *
 * When Supabase is not configured (no SMS provider on a dev machine) the flow
 * falls back to the backend's dev bypass, which is itself inert unless the
 * server has MEMBER_DEV_OTP set.
 */

/**
 * An in-memory mirror of what SHOULD be in the keychain.
 *
 * `put` is allowed to fail — the keychain is genuinely unavailable on a locked
 * device, after a restore from backup, and in any build whose entitlements are
 * missing (a plain simulator build is exactly that case). It returns false
 * rather than throwing, which is right.
 *
 * What was wrong was treating that as merely "the session will not survive a
 * restart". `restoreSession` is called on every mount of the root layout, not
 * only at launch, so a refused write meant the very next remount read null and
 * signed the member straight back out — sign-in appeared to bounce. Reading
 * through to this mirror keeps a refused write costing only what it should.
 */
const memory: { access?: string; refresh?: string } = {};

const ACCESS = 'musclex.member.access';
const REFRESH = 'musclex.member.refresh';
const TENANT = 'musclex.member.tenant';

/**
 * Neither of these may THROW.
 *
 * The keychain is not guaranteed to be available. It fails when the device is
 * locked and the item needs unlock, after a restore from backup, and — as this
 * was found — in any build whose entitlements are missing. Every one of those
 * used to surface as an unhandled promise rejection from `restoreSession`,
 * which left the Gate waiting on a value that never arrived and pinned the app
 * on the "Signing in" spinner. A member in that state cannot even reach the
 * sign-in screen to recover.
 *
 * So a failed READ means "no value stored", which sends them to sign in — the
 * worst case is signing in again, not a dead app.
 *
 * A failed WRITE is genuinely lossy: the session will not survive a restart and
 * they will sign in every launch. That is still better than crashing, and it is
 * returned rather than swallowed so a caller can say something if it matters.
 */
async function put(key: string, value: string | null): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      if (value) globalThis.localStorage?.setItem(key, value);
      else globalThis.localStorage?.removeItem(key);
      return true;
    }
    if (value) await SecureStore.setItemAsync(key, value);
    else await SecureStore.deleteItemAsync(key);
    return true;
  } catch {
    return false;
  }
}

async function read(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export interface Tokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

async function persist(tokens: Tokens, tenantId?: string) {
  setToken(tokens.accessToken);
  // Held regardless of whether the keychain accepts it, so a refused write
  // costs persistence across a RESTART, never the session in hand.
  memory.access = tokens.accessToken;
  if (tokens.refreshToken) memory.refresh = tokens.refreshToken;
  await put(ACCESS, tokens.accessToken);
  if (tokens.refreshToken) await put(REFRESH, tokens.refreshToken);
  if (tenantId) await put(TENANT, tenantId);
}

/** Rehydrate on launch. Returns true when a usable session was restored. */
export async function restoreSession(): Promise<boolean> {
  const access = (await read(ACCESS)) ?? memory.access;
  if (!access) return false;
  setToken(access);
  return true;
}

/** A gym the phone number belongs to, when it belongs to more than one. */
export interface TenantChoice {
  tenantId: string;
  gymName: string;
}

/** Sign-in either completes, or needs the member to pick which gym they mean. */
export type SignInResult = { status: 'signed-in' } | { status: 'choose-gym'; choices: TenantChoice[] };

/** Ask the backend to send the code. Best-effort in dev, where no SMS goes out. */
export async function requestOtp(phone: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/otp/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: toE164(phone) }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? 'Could not send the code');
  }
}

async function exchange(path: string, payload: unknown, tenantId?: string): Promise<SignInResult> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as Tokens & {
    tokens?: Tokens | null;
    tenantChoices?: TenantChoice[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(body.error?.message ?? 'That code did not work');

  // Several gyms know this number: the caller must pick before we have a scope.
  if (!body.tokens && body.tenantChoices?.length) {
    return { status: 'choose-gym', choices: body.tenantChoices };
  }

  const tokens = body.tokens ?? body;
  if (!tokens?.accessToken) throw new Error('That code did not work');
  await persist(tokens, tenantId);
  return { status: 'signed-in' };
}

/**
 * Exchange a phone + code for a member session.
 *
 * With Supabase configured this is the real flow: the code is verified by
 * Supabase, and its token is traded with our backend. Without it, the backend's
 * dev bypass is used instead — that route 404s in production, so this cannot
 * become a way in on a real server.
 *
 * `tenantId` is only passed when the member has already chosen between gyms.
 */
export async function signIn(
  phone: string,
  code: string,
  tenantId?: string,
): Promise<SignInResult> {
  const sb = supabase();

  if (sb) {
    const { data, error } = await sb.auth.verifyOtp({
      phone: toE164(phone),
      token: code,
      type: 'sms',
    });
    if (error || !data.session?.access_token) {
      throw new Error(error?.message ?? 'That code did not work');
    }
    return exchange('/auth/session', { supabaseToken: data.session.access_token, tenantId }, tenantId);
  }

  return exchange('/auth/dev/session', { phone: digits(phone), code, tenantId }, tenantId);
}

/** Whether real SMS verification is in play, for what the UI tells the member. */
export { otpConfigured };

/**
 * Refresh the access token. Called by the client on a 401, so a member is not
 * bounced to the login screen just because a short-lived token aged out.
 * Returns false when the refresh itself is rejected — that IS a real sign-out.
 */
export async function refresh(): Promise<boolean> {
  const refreshToken = (await read(REFRESH)) ?? memory.refresh;
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    // The two auth routes disagree on shape: /auth/session and /auth/dev/session
    // nest under `tokens`, /auth/refresh returns the tokens at the top level.
    // Accept both — reading only one silently signed members out every 15
    // minutes, which is the access-token lifetime.
    const body = (await res.json()) as Tokens & { tokens?: Tokens };
    const tokens = body.tokens ?? body;
    if (!tokens?.accessToken) return false;
    await persist(tokens);
    return true;
  } catch {
    // Offline. The refresh was never refused, so throwing here keeps the caller
    // from mistaking a tunnel for a revoked session and signing the member out.
    throw new OfflineError();
  }
}

export async function signOut() {
  setToken(null);
  // The mirror is the session as much as the keychain is; clearing one without
  // the other would let a signed-out member be restored on the next mount.
  delete memory.access;
  delete memory.refresh;
  await Promise.all([put(ACCESS, null), put(REFRESH, null), put(TENANT, null)]);
  // Drop the Supabase session too, or the next sign-in silently reuses the
  // previous person's verified phone.
  await supabase()?.auth.signOut().catch(() => {});
}

export const digits = (s: string) => s.replace(/\D/g, '');
/** The OTP endpoint validates E.164; assume +91 when no country code is given. */
export const toE164 = (s: string) => {
  const d = digits(s);
  return d.startsWith('91') && d.length > 10 ? `+${d}` : `+91${d}`;
};
