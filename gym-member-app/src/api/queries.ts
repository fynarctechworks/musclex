import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from './endpoints';
import { enqueue, sync } from '../offline/outbox';
import { submitWorkoutLog } from '../features/workout/submit';
import { uuid } from '../lib/uuid';
import type { BodyMetricInput, CheckInRequest, SetLog } from './types';

export const qk = {
  me: ['me'] as const,
  home: ['home'] as const,
  occupancy: ['occupancy'] as const,
  locations: ['locations'] as const,
  membership: ['membership'] as const,
  progress: ['progress'] as const,
  todayWorkout: ['workout', 'today'] as const,
  classes: ['classes'] as const,
};

// ── Reads ─────────────────────────────────────────────────────────
export function useHome() {
  return useQuery({
    queryKey: qk.home,
    queryFn: api.home,
    staleTime: 30_000, // mirrors typical meta.cacheTtl
  });
}

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: api.me, staleTime: 5 * 60_000 });
}

export function useOccupancy() {
  return useQuery({
    queryKey: qk.occupancy,
    queryFn: api.occupancy,
    refetchInterval: 15_000, // polling fallback for realtime (TRD §7)
  });
}

export function useLocations() {
  return useQuery({
    queryKey: qk.locations,
    queryFn: api.locations,
    staleTime: 5 * 60_000, // branch list rarely changes
  });
}

export function useMembership() {
  return useQuery({ queryKey: qk.membership, queryFn: api.membership });
}

export function useProgress() {
  return useQuery({ queryKey: qk.progress, queryFn: api.progress });
}

export function useTodayWorkout() {
  return useQuery({ queryKey: qk.todayWorkout, queryFn: api.todayWorkout });
}

export function useClasses() {
  return useQuery({
    queryKey: qk.classes,
    queryFn: api.classes,
    staleTime: 30_000,
  });
}

// Booking is interactive + capacity-dependent, so it runs online (not via the
// offline outbox — you can't guarantee a seat while offline). A fresh
// idempotency key per attempt makes a network retry safe.
export function useBookClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (classId: string) => api.bookClass(classId, uuid()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.classes });
      qc.invalidateQueries({ queryKey: qk.home });
    },
  });
}

export function useCancelClassBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (classId: string) => api.cancelClassBooking(classId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.classes });
      qc.invalidateQueries({ queryKey: qk.home });
    },
  });
}

// ── Writes (offline-first via outbox) ─────────────────────────────
export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CheckInRequest) => {
      await enqueue({ kind: 'checkin', body });
      // Attempt immediate sync; if offline it stays queued and reconciles later.
      await sync();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.home });
      qc.invalidateQueries({ queryKey: qk.occupancy });
    },
  });
}

export function useLogMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: BodyMetricInput) => {
      await enqueue({ kind: 'metric', body });
      await sync();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.progress }),
  });
}

export function useLogWorkout(workoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    // Returns WorkoutLogResult when online (for PR celebration) or null offline.
    mutationFn: (sets: SetLog[]) => submitWorkoutLog(workoutId, sets),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.todayWorkout });
      qc.invalidateQueries({ queryKey: qk.home });
    },
  });
}

export function useRenew() {
  return useMutation({
    mutationFn: (planId: string) => api.renew(planId, uuid()),
  });
}
