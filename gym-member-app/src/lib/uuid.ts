import * as Crypto from 'expo-crypto';

/** RFC4122 v4 UUID — used for offline idempotency keys (TRD §8). */
export function uuid(): string {
  return Crypto.randomUUID();
}
