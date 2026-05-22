import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

/**
 * Signed QR token formats
 *
 * Static (permanent member card / printed QR):
 *   `mxqr.v1.<b64url(payload)>.<b64url(hmac)>`
 *   payload = { mid, sid, ver, typ: 'static' }
 *
 * Dynamic (member mobile app, TOTP-style 30-second rolling):
 *   `mxqr.v1d.<b64url(payload)>.<b64url(hmac)>`
 *   payload = { mid, sid, jti, iat, exp, typ: 'dynamic' }
 *
 * Verification is HMAC-SHA256 with a 256-bit secret loaded from env.
 * `qr_version` mismatch invalidates the token even with a valid signature
 * — that's the rotation mechanism.
 *
 * Both compares use `timingSafeEqual` to avoid sig-recovery side channels.
 */

const STATIC_PREFIX = 'mxqr.v1.';
const DYNAMIC_PREFIX = 'mxqr.v1d.';
const DEFAULT_DYNAMIC_TTL_SEC = 35; // 30s window + 5s clock skew grace
const CLOCK_SKEW_GRACE_SEC = 5;

export type SignedQrKind = 'static' | 'dynamic';

export interface StaticQrPayload {
  mid: string; // member_id
  sid: string; // studio_id
  ver: number; // qr_version
  typ: 'static';
}

export interface DynamicQrPayload {
  mid: string;
  sid: string;
  jti: string; // unique per token; the replay nonce key
  iat: number; // unix seconds
  exp: number; // unix seconds
  typ: 'dynamic';
}

export type SignedQrPayload = StaticQrPayload | DynamicQrPayload;

export type QrVerifyResult =
  | { ok: true; kind: SignedQrKind; payload: SignedQrPayload; raw_token: string }
  | { ok: false; reason: string };

@Injectable()
export class QrTokenService implements OnModuleInit {
  private readonly logger = new Logger(QrTokenService.name);
  private secret!: Buffer;
  private isFallbackSecret = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const fromEnv = this.config.get<string>('QR_SIGNING_SECRET');
    if (fromEnv && fromEnv.length >= 32) {
      this.secret = Buffer.from(fromEnv, 'utf8');
      this.isFallbackSecret = false;
      return;
    }

    // Per-process random fallback so DEV environments don't crash on first
    // boot. PROD must set QR_SIGNING_SECRET — we warn loudly.
    this.secret = randomBytes(32);
    this.isFallbackSecret = true;
    this.logger.warn(
      'QR_SIGNING_SECRET not set or too short — generated a per-process random secret. ' +
        'All signed QR tokens will be invalidated on restart. Set QR_SIGNING_SECRET (>=32 chars) in production.',
    );
  }

  /** Returns true if running on an ephemeral dev secret. */
  isUsingFallbackSecret(): boolean {
    return this.isFallbackSecret;
  }

  /**
   * Detect whether a string is one of our signed token formats.
   * Used by the orchestrator to decide: signed flow vs legacy UUID lookup.
   */
  isSignedToken(value: string): boolean {
    return value.startsWith(STATIC_PREFIX) || value.startsWith(DYNAMIC_PREFIX);
  }

  // ── Static (permanent) ──────────────────────────────────────────

  signStatic(input: { member_id: string; studio_id: string; qr_version: number }): string {
    const payload: StaticQrPayload = {
      mid: input.member_id,
      sid: input.studio_id,
      ver: input.qr_version,
      typ: 'static',
    };
    return this.encode(STATIC_PREFIX, payload);
  }

  // ── Dynamic (rolling) ───────────────────────────────────────────

  signDynamic(input: {
    member_id: string;
    studio_id: string;
    ttl_sec?: number;
  }): { token: string; jti: string; iat: number; exp: number } {
    const iat = Math.floor(Date.now() / 1000);
    const ttl = input.ttl_sec ?? DEFAULT_DYNAMIC_TTL_SEC;
    const exp = iat + ttl;
    const jti = randomBytes(16).toString('hex'); // 128-bit nonce

    const payload: DynamicQrPayload = {
      mid: input.member_id,
      sid: input.studio_id,
      jti,
      iat,
      exp,
      typ: 'dynamic',
    };

    return { token: this.encode(DYNAMIC_PREFIX, payload), jti, iat, exp };
  }

  // ── Verify ──────────────────────────────────────────────────────

  verify(token: string): QrVerifyResult {
    if (typeof token !== 'string') return { ok: false, reason: 'not_a_string' };

    let kind: SignedQrKind;
    let prefix: string;
    if (token.startsWith(STATIC_PREFIX)) {
      kind = 'static';
      prefix = STATIC_PREFIX;
    } else if (token.startsWith(DYNAMIC_PREFIX)) {
      kind = 'dynamic';
      prefix = DYNAMIC_PREFIX;
    } else {
      return { ok: false, reason: 'unknown_format' };
    }

    const rest = token.slice(prefix.length);
    const lastDot = rest.lastIndexOf('.');
    if (lastDot <= 0) return { ok: false, reason: 'malformed' };

    const payloadB64 = rest.slice(0, lastDot);
    const sigB64 = rest.slice(lastDot + 1);
    if (!payloadB64 || !sigB64) return { ok: false, reason: 'malformed' };

    let payload: SignedQrPayload;
    try {
      const payloadJson = Buffer.from(b64urlToBase64(payloadB64), 'base64').toString('utf8');
      payload = JSON.parse(payloadJson);
    } catch {
      return { ok: false, reason: 'bad_payload_json' };
    }

    if (kind === 'static' && payload.typ !== 'static') return { ok: false, reason: 'type_mismatch' };
    if (kind === 'dynamic' && payload.typ !== 'dynamic') return { ok: false, reason: 'type_mismatch' };

    let sig: Buffer;
    try {
      sig = Buffer.from(b64urlToBase64(sigB64), 'base64');
    } catch {
      return { ok: false, reason: 'bad_signature_b64' };
    }

    const expected = this.hmac(`${prefix}${payloadB64}`);
    if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
      return { ok: false, reason: 'bad_signature' };
    }

    if (kind === 'dynamic') {
      const dyn = payload as DynamicQrPayload;
      const now = Math.floor(Date.now() / 1000);
      if (dyn.exp + CLOCK_SKEW_GRACE_SEC < now) {
        return { ok: false, reason: 'expired' };
      }
      if (dyn.iat - CLOCK_SKEW_GRACE_SEC > now) {
        return { ok: false, reason: 'future_iat' };
      }
    }

    return { ok: true, kind, payload, raw_token: token };
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private encode(prefix: string, payload: SignedQrPayload): string {
    const json = JSON.stringify(payload);
    const payloadB64 = base64ToB64url(Buffer.from(json, 'utf8').toString('base64'));
    const sig = this.hmac(`${prefix}${payloadB64}`);
    const sigB64 = base64ToB64url(sig.toString('base64'));
    return `${prefix}${payloadB64}.${sigB64}`;
  }

  private hmac(input: string): Buffer {
    return createHmac('sha256', this.secret).update(input).digest();
  }
}

function base64ToB64url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBase64(b64url: string): string {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad === 2) b64 += '==';
  else if (pad === 3) b64 += '=';
  else if (pad === 1) throw new Error('invalid base64url');
  return b64;
}
