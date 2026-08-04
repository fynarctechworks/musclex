import type { CheckIn } from '@/types';

export interface CheckInResponse {
  success: boolean;
  check_in?: CheckIn;
  member_name?: string | null;
  member_code?: string | null;
  membership_status?: string | null;
  membership_end_date?: string | null;
  membership_days_remaining?: number | null;
  membership_plan_name?: string | null;
  failure_reason?: string;
  message?: string;
}

export interface FacialCheckInResponse extends CheckInResponse {
  matched_member_id?: string;
  confidence?: number;
}

export interface SyncResult {
  synced: number;
  failed: number;
  /**
   * Per-row outcomes, keyed by the queued row's id (sent as client_event_id).
   * Present on any server new enough to return it; callers must tolerate it
   * being undefined and fall back to keeping the queue intact.
   */
  results?: Array<{
    client_event_id?: string;
    member_id: string;
    ok: boolean;
    /** true = transient, keep and retry. false = server decided, drop it. */
    retryable: boolean;
    reason?: string;
  }>;
}

export interface OfflineCheckIn {
  id: string;
  member_id: string;
  member_name: string;
  branch_id: string;
  checkin_method: string;
  checked_in_at: string;
  class_id?: string;
}

export interface CapacityInfo {
  current: number;
  max: number;
}

export interface VisitAnalytics {
  today_count: number;
  peak_hour: string;
  avg_duration_minutes: number;
  returning_members: number;
}

export interface EntryAlert {
  type: 'expiring' | 'balance' | 'medical' | 'new_member' | 'churn_risk';
  severity: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  member_id?: string;
}
