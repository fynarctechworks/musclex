import * as SecureStore from 'expo-secure-store';

import type { Session } from './types';

/**
 * Session persistence.
 *
 * Tokens go in expo-secure-store (Keychain/Keystore), NEVER AsyncStorage:
 * a front-desk phone is a shared, frequently-lost device, and AsyncStorage is
 * plain text on disk.
 *
 * The store is intentionally a module-level cache plus SecureStore, not a React
 * context: the API client needs the access token synchronously from outside the
 * component tree, and an async read per request would serialise every call.
 */

const KEY = 'musclex.staff.session';

let cached: Session | null = null;
let loaded = false;

type Listener = (s: Session | null) => void;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(cached);
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Synchronous read. Returns null until `loadSession()` has run once. */
export function getSession(): Session | null {
  return cached;
}

export function isLoaded(): boolean {
  return loaded;
}

/** Hydrate from secure storage. Call once at app start. */
export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    cached = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    // A corrupt or undecryptable blob must not brick the app — treat it as
    // signed out rather than throwing on launch.
    cached = null;
  }
  loaded = true;
  emit();
  return cached;
}

export async function saveSession(session: Session): Promise<void> {
  cached = session;
  emit();
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

/** Patch the in-memory session and persist. No-op when signed out. */
export async function patchSession(patch: Partial<Session>): Promise<void> {
  if (!cached) return;
  await saveSession({ ...cached, ...patch });
}

/**
 * Clear everything. Callers MUST also clear the React Query cache — a cache
 * surviving sign-out or a workspace switch is a cross-tenant leak in the UI
 * even with a correct backend.
 */
export async function clearSession(): Promise<void> {
  cached = null;
  emit();
  await SecureStore.deleteItemAsync(KEY);
}
