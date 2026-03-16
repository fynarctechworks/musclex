import type { CheckIn } from '@/types';

export interface CheckInResponse {
  success: boolean;
  check_in?: CheckIn;
  member_name?: string;
  membership_status?: string;
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
