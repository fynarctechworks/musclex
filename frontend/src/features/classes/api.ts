import { apiClient } from '@/services/api-client';

// ── Classes (Core) ────────────────────────────────────────

export interface ClassFilters {
  branch_id?: string;
  trainer_id?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const classesApi = {
  list: (filters?: ClassFilters) =>
    apiClient.get('/classes', { params: filters }),

  get: (id: string) =>
    apiClient.get(`/classes/${id}`),

  create: (data: {
    branch_id: string;
    trainer_id: string;
    substitute_trainer_id?: string;
    name: string;
    category: string;
    room?: string;
    capacity: number;
    duration_minutes: number;
    starts_at: string;
    recurrence_rule?: string;
    recurrence_end_date?: string;
  }) => apiClient.post('/classes', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/classes/${id}`, data),

  enroll: (classId: string, memberId: string) =>
    apiClient.post(`/classes/${classId}/enroll`, { member_id: memberId }),

  cancelEnrollment: (classId: string, memberId: string) =>
    apiClient.post(`/classes/${classId}/cancel-enrollment`, { member_id: memberId }),

  promoteWaitlist: (classId: string, enrollmentId: string) =>
    apiClient.post(`/classes/${classId}/promote-waitlist`, { enrollment_id: enrollmentId }),
};

// ── Class Templates ───────────────────────────────────────

export interface TemplateFilters {
  branch_id?: string;
  organization_id?: string;
  category?: string;
  is_active?: boolean;
}

export const classTemplatesApi = {
  list: (filters?: TemplateFilters) =>
    apiClient.get('/classes/templates', { params: filters }),

  get: (id: string) =>
    apiClient.get(`/classes/templates/${id}`),

  create: (data: {
    name: string;
    description?: string;
    category: 'cardio' | 'strength' | 'flexibility' | 'mind_body' | 'dance' | 'martial_arts' | 'rehabilitation' | 'other';
    default_duration_minutes?: number;
    default_capacity?: number;
    branch_id?: string;
    organization_id?: string;
  }) => apiClient.post('/classes/templates', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/classes/templates/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/classes/templates/${id}`),
};

// ── Class Sessions ────────────────────────────────────────

export interface SessionFilters {
  branch_id?: string;
  trainer_id?: string;
  studio_id?: string;
  template_id?: string;
  category?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export const classSessionsApi = {
  list: (filters?: SessionFilters) =>
    apiClient.get('/classes/sessions', { params: filters }),

  get: (id: string) =>
    apiClient.get(`/classes/sessions/${id}`),

  create: (data: {
    branch_id: string;
    trainer_id: string;
    template_id?: string;
    studio_id?: string;
    name: string;
    category?: string;
    start_time: string;
    duration_minutes: number;
    capacity: number;
  }) => apiClient.post('/classes/sessions', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/classes/sessions/${id}`, data),

  cancel: (id: string, reason?: string) =>
    apiClient.post(`/classes/sessions/${id}/cancel`, { reason }),

  trainerSchedule: (trainerId: string, dateFrom?: string, dateTo?: string) =>
    apiClient.get(`/classes/sessions/trainer/${trainerId}/schedule`, {
      params: { date_from: dateFrom, date_to: dateTo },
    }),

  roomSchedule: (studioId: string, dateFrom?: string, dateTo?: string) =>
    apiClient.get(`/classes/sessions/room/${studioId}/schedule`, {
      params: { date_from: dateFrom, date_to: dateTo },
    }),
};

// ── Rooms ─────────────────────────────────────────────────

export const roomsApi = {
  list: (branchId?: string) =>
    apiClient.get('/classes/sessions/rooms', { params: branchId ? { branch_id: branchId } : undefined }),

  get: (id: string) =>
    apiClient.get(`/classes/sessions/rooms/${id}`),

  create: (data: { branch_id: string; name: string; capacity?: number; equipment_available?: string[] }) =>
    apiClient.post('/classes/sessions/rooms', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/classes/sessions/rooms/${id}`, data),
};

// ── Recurring Rules ───────────────────────────────────────

export const recurringRulesApi = {
  list: (filters?: { template_id?: string; branch_id?: string }) =>
    apiClient.get('/classes/sessions/recurring-rules', { params: filters }),

  create: (data: {
    template_id: string;
    branch_id: string;
    days_of_week: number[];
    start_time: string;
    duration_minutes?: number;
    trainer_id?: string;
    studio_id?: string;
    capacity?: number;
    repeat_until?: string;
  }) => apiClient.post('/classes/sessions/recurring-rules', data),

  deactivate: (id: string) =>
    apiClient.post(`/classes/sessions/recurring-rules/${id}/deactivate`),

  generate: () =>
    apiClient.post('/classes/sessions/recurring-rules/generate'),
};

// ── Bookings ──────────────────────────────────────────────

export const bookingsApi = {
  book: (data: { session_id: string; member_id: string }) =>
    apiClient.post('/classes/bookings', data),

  cancel: (id: string, reason?: string) =>
    apiClient.post(`/classes/bookings/${id}/cancel`, { reason }),

  forSession: (sessionId: string) =>
    apiClient.get(`/classes/bookings/session/${sessionId}`),

  forMember: (memberId: string, filters?: { status?: string; upcoming?: boolean }) =>
    apiClient.get(`/classes/bookings/member/${memberId}`, { params: filters }),

  waitlistPosition: (sessionId: string, memberId: string) =>
    apiClient.get(`/classes/bookings/waitlist/${sessionId}/${memberId}`),

  removeFromWaitlist: (sessionId: string, memberId: string) =>
    apiClient.delete(`/classes/bookings/waitlist/${sessionId}/${memberId}`),
};

// ── Attendance ────────────────────────────────────────────

export const attendanceApi = {
  mark: (sessionId: string, data: { member_id: string; attendance_status: 'present' | 'late' | 'no_show' | 'cancelled' }) =>
    apiClient.post(`/classes/bookings/attendance/${sessionId}`, data),

  markBulk: (sessionId: string, entries: { member_id: string; attendance_status: string }[]) =>
    apiClient.post(`/classes/bookings/attendance/${sessionId}/bulk`, { entries }),

  forSession: (sessionId: string) =>
    apiClient.get(`/classes/bookings/attendance/${sessionId}`),

  forMember: (memberId: string, filters?: { date_from?: string; date_to?: string; category?: string }) =>
    apiClient.get(`/classes/bookings/attendance/member/${memberId}`, { params: filters }),

  completeSession: (sessionId: string) =>
    apiClient.post(`/classes/bookings/attendance/${sessionId}/complete`),
};
