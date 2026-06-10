import { apiClient } from '@/services/api-client';
import type { CheckIn } from '@/types';
import type { CheckInResponse, FacialCheckInResponse, SyncResult } from './types';

export interface CheckInFilters {
  page?: number;
  limit?: number;
  branch_id?: string;
  date_from?: string;
  date_to?: string;
  method?: string;
  member_id?: string;
}

export const checkInsApi = {
  list: (filters?: CheckInFilters) =>
    apiClient.get<{ data: CheckIn[]; total: number }>('/check-ins', { params: filters }),

  create: (data: {
    member_id?: string;
    qr_code?: string;
    branch_id: string;
    checkin_method: string;
    class_id?: string;
    /** UUID v4. If absent, the server generates one. Required for idempotent offline replay. */
    client_event_id?: string;
    source?: string;
    /** Force-allow flag — ignored unless the caller has the `check_ins.override` permission. */
    override_authorized?: boolean;
    override_reason?: string;
  }) => apiClient.post<CheckInResponse>('/check-ins', data),

  facial: (data: { descriptor: number[]; branch_id: string }) =>
    apiClient.post<FacialCheckInResponse>('/check-ins/facial', data),

  getHeatmap: (branchId?: string) =>
    apiClient.get<number[][]>('/check-ins/heatmap', { params: branchId ? { branch_id: branchId } : undefined }),

  sync: (checkIns: Array<{
    member_id: string;
    branch_id: string;
    checkin_method: string;
    checked_in_at: string;
    class_id?: string;
  }>) => apiClient.post<SyncResult>('/check-ins/sync', { check_ins: checkIns }),
};

export interface BiometricEnrollment {
  id: string;
  member_id: string;
  branch_id: string;
  modality: 'face' | 'fingerprint' | 'iris' | 'palm';
  provider_id: string | null;
  enrolled_at: string;
  revoked_at: string | null;
}

export interface BiometricEnrollmentRow {
  id: string;
  member_id: string;
  provider: string;
  modality: 'face' | 'fingerprint' | 'iris' | 'palm';
  enrolled_at: string;
  revoked_at: string | null;
  member: {
    id: string;
    full_name: string;
    member_code: string;
    profile_photo_url: string | null;
    status: string;
  } | null;
}

export interface BiometricProviderInfo {
  id: string;
  modality: 'face' | 'fingerprint' | 'iris' | 'palm';
  label: string;
  available: boolean;
}

export const biometricApi = {
  listForMember: (memberId: string) =>
    apiClient.get<BiometricEnrollment[]>(`/check-ins/biometric/members/${memberId}`),

  listAll: (params?: {
    modality?: 'face' | 'fingerprint' | 'iris' | 'palm';
    include_revoked?: boolean;
  }) =>
    apiClient.get<BiometricEnrollmentRow[]>('/check-ins/biometric/enrollments', {
      params: {
        ...(params?.modality ? { modality: params.modality } : {}),
        ...(params?.include_revoked ? { include_revoked: 'true' } : {}),
      },
    }),

  listProviders: () =>
    apiClient.get<{ providers: BiometricProviderInfo[] }>('/check-ins/biometric/providers'),

  enrollFace: (data: {
    member_id: string;
    branch_id: string;
    descriptor: number[];
    consent_log_id?: string;
  }) =>
    apiClient.post<BiometricEnrollment>('/check-ins/biometric/enroll', {
      member_id: data.member_id,
      branch_id: data.branch_id,
      modality: 'face',
      descriptor: data.descriptor,
      consent_log_id: data.consent_log_id,
    }),

  revoke: (enrollmentId: string, branchId: string) =>
    apiClient.delete<{ success: boolean }>(
      `/check-ins/biometric/enrollments/${enrollmentId}?branch_id=${encodeURIComponent(branchId)}`,
    ),
};

// ── Check-out / open visits ────────────────────────────────────────────────
export const visitsApi = {
  checkOut: (data: {
    member_id?: string;
    check_in_id?: string;
    qr_code?: string;
    branch_id: string;
  }) =>
    apiClient.post<{
      success: boolean;
      check_in?: CheckIn;
      duration_minutes?: number;
      member_name?: string | null;
      member_code?: string | null;
      already_checked_out?: boolean;
      failure_reason?: string;
      message?: string;
    }>('/check-ins/check-out', data),

  listOpen: (branchId: string) =>
    apiClient.get<CheckIn[]>(`/check-ins/open?branch_id=${encodeURIComponent(branchId)}`),
};
