import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import {
  staffApi,
  shiftsApi,
  leavesApi,
  trainersApi,
  payrollApi,
  invitesApi,
  permissionsApi,
  staffAccessApi,
  type StaffFilters,
  type ShiftFilters,
  type LeaveFilters,
} from './api';
import { toast } from 'sonner';

// ── Staff ─────────────────────────────────────────────────

export function useStaffList(filters?: StaffFilters) {
  return useQuery({
    queryKey: queryKeys.staff.list(filters),
    queryFn: () => staffApi.list(filters),
  });
}

export function useStaffMember(id: string) {
  return useQuery({
    queryKey: queryKeys.staff.detail(id),
    queryFn: () => staffApi.get(id),
    enabled: !!id,
  });
}

export function useStaffProfile(id: string) {
  return useQuery({
    queryKey: queryKeys.staff.profile(id),
    queryFn: () => staffApi.getProfile(id),
    enabled: !!id,
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: staffApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Staff member created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      staffApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Staff member updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: staffApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Staff member deactivated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Availability ──────────────────────────────────────────

export function useStaffAvailability(id: string) {
  return useQuery({
    queryKey: queryKeys.staff.availability(id),
    queryFn: () => staffApi.getAvailability(id),
    enabled: !!id,
  });
}

export function useSetAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, slots }: { id: string; slots: Parameters<typeof staffApi.setAvailability>[1] }) =>
      staffApi.setAvailability(id, slots),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Availability updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Attendance ────────────────────────────────────────────

export function useStaffAttendance(id: string, filters?: { start_date?: string; end_date?: string; branch_id?: string }) {
  return useQuery({
    queryKey: queryKeys.staff.attendance(id, filters),
    queryFn: () => staffApi.getAttendance(id, filters),
    enabled: !!id,
  });
}

export function useStaffCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: staffApi.checkIn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Staff checked in');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStaffCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: staffApi.checkOut,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Staff checked out');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Invites ──────────────────────────────────────────────

export function useStaffInvites(filters?: { status?: string }) {
  return useQuery({
    queryKey: queryKeys.staff.invites(filters),
    queryFn: () => invitesApi.list(filters),
  });
}

export function useSendInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, data }: { staffId: string; data: Parameters<typeof invitesApi.send>[1] }) =>
      invitesApi.send(staffId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Invite sent');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useResendInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: invitesApi.resend,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Invite resent');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: invitesApi.revoke,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Invite revoked');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: invitesApi.accept,
    onSuccess: () => toast.success('Account created successfully'),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useInviteByToken(token: string) {
  return useQuery({
    queryKey: ['invite', token],
    queryFn: () => invitesApi.getByToken(token),
    enabled: !!token,
  });
}

// ── Permission Overrides ─────────────────────────────────

export function useStaffPermissions(staffId: string) {
  return useQuery({
    queryKey: queryKeys.staff.permissions(staffId),
    queryFn: () => permissionsApi.get(staffId),
    enabled: !!staffId,
  });
}

export function useUpdatePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, data }: { staffId: string; data: { grants?: string[]; denials?: string[] } }) =>
      permissionsApi.update(staffId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Permissions updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateStaffBranchAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, branch_ids }: { staffId: string; branch_ids: string[] }) =>
      permissionsApi.updateBranchAccess(staffId, branch_ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Branch access updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Staff Access Management ─────────────────────────────

export function useResetStaffPassword() {
  return useMutation({
    mutationFn: ({ staffId, password }: { staffId: string; password: string }) =>
      staffAccessApi.resetPassword(staffId, password),
    onSuccess: () => toast.success('Password has been reset'),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRevokeAllAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, deleteAuthUser }: { staffId: string; deleteAuthUser?: boolean }) =>
      staffAccessApi.revokeAllAccess(staffId, deleteAuthUser),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('All access revoked and staff deactivated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Shifts ────────────────────────────────────────────────

export function useShifts(filters?: ShiftFilters) {
  return useQuery({
    queryKey: queryKeys.staff.shifts(filters),
    queryFn: () => shiftsApi.list(filters),
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shiftsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Shift created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      shiftsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Shift updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shiftsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Shift deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Leaves ────────────────────────────────────────────────

export function useLeaves(filters?: LeaveFilters) {
  return useQuery({
    queryKey: queryKeys.staff.leaves(filters),
    queryFn: () => leavesApi.list(filters),
  });
}

export function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leavesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Leave request submitted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReviewLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: 'approved' | 'rejected'; reviewer_notes?: string } }) =>
      leavesApi.review(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Leave request reviewed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Trainers ──────────────────────────────────────────────

export function useTrainerClients(trainerId: string, status?: string) {
  return useQuery({
    queryKey: queryKeys.staff.trainerClients(trainerId),
    queryFn: () => trainersApi.getClients(trainerId, status),
    enabled: !!trainerId,
  });
}

export function useTrainerSessions(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.staff.trainerSessions(filters),
    queryFn: () => trainersApi.listSessions(filters as Parameters<typeof trainersApi.listSessions>[0]),
  });
}

export function useTrainerDashboard(trainerId: string) {
  return useQuery({
    queryKey: queryKeys.staff.trainerDashboard(trainerId),
    queryFn: () => trainersApi.dashboard(trainerId),
    enabled: !!trainerId,
  });
}

export function useTrainerPerformance(filters?: { branch_id?: string; organization_id?: string }) {
  return useQuery({
    queryKey: queryKeys.staff.trainerPerformance(filters),
    queryFn: () => trainersApi.allPerformance(filters),
  });
}

export function useAssignClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: trainersApi.assignClient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Client assigned');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateTrainerSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: trainersApi.createSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success('Training session created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Payroll ───────────────────────────────────────────────

export function usePayrollConfig(staffId: string) {
  return useQuery({
    queryKey: queryKeys.staff.payrollConfig(staffId),
    queryFn: () => payrollApi.getConfig(staffId),
    enabled: !!staffId,
  });
}

export function usePayrollSummary(filters?: { branch_id?: string; organization_id?: string }) {
  return useQuery({
    queryKey: queryKeys.staff.payrollSummary(filters),
    queryFn: () => payrollApi.summary(filters),
  });
}

export function usePayrollRecords(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.staff.payroll(filters),
    queryFn: () => payrollApi.listRecords(filters as Parameters<typeof payrollApi.listRecords>[0]),
  });
}

export function useProcessPayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.process,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      qc.invalidateQueries({ queryKey: queryKeys.finance.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast.success('Payroll processed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useTrainerRevenue(filters?: { trainer_id?: string; branch_id?: string; start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: queryKeys.staff.payrollRevenue(filters),
    queryFn: () => payrollApi.trainerRevenue(filters),
  });
}
