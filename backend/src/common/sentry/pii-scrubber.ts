/**
 * PII scrubber shared by backend Sentry init (and mirrored in frontend).
 * Drops/redacts sensitive keys before events leave the process.
 *
 * Per docs/16-monitoring-setup-prompt + CLAUDE.md: errors must be debuggable
 * but must NOT leak customer data into a third-party service.
 */

const SENSITIVE_KEYS = new Set<string>([
  // auth / secrets
  'password',
  'currentpassword',
  'newpassword',
  'otp',
  'token',
  'refresh_token',
  'refreshtoken',
  'access_token',
  'accesstoken',
  'apikey',
  'api_key',
  'secret',
  'webhooksecret',
  'jwt',
  'razorpay_signature',
  'stripe_signature',
  'x-api-key',
  'x-csrf-token',
  // payment
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'pan',
  'upi_vpa',
  'account_number',
  'ifsc',
  'gateway_response',
  'webhook_payload',
  // member PII
  'email',
  'phone',
  'mobile',
  'dob',
  'date_of_birth',
  'address',
  'aadhaar',
  'ssn',
  'biometric_template',
  'face_descriptor',
  'qr_token',
  'profile_photo_url',
]);

const REDACTED = '[Redacted]';

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? REDACTED : scrubValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    // Allow relative URLs by giving a base
    const u = new URL(url, 'http://placeholder.local');
    const params = u.searchParams;
    let mutated = false;
    for (const key of Array.from(params.keys())) {
      if (isSensitiveKey(key)) {
        params.set(key, REDACTED);
        mutated = true;
      }
    }
    if (!mutated) return url;
    // Return reconstructed path+query (drop synthetic origin if it was relative)
    if (url.startsWith('http')) return u.toString();
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return url;
  }
}

export function scrubSentryEvent(event: any): any {
  if (!event) return event;

  // Request payload
  if (event.request) {
    if (event.request.data) {
      event.request.data = scrubValue(event.request.data);
    }
    if (event.request.headers) {
      event.request.headers = scrubValue(event.request.headers);
    }
    if (event.request.cookies) {
      event.request.cookies = REDACTED;
    }
    if (event.request.query_string && typeof event.request.query_string === 'string') {
      event.request.query_string = scrubUrl(`?${event.request.query_string}`)?.replace(/^\?/, '');
    }
    if (event.request.url) {
      event.request.url = scrubUrl(event.request.url);
    }
  }

  // Extra / contexts
  if (event.extra) event.extra = scrubValue(event.extra);
  if (event.contexts) event.contexts = scrubValue(event.contexts);

  // Breadcrumbs
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((bc: any) => ({
      ...bc,
      data: bc?.data ? scrubValue(bc.data) : bc?.data,
    }));
  }

  // Stack frame vars
  const frames = event.exception?.values?.flatMap((v: any) => v?.stacktrace?.frames ?? []) ?? [];
  for (const frame of frames) {
    if (frame?.vars) frame.vars = scrubValue(frame.vars);
  }

  return event;
}

export function scrubSentryBreadcrumb(breadcrumb: any): any {
  if (!breadcrumb) return breadcrumb;
  if (breadcrumb.data) breadcrumb.data = scrubValue(breadcrumb.data);
  return breadcrumb;
}
