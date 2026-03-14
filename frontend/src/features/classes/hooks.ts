import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import {
  classesApi,
  classTemplatesApi,
  classSessionsApi,
  roomsApi,
  bookingsApi,
  attendanceApi,
  type ClassFilters,
  type SessionFilters,
  type TemplateFilters,
} from './api';
import { toast } from 'sonner';

// ── Classes ───────────────────────────────────────────────

export function useClasses(filters?: ClassFilters) {
  return useQuery({
    queryKey: queryKeys.classes.list(filters),
    queryFn: () => classesApi.list(filters),
  });
}

export function useClass(id: string) {
  return useQuery({
    queryKey: queryKeys.classes.detail(id),
    queryFn: () => classesApi.get(id),
    enabled: !!id,
  });
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: classesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast.success('Class created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      classesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast.success('Class updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useEnrollMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, memberId }: { classId: string; memberId: string }) =>
      classesApi.enroll(classId, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast.success('Member enrolled');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, memberId }: { classId: string; memberId: string }) =>
      classesApi.cancelEnrollment(classId, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast.success('Enrollment cancelled');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Templates ─────────────────────────────────────────────

export function useClassTemplates(filters?: TemplateFilters) {
  return useQuery({
    queryKey: queryKeys.classes.templates(filters),
    queryFn: () => classTemplatesApi.list(filters),
  });
}

export function useClassTemplate(id: string) {
  return useQuery({
    queryKey: queryKeys.classes.template(id),
    queryFn: () => classTemplatesApi.get(id),
    enabled: !!id,
  });
}

export function useCreateClassTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: classTemplatesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast.success('Template created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteClassTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: classTemplatesApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast.success('Template deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Sessions ──────────────────────────────────────────────

export function useClassSessions(filters?: SessionFilters) {
  return useQuery({
    queryKey: queryKeys.classes.sessions(filters),
    queryFn: () => classSessionsApi.list(filters),
  });
}

export function useClassSession(id: string) {
  return useQuery({
    queryKey: queryKeys.classes.session(id),
    queryFn: () => classSessionsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateClassSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: classSessionsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast.success('Session created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelClassSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      classSessionsApi.cancel(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast.success('Session cancelled');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useTrainerSchedule(trainerId: string, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: queryKeys.classes.trainerSchedule(trainerId, { date_from: dateFrom, date_to: dateTo }),
    queryFn: () => classSessionsApi.trainerSchedule(trainerId, dateFrom, dateTo),
    enabled: !!trainerId,
  });
}

// ── Rooms ─────────────────────────────────────────────────

export function useRooms(branchId?: string) {
  return useQuery({
    queryKey: queryKeys.classes.rooms(branchId),
    queryFn: () => roomsApi.list(branchId),
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: roomsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast.success('Room created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Bookings ──────────────────────────────────────────────

export function useSessionBookings(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.classes.bookings(sessionId),
    queryFn: () => bookingsApi.forSession(sessionId),
    enabled: !!sessionId,
  });
}

export function useMemberBookings(memberId: string, filters?: { status?: string; upcoming?: boolean }) {
  return useQuery({
    queryKey: queryKeys.classes.memberBookings(memberId, filters),
    queryFn: () => bookingsApi.forMember(memberId, filters),
    enabled: !!memberId,
  });
}

export function useBookClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bookingsApi.book,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast.success('Class booked');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      bookingsApi.cancel(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast.success('Booking cancelled');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Attendance ────────────────────────────────────────────

export function useSessionAttendance(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.classes.attendance(sessionId),
    queryFn: () => attendanceApi.forSession(sessionId),
    enabled: !!sessionId,
  });
}

export function useMemberAttendance(memberId: string, filters?: { date_from?: string; date_to?: string; category?: string }) {
  return useQuery({
    queryKey: queryKeys.classes.memberAttendance(memberId, filters),
    queryFn: () => attendanceApi.forMember(memberId, filters),
    enabled: !!memberId,
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: { member_id: string; attendance_status: 'present' | 'late' | 'no_show' | 'cancelled' } }) =>
      attendanceApi.mark(sessionId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast.success('Attendance marked');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useBulkMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, entries }: { sessionId: string; entries: { member_id: string; attendance_status: string }[] }) =>
      attendanceApi.markBulk(sessionId, entries),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast.success('Attendance updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCompleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => attendanceApi.completeSession(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast.success('Session completed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
