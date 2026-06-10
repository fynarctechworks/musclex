import { reportEvent, type ReportEvent } from './reporter';

/**
 * Error sources for the SCC Error Center. Use these when capturing
 * domain-specific failures so they group + filter correctly in the dashboard.
 */
export const Source = {
  FRONTEND: 'FRONTEND',
  API: 'API',
  NETWORK: 'NETWORK',
  AUTH: 'AUTH',
  QR: 'QR',
  CAMERA: 'CAMERA',
  BIOMETRIC: 'BIOMETRIC',
  POS: 'POS',
  PAYMENT: 'PAYMENT',
} as const;

export type Source = (typeof Source)[keyof typeof Source];

function getTenantContext(): { tenant_id?: string; user_id?: string } {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return {};
    const state = JSON.parse(raw)?.state ?? {};
    return {
      tenant_id: state.studioSlug || state.studio?.slug || undefined,
      user_id: state.user?.id || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Capture an error against a specific source/module. Severity defaults to HIGH
 * for hardware/payment sources (POS/PAYMENT/BIOMETRIC) and MEDIUM otherwise.
 */
export function captureError(
  source: Source,
  error: unknown,
  context: Partial<ReportEvent> = {},
): void {
  const err = error as { message?: string; stack?: string } | string;
  const message =
    typeof err === 'string' ? err : err?.message || 'Unknown error';
  const stack = typeof err === 'string' ? undefined : err?.stack;

  const defaultSeverity: ReportEvent['severity'] =
    source === 'PAYMENT' || source === 'POS' ? 'CRITICAL' : 'HIGH';

  reportEvent({
    source,
    message,
    stack_trace: stack,
    severity: defaultSeverity,
    ...getTenantContext(),
    ...context,
  });
}

/** Convenience used by the API client for failed server responses. */
export function captureApiFailure(input: {
  endpoint: string;
  method: string;
  status: number;
  message: string;
  correlationId?: string;
}): void {
  reportEvent({
    source: input.status === 401 || input.status === 403 ? Source.AUTH : Source.API,
    message: `${input.method} ${input.endpoint} → ${input.status}: ${input.message}`,
    api_endpoint: `${input.method} ${input.endpoint}`,
    http_status: input.status,
    severity: input.status >= 500 ? 'HIGH' : 'MEDIUM',
    breadcrumbs: input.correlationId
      ? { correlation_id: input.correlationId }
      : undefined,
    ...getTenantContext(),
  });
}
