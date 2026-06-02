import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { TokenPair } from '../api/types';

/**
 * Tokens live in the device keychain/keystore (TRD §6 / Checklist §1.2 —
 * "never AsyncStorage"). One blob keyed by TOKENS_KEY. The active tenantId is
 * stored alongside so multi-gym members resume the gym they last chose.
 *
 * Web has no keychain — `expo-secure-store` is unimplemented there and *throws*
 * on every call, which would reject `loadSession()` and hang the splash forever.
 * For the web preview/dev target we fall back to `localStorage`. This is NOT a
 * secure store; web is for local development/design preview only, never the
 * shipping member surface (the app ships as a native dev/standalone build).
 */
const TOKENS_KEY = 'fitsync.tokens.v1';
const TENANT_KEY = 'fitsync.tenant.v1';

const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export interface StoredSession {
  tokens: TokenPair;
  tenantId: string | null;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await setItem(TOKENS_KEY, JSON.stringify(session.tokens));
  if (session.tenantId) {
    await setItem(TENANT_KEY, session.tenantId);
  }
}

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await getItem(TOKENS_KEY);
  if (!raw) return null;
  try {
    const tokens = JSON.parse(raw) as TokenPair;
    const tenantId = await getItem(TENANT_KEY);
    return { tokens, tenantId: tenantId ?? null };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await deleteItem(TOKENS_KEY);
  await deleteItem(TENANT_KEY);
}
