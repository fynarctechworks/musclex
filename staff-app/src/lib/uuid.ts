/**
 * RFC 4122 v4 UUID generator.
 *
 * `crypto.randomUUID` does NOT exist in React Native's Hermes runtime. Relying
 * on it with a loose fallback produced a non-UUID idempotency key, which the
 * backend rejected with "client_event_id must be a UUID" — a failure only a
 * real round-trip surfaces, since the fallback looked fine locally.
 *
 * Math.random is adequate here: these are idempotency and correlation keys used
 * to de-duplicate a user's own retries, not secrets. Anything security-bearing
 * must come from a CSPRNG instead.
 */
export function uuidv4(): string {
  // Use the platform's implementation when it genuinely exists (web, newer
  // runtimes) — it is faster and better-distributed.
  const native = globalThis.crypto?.randomUUID;
  if (typeof native === 'function') return native.call(globalThis.crypto);

  const hex: string[] = [];
  for (let i = 0; i < 256; i++) hex[i] = (i + 0x100).toString(16).slice(1);

  const r = new Array<number>(16);
  for (let i = 0; i < 16; i++) r[i] = Math.floor(Math.random() * 256);

  // Version 4 and RFC 4122 variant bits.
  r[6] = (r[6] & 0x0f) | 0x40;
  r[8] = (r[8] & 0x3f) | 0x80;

  return (
    hex[r[0]] + hex[r[1]] + hex[r[2]] + hex[r[3]] + '-' +
    hex[r[4]] + hex[r[5]] + '-' +
    hex[r[6]] + hex[r[7]] + '-' +
    hex[r[8]] + hex[r[9]] + '-' +
    hex[r[10]] + hex[r[11]] + hex[r[12]] + hex[r[13]] + hex[r[14]] + hex[r[15]]
  );
}
