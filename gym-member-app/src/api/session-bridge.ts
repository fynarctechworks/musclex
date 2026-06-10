import type { TokenPair } from './types';

/**
 * Decouples the API client from the auth store to avoid a circular import
 * (auth-store → client for refresh; client → auth-store for tokens). The auth
 * store registers its current tokens + callbacks here; the client only reads
 * this bridge. There is exactly one session at a time.
 */
type Listener = (tokens: TokenPair | null) => void;

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onExpired: (() => void) | null = null;
const listeners = new Set<Listener>();

export const sessionBridge = {
  get accessToken() {
    return accessToken;
  },
  get refreshToken() {
    return refreshToken;
  },
  setTokens(tokens: TokenPair | null) {
    accessToken = tokens?.accessToken ?? null;
    refreshToken = tokens?.refreshToken ?? null;
    listeners.forEach((l) => l(tokens));
  },
  /** Called by the client when refresh fails — store should sign the member out. */
  setOnExpired(cb: () => void) {
    onExpired = cb;
  },
  notifyExpired() {
    onExpired?.();
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
