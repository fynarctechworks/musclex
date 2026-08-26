/**
 * ────────────────────────────────────────────────────────────────
 * SCAN GATE — turning a camera stream into at most one check-in
 * ────────────────────────────────────────────────────────────────
 *
 * `onBarcodeScanned` fires continuously while a code is in frame — on the
 * order of ten times a second. A member holding their phone up for two
 * seconds is therefore twenty scan events, and without a gate that is twenty
 * POSTs: twenty visits, twenty consumed class credits, twenty rows in the
 * attendance report.
 *
 * `client_event_id` protects against a retry of the SAME attempt, but each of
 * those twenty would be a fresh attempt with a fresh key, so idempotency does
 * not help here. The duplicate has to be stopped before it becomes a request.
 *
 * Two rules, and they are different rules:
 *
 *  - `busy` — one in-flight submission at a time. Cleared when it settles.
 *  - `cooldown` — after a code resolves, that SAME code is ignored for a
 *    while, so the card still sitting in frame does not immediately re-fire.
 *    Keyed by the code itself, so the next member in the queue is never
 *    made to wait for somebody else's cooldown.
 *
 * Kept as a plain class with an injected clock so the timing rules can be
 * tested without a camera or a real two-second wait.
 */

/** How long the same code stays ignored after it has been handled. */
export const SCAN_COOLDOWN_MS = 4000;

/** Bound on remembered codes, so a long kiosk shift cannot grow unboundedly. */
const MAX_REMEMBERED = 64;

export class ScanGate {
  private busy = false;
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly cooldownMs: number = SCAN_COOLDOWN_MS,
  ) {}

  /**
   * Claim the right to submit `code`, or refuse.
   *
   * Returns true AT MOST ONCE per code per cooldown window, and never while
   * another submission is in flight. The caller MUST call `release()` when the
   * submission settles — success or failure — or the gate stays shut.
   */
  claim(code: string): boolean {
    if (this.busy) return false;

    const t = this.now();
    const last = this.seen.get(code);
    if (last !== undefined && t - last < this.cooldownMs) return false;

    this.busy = true;
    this.seen.set(code, t);
    this.prune(t);
    return true;
  }

  /** Submission settled. Frees the gate for the next code. */
  release(): void {
    this.busy = false;
  }

  /**
   * Forget a code so it can be scanned again immediately.
   *
   * Used when a scan failed for a reason a re-scan could genuinely fix — no
   * signal, or a server hiccup. A rejected code (revoked, wrong gym, already
   * used) is NOT forgotten: rescanning it would just fail again, and the
   * cooldown is what stops that failure repeating ten times a second.
   */
  forget(code: string): void {
    this.seen.delete(code);
  }

  private prune(now: number): void {
    if (this.seen.size <= MAX_REMEMBERED) return;
    for (const [code, t] of this.seen) {
      if (now - t >= this.cooldownMs) this.seen.delete(code);
    }
    // Still oversized means everything is inside its window; drop oldest first.
    while (this.seen.size > MAX_REMEMBERED) {
      const oldest = this.seen.keys().next();
      if (oldest.done) break;
      this.seen.delete(oldest.value);
    }
  }
}

/**
 * Does this look like one of our check-in QR codes?
 *
 * Deliberately shallow. The server verifies the HMAC, the gym and the replay
 * nonce, and it is the only thing that can — we hold no signing secret. This
 * exists ONLY so that pointing the scanner at a random product barcode gives
 * "not a MuscleX code" instead of a round trip and a server rejection.
 *
 * It must never be treated as validation. Anything that passes here is still
 * entirely at the server's mercy, which is the correct arrangement.
 */
export function looksLikeMemberCode(raw: string): boolean {
  const text = (raw ?? '').trim();
  if (!text) return false;
  // Signed tokens, static and dynamic.
  if (/^mxqr\.v1d?\./.test(text)) return true;
  // Legacy raw-UUID cards, still valid until every member is rotated.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);
}
