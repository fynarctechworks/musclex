import * as SecureStore from 'expo-secure-store';
import type { TokenPair } from '../api/types';

/**
 * Tokens live in the device keychain/keystore (TRD §6 / Checklist §1.2 —
 * "never AsyncStorage"). One blob keyed by TOKENS_KEY. The active tenantId is
 * stored alongside so multi-gym members resume the gym they last chose.
 */
const TOKENS_KEY = 'fitsync.tokens.v1';
const TENANT_KEY = 'fitsync.tenant.v1';

export interface StoredSession {
  tokens: TokenPair;
  tenantId: string | null;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(session.tokens));
  if (session.tenantId) {
    await SecureStore.setItemAsync(TENANT_KEY, session.tenantId);
  }
}

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(TOKENS_KEY);
  if (!raw) return null;
  try {
    const tokens = JSON.parse(raw) as TokenPair;
    const tenantId = await SecureStore.getItemAsync(TENANT_KEY);
    return { tokens, tenantId: tenantId ?? null };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKENS_KEY);
  await SecureStore.deleteItemAsync(TENANT_KEY);
}
