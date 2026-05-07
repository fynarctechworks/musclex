import { apiClient } from '@/services/api-client';

// ── Staff (Core) ──────────────────────────────────────────

export interface StaffFilters {
  branch_id?: string;
  organization_id?: string;
  role?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const staffApi = {
  list: (filters?: StaffFilters) =>
    apiClient.get('/staff', { params: filters }),

  get: (id: string) =>
    apiClient.get(`/staff/${id}`),

  create: (data: {
    full_name: string;
    role: string;
    phone: string;
    email?: string;
    user_id?: string;
    organization_id?: string;
    branch_id?: string;
    branch_ids?: string[];
    employee_code?: string;
    job_title?: string;
    employment_type?: 'full_time' | 'part_time' | 'contract' | 'freelance';
    specializations?: string[];
    salary?: number;
    joined_at?: string;
  }) => apiClient.post('/staff', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/staff/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/staff/${id}`),

  // Profile
  getProfile: (id: string) =>
    apiClient.get(`/staff/${id}/profile`),

  updateProfile: (id: string, data: {
    bio?: string;
    certifications?: string[];
    specializations?: string[];
    experience_years?: number;
    profile_photo?: string;
    rating?: number;
  }) => apiClient.patch(`/staff/${id}/profile`, data),

  // Availability
  getAvailability: (id: string) =>
    apiClient.get(`/staff/${id}/availability`),

  setAvailability: (id: string, slots: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    availability_type?: 'available' | 'unavailable' | 'tentative';
  }[]) => apiClient.post(`/staff/${id}/availability`, slots),

  // Attendance
  getAttendance: (id: string, filters?: { start_date?: string; end_date?: string; branch_id?: string }) =>
    apiClient.get(`/staff/${id}/attendance`, { params: filters }),

  checkIn: (data: {
    staff_id: string;
    branch_id: string;
    method?: 'biometric' | 'qr' | 'manual' | 'mobile';
    check_in_time?: string;
    notes?: string;
  }) => apiClient.post('/staff/attendance/check-in', data),

  checkOut: (attendanceId: string) =>
    apiClient.patch(`/staff/attendance/${attendanceId}/check-out`),
};

// ── Shifts ────────────────────────────────────────────────

export interface ShiftFilters {
  staff_id?: string;
  branch_id?: string;
  start_date?: string;
  end_date?: string;
}

export const shiftsApi = {
  list: (filters?: ShiftFilters) =>
    apiClient.get('/staff/shifts', { params: filters }),

  create: (data: {
    staff_id: string;
    branch_id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    shift_type?: 'regular' | 'overtime' | 'split';
    notes?: string;
  }) => apiClient.post('/staff/shifts', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/staff/shifts/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/staff/shifts/${id}`),
};

// ── Leaves ────────────────────────────────────────────────

export interface LeaveFilters {
  staff_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export const leavesApi = {
  list: (filters?: LeaveFilters) =>
    apiClient.get('/staff/leaves', { params: filters }),

  create: (data: {
    staff_id: string;
    leave_type: 'sick' | 'vacation' | 'personal' | 'unpaid';
    start_date: string;
    end_date: string;
    reason?: string;
  }) => apiClient.post('/staff/leaves', data),

  review: (id: string, data: { status: 'approved' | 'rejected'; reviewer_notes?: string }) =>
    apiClient.patch(`/staff/leaves/${id}/review`, data),

  cancel: (id: string) =>
    apiClient.post(`/staff/leaves/${id}/cancel`),
};

// ── Trainers ──────────────────────────────────────────────

export const trainersApi = {
  assignClient: (data: {
    trainer_id: string;
    member_id: string;
    notes?: string;
    status?: 'active' | 'paused';
  }) => apiClient.post('/trainer/assign-client', data),

  getClients: (trainerId: string, status?: string) =>
    apiClient.get(`/trainer/${trainerId}/clients`, { params: status ? { status } : undefined }),

  updateAssignment: (assignmentId: string, status: string) =>
    apiClient.patch(`/trainer/clients/${assignmentId}`, undefined, { params: { status } }),

  createSession: (data: {
    trainer_id: string;
    member_id: string;
    branch_id: string;
    session_date: string;
    session_duration: number;
    session_type?: 'personal_training' | 'group_training' | 'rehab_session' | 'assessment';
    notes?: string;
  }) => apiClient.post('/trainer/sessions', data),

  listSessions: (filters?: {
    trainer_id?: string;
    member_id?: string;
    branch_id?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get('/trainer/sessions', { params: filters }),

  updateSession: (id: string, data: { status?: string; notes?: string }) =>
    apiClient.patch(`/trainer/sessions/${id}`, data),

  allPerformance: (filters?: { branch_id?: string; organization_id?: string }) =>
    apiClient.get('/trainer/performance', { params: filters }),

  dashboard: (trainerId: string) =>
    apiClient.get(`/trainer/${trainerId}/dashboard`),

  recordSnapshot: (trainerId: string, periodStart: string, periodEnd: string) =>
    apiClient.post(`/trainer/${trainerId}/performance-snapshot`, undefined, {
      params: { period_start: periodStart, period_end: periodEnd },
    }),

  performanceHistory: (trainerId: string, filters?: { start_date?: string; end_date?: string }) =>
    apiClient.get(`/trainer/${trainerId}/performance-history`, { params: filters }),
};

// ── Invites ──────────────────────────────────────────────

export const invitesApi = {
  send: (staffId: string, data: {
    role_name: string;
    branch_id?: string;
    permission_overrides?: { grants?: string[]; denials?: string[] };
  }) => apiClient.post(`/staff/${staffId}/invite`, data),

  list: (filters?: { status?: string }) =>
    apiClient.get('/staff/invites', { params: filters }),

  resend: (inviteId: string) =>
    apiClient.post(`/staff/invites/${inviteId}/resend`),

  revoke: (inviteId: string) =>
    apiClient.delete(`/staff/invites/${inviteId}`),

  // Public endpoints (no auth)
  getByToken: (token: string) =>
    apiClient.get(`/staff-invites/${token}`),

  accept: (data: { token: string; password: string; full_name?: string }) =>
    apiClient.post('/staff-invites/accept', data),
};

// ── Permission Overrides ─────────────────────────────────

export const permissionsApi = {
  get: (staffId: string) =>
    apiClient.get(`/staff/${staffId}/permissions`),

  update: (staffId: string, data: { grants?: string[]; denials?: string[] }) =>
    apiClient.put(`/staff/${staffId}/permissions`, data),

  updateBranchAccess: (staffId: string, branch_ids: string[]) =>
    apiClient.patch(`/staff/${staffId}/branch-access`, { branch_ids }),
};

// ── Staff Access Management ──────────────────────────────

export const staffAccessApi = {
  resetPassword: (staffId: string, password: string) =>
    apiClient.post(`/staff/${staffId}/reset-password`, { password }),

  revokeAllAccess: (staffId: string, deleteAuthUser: boolean = false) =>
    apiClient.delete(`/staff/${staffId}/access${deleteAuthUser ? '?delete_auth_user=true' : ''}`),
};

// ── Payroll ───────────────────────────────────────────────

export const payrollApi = {
  getConfig: (staffId: string) =>
    apiClient.get(`/payroll/config/${staffId}`),

  upsertConfig: (data: {
    staff_id: string;
    salary_type?: 'fixed' | 'commission' | 'hybrid';
    base_salary?: number;
    commission_percentage?: number;
    bonus_structure?: Record<string, unknown>;
  }) => apiClient.post('/payroll/config', data),

  summary: (filters?: { branch_id?: string; organization_id?: string }) =>
    apiClient.get('/payroll/summary', { params: filters }),

  process: (data: {
    staff_id: string;
    salary_period_start: string;
    salary_period_end: string;
    bonus?: number;
    deductions?: number;
    notes?: string;
  }) => apiClient.post('/payroll/process', data),

  listRecords: (filters?: {
    staff_id?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get('/payroll/records', { params: filters }),

  updateRecord: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/payroll/records/${id}`, data),

  trainerRevenue: (filters?: {
    trainer_id?: string;
    branch_id?: string;
    start_date?: string;
    end_date?: string;
  }) => apiClient.get('/payroll/revenue', { params: filters }),
};
