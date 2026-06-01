/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER BFF RESPONSE ENVELOPE
 * ────────────────────────────────────────────────────────────────
 *
 * Every /member/* success response is wrapped as { data, meta }; errors as
 * { error } (see member-api-v1.openapi.yaml → Envelope / ErrorEnvelope).
 *
 * Success wrapping is applied centrally by EnvelopeInterceptor (added with the
 * first data endpoints); this module defines the shapes + the standard error
 * codes so they stay consistent across controllers.
 */

export interface EnvelopeMeta {
  /** tenant id (Studio UUID) — echoed for client diagnostics, never trusted on input */
  tenantId?: string;
  /** ISO server time */
  serverTime: string;
  /** seconds the client may cache this payload */
  cacheTtl?: number;
}

export interface Envelope<T> {
  data: T;
  meta: EnvelopeMeta;
}

export interface ErrorBody {
  code: string;
  message: string;
  retryable: boolean;
}

export interface ErrorEnvelope {
  error: ErrorBody;
}

/** Canonical error codes surfaced to the member app. */
export enum MemberErrorCode {
  NOT_A_MEMBER = 'NOT_A_MEMBER',
  MEMBERSHIP_EXPIRED = 'MEMBERSHIP_EXPIRED',
  MEMBERSHIP_NOT_FOUND = 'MEMBERSHIP_NOT_FOUND',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TENANT_CHOICE_REQUIRED = 'TENANT_CHOICE_REQUIRED',
  IDEMPOTENCY_KEY_REQUIRED = 'IDEMPOTENCY_KEY_REQUIRED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}

export function buildMeta(partial?: Partial<EnvelopeMeta>): EnvelopeMeta {
  return { serverTime: new Date().toISOString(), ...partial };
}

export function wrap<T>(data: T, meta?: Partial<EnvelopeMeta>): Envelope<T> {
  return { data, meta: buildMeta(meta) };
}
