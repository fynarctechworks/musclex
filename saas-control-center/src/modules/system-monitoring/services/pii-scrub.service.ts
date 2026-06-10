import { Injectable } from '@nestjs/common';

/**
 * Server-side PII/secret scrubbing. Runs on every ingested payload regardless of
 * what the client masked, so secrets never land in the error store or logs.
 *
 * Strategy:
 *  - Object keys matching SENSITIVE_KEY are replaced with '[REDACTED]'.
 *  - String values are scanned for bearer tokens / long secret-like blobs.
 *  - Recursion is depth- and size-bounded so a hostile/huge payload can't OOM us.
 */
@Injectable()
export class PiiScrubService {
  /** Keys whose values are always redacted (case-insensitive substring match). */
  private static readonly SENSITIVE_KEY =
    /pass(word)?|secret|token|authorization|auth|api[-_]?key|cookie|session|card|cvv|cvc|pin|otp|ssn|aadhaar|pan\b|account[-_]?number/i;

  private static readonly REDACTED = '[REDACTED]';
  private static readonly MAX_DEPTH = 8;
  private static readonly MAX_STRING = 8000;
  /** Serialized payload cap (~32 KB) — anything larger is dropped, not stored. */
  private static readonly MAX_SERIALIZED_BYTES = 32 * 1024;

  /** Bearer tokens, JWTs, and long opaque secret blobs embedded in strings. */
  private static readonly TOKEN_IN_STRING =
    /\b(bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi;
  private static readonly JWT = /\beyJ[A-Za-z0-9._-]{10,}/g;

  scrubString(value: string): string {
    let out = value.length > PiiScrubService.MAX_STRING
      ? value.slice(0, PiiScrubService.MAX_STRING) + '…[truncated]'
      : value;
    out = out.replace(PiiScrubService.TOKEN_IN_STRING, '$1[REDACTED]');
    out = out.replace(PiiScrubService.JWT, '[REDACTED_JWT]');
    return out;
  }

  /**
   * Returns a scrubbed deep copy of an arbitrary JSON-ish value, or undefined
   * when the input is nullish or exceeds the serialized size cap.
   */
  scrub<T = unknown>(input: T, depth = 0): unknown {
    if (input === null || input === undefined) return undefined;

    if (depth === 0) {
      try {
        const size = Buffer.byteLength(JSON.stringify(input) ?? '');
        if (size > PiiScrubService.MAX_SERIALIZED_BYTES) {
          return { _dropped: 'payload exceeded 32KB limit' };
        }
      } catch {
        // Non-serializable (circular, BigInt, etc.) — don't store it.
        return { _dropped: 'payload not serializable' };
      }
    }

    if (depth > PiiScrubService.MAX_DEPTH) return '[MAX_DEPTH]';

    if (typeof input === 'string') return this.scrubString(input);
    if (typeof input === 'number' || typeof input === 'boolean') return input;

    if (Array.isArray(input)) {
      return input.map((item) => this.scrub(item, depth + 1));
    }

    if (typeof input === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
        if (PiiScrubService.SENSITIVE_KEY.test(key)) {
          out[key] = PiiScrubService.REDACTED;
        } else {
          out[key] = this.scrub(val, depth + 1);
        }
      }
      return out;
    }

    // functions, symbols, bigint → drop
    return undefined;
  }
}
