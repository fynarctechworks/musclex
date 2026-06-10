import { ErrorSeverity } from '@prisma/client';

/** Result of ingesting a single error event into the grouping pipeline. */
export interface IngestedGroup {
  fingerprint: string;
  error_id: string;
  is_new: boolean;
  reopened: boolean;
}

export interface IngestResult {
  received: number;
  stored: number;
  groups: IngestedGroup[];
}

/** Dashboard summary cards. */
export interface ErrorStatsCards {
  total_errors: number;
  critical_errors: number;
  active_issues: number;
  api_failures: number;
  frontend_crashes: number;
  database_errors: number;
  resolved_issues: number;
}

export interface ErrorTrendPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface ErrorStats {
  cards: ErrorStatsCards;
  trend: ErrorTrendPoint[];
  by_severity: Array<{ severity: ErrorSeverity; count: number }>;
}

/** Severity ordering used to escalate a group's severity to the worst seen. */
export const SEVERITY_RANK: Record<ErrorSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};
