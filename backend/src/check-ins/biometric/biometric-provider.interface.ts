/**
 * BiometricProvider — adapter contract for any biometric vendor.
 *
 * Concrete providers wrap a vendor SDK (face-api.js on-device, ZKTeco USB,
 * Mantra MFS100, Suprema BioStation, AWS Rekognition cloud, etc.) and
 * expose a uniform shape so the orchestrator can call any of them without
 * vendor-specific code.
 *
 * Phase-2 design called this out explicitly: future-proof for ZKTeco /
 * Mantra / Suprema / USB / cloud without rewriting the matcher.
 *
 * Providers MUST be safe to call from the request path. Long-running
 * vendor I/O (cloud round-trips) should respect a sane timeout.
 *
 * Privacy posture:
 *  - `identify()` receives the raw biometric sample (descriptor, image
 *    bytes, fingerprint template) for matching but the returned
 *    `template_ref` must be an opaque pointer — never the raw template.
 *  - `face_descriptor` on members is stripped from API responses
 *    centrally (StripSecretsInterceptor); providers MUST NOT echo raw
 *    biometric data in `identify`/`enroll` responses.
 */

export type BiometricModality = 'face' | 'fingerprint' | 'iris' | 'palm';

export interface BiometricScope {
  gym_id: string;
  branch_id: string;
}

/**
 * Modality-specific input shape.
 *
 * - face:        128-D descriptor from face-api.js on the client (current).
 *                Future cloud providers may accept image bytes via a
 *                different `kind` on this discriminated union.
 * - fingerprint: vendor-specific template bytes, base64-encoded.
 */
export type BiometricInput =
  | { modality: 'face'; descriptor: number[] }
  | { modality: 'fingerprint'; template_base64: string; vendor: string };

export interface BiometricIdentifyResult {
  member_id: string;
  confidence: number; // 0..1 (1 = perfect match)
  matcher: string; // provider id, e.g. 'face-api-pgvector'
  elapsed_ms: number;
}

export interface BiometricEnrollResult {
  enrollment_id: string;
  template_ref: string; // opaque pointer; never the raw template
}

export interface BiometricProvider {
  /** Stable kebab-case identifier — appears in BiometricEnrollment.provider. */
  readonly id: string;
  /** Which modality this provider serves. */
  readonly modality: BiometricModality;
  /** Display name for UI ("face-api.js (on-device)" / "ZKTeco USB"). */
  readonly label: string;
  /** True if the provider can run today (env / SDK present). */
  isAvailable(): boolean;

  /**
   * 1:N identification. Returns the best matching member within the
   * provider's confidence threshold, or null if no match.
   */
  identify(input: BiometricInput, scope: BiometricScope): Promise<BiometricIdentifyResult | null>;

  /**
   * Enroll a sample for a member. The template itself is the provider's
   * problem to persist (own table for fingerprint vendors; the `face_vec`
   * column on members for face-api). The returned `template_ref` is what
   * gets written to `biometric_enrollments.template_ref` for audit.
   */
  enroll(
    member_id: string,
    input: BiometricInput,
    scope: BiometricScope,
  ): Promise<BiometricEnrollResult>;

  /**
   * Revoke a prior enrollment. Should clear the provider's own template
   * storage. The caller updates `biometric_enrollments.revoked_at`.
   */
  revoke(enrollment_id: string, scope: BiometricScope): Promise<void>;
}

/** Multi-provider injection token (Symbol; NestJS multi-provider pattern). */
export const BIOMETRIC_PROVIDERS = Symbol('BIOMETRIC_PROVIDERS');
