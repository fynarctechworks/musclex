export type ErrorSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type ErrorStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'IGNORED'
  | 'REOPENED';
export type ErrorSource =
  | 'FRONTEND'
  | 'BACKEND'
  | 'API'
  | 'DATABASE'
  | 'PAYMENT'
  | 'POS'
  | 'BIOMETRIC'
  | 'QR'
  | 'CAMERA'
  | 'AUTH'
  | 'NETWORK'
  | 'SCC';
export type AppEnvironment = 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
export type AlertChannel = 'DASHBOARD' | 'EMAIL' | 'TELEGRAM' | 'WHATSAPP';

export interface SystemError {
  id: string;
  fingerprint: string;
  title: string;
  message: string;
  source: ErrorSource;
  module: string | null;
  severity: ErrorSeverity;
  status: ErrorStatus;
  environment: AppEnvironment;
  occurrence_count: number;
  affected_tenants: number;
  affected_users: number;
  first_seen_at: string;
  last_seen_at: string;
  assigned_to: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  release_id: string | null;
  release?: { version: string; app: string } | null;
  created_at: string;
  updated_at: string;
}

export interface ErrorOccurrence {
  id: string;
  error_id: string;
  tenant_id: string | null;
  user_id: string | null;
  stack_trace: string | null;
  page: string | null;
  api_endpoint: string | null;
  http_status: number | null;
  request_payload: unknown;
  response_payload: unknown;
  breadcrumbs: unknown;
  device_info: Record<string, unknown> | null;
  browser_info: Record<string, unknown> | null;
  ip_address: string | null;
  app_version: string | null;
  environment: AppEnvironment;
  screenshot_url: string | null;
  occurred_at: string;
}

export interface ErrorActivityLog {
  id: string;
  error_id: string;
  admin_id: string | null;
  action: string;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  created_at: string;
}

export interface SystemAlert {
  id: string;
  error_id: string | null;
  severity: ErrorSeverity;
  channel: AlertChannel;
  title: string;
  body: string | null;
  delivered: boolean;
  delivered_at: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  created_at: string;
}

export interface SystemErrorDetail extends SystemError {
  occurrences: ErrorOccurrence[];
  activities: ErrorActivityLog[];
  alerts: SystemAlert[];
}

export interface ErrorStats {
  cards: {
    total_errors: number;
    critical_errors: number;
    active_issues: number;
    api_failures: number;
    frontend_crashes: number;
    database_errors: number;
    resolved_issues: number;
  };
  trend: Array<{ date: string; count: number }>;
  by_severity: Array<{ severity: ErrorSeverity; count: number }>;
}

/** Lightweight payloads pushed over the /monitoring socket. */
export interface LiveErrorEvent {
  error_id: string;
  fingerprint: string;
  title?: string;
  source?: ErrorSource;
  severity: ErrorSeverity;
  environment?: AppEnvironment;
  tenant_id?: string;
  reopened?: boolean;
  kind: 'new' | 'updated' | 'alert';
  at: number;
}
