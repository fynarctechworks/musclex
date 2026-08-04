import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dietPlansApi, exercisesApi, workoutPlansApi } from './api';
import type {
  AssignDietPlanInput,
  AssignmentFilters,
  AssignWorkoutPlanInput,
  CreateDietPlanInput,
  CreateWorkoutPlanInput,
  DietPlanFilters,
  ExerciseFilters,
  ExerciseInput,
  UpdateDietPlanInput,
  UpdateWorkoutPlanInput,
  WorkoutPlanFilters,
} from './types';

// Local query-key factory — same [module, entity, ...filters] convention as
// services/query-client.ts, scoped to this feature so we don't touch the
// shared file.
export const planKeys = {
  all: ['training-plans'] as const,
  workout: {
    all: ['training-plans', 'workout'] as const,
    list: (filters?: unknown) =>
      [...planKeys.workout.all, 'list', filters] as const,
    detail: (id: string) => [...planKeys.workout.all, 'detail', id] as const,
    assignments: (filters?: unknown) =>
      [...planKeys.workout.all, 'assignments', filters] as const,
  },
  diet: {
    all: ['training-plans', 'diet'] as const,
    list: (filters?: unknown) =>
      [...planKeys.diet.all, 'list', filters] as const,
    detail: (id: string) => [...planKeys.diet.all, 'detail', id] as const,
    assignments: (filters?: unknown) =>
      [...planKeys.diet.all, 'assignments', filters] as const,
  },
  exercises: (filters?: unknown) =>
    ['training-plans', 'exercises', filters] as const,
};

// ── Workout plans ───────────────────────────────────────────────

export function useWorkoutPlans(filters?: WorkoutPlanFilters) {
  return useQuery({
    queryKey: planKeys.workout.list(filters),
    queryFn: () => workoutPlansApi.list(filters),
  });
}

export function useWorkoutPlan(id?: string) {
  return useQuery({
    queryKey: planKeys.workout.detail(id ?? ''),
    queryFn: () => workoutPlansApi.getById(id!),
    enabled: !!id,
  });
}

export function useCreateWorkoutPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkoutPlanInput) => workoutPlansApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.workout.all });
      toast.success('Workout plan created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateWorkoutPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkoutPlanInput }) =>
      workoutPlansApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.workout.all });
      toast.success('Workout plan updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeactivateWorkoutPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workoutPlansApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.workout.all });
      toast.success('Workout plan deactivated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAssignWorkoutPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssignWorkoutPlanInput }) =>
      workoutPlansApi.assign(id, data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: planKeys.workout.all });
      const skipped = result.skipped_existing
        ? ` (${result.skipped_existing} date${result.skipped_existing !== 1 ? 's' : ''} already assigned — skipped)`
        : '';
      toast.success(
        `${result.assigned} workout${result.assigned !== 1 ? 's' : ''} assigned${skipped}`,
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useWorkoutAssignments(filters?: AssignmentFilters) {
  return useQuery({
    queryKey: planKeys.workout.assignments(filters),
    queryFn: () => workoutPlansApi.assignments(filters),
  });
}

export function useCancelWorkoutAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) =>
      workoutPlansApi.cancelAssignment(assignmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.workout.all });
      toast.success('Assignment cancelled');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Diet plans ──────────────────────────────────────────────────

export function useDietPlans(filters?: DietPlanFilters) {
  return useQuery({
    queryKey: planKeys.diet.list(filters),
    queryFn: () => dietPlansApi.list(filters),
  });
}

export function useDietPlan(id?: string) {
  return useQuery({
    queryKey: planKeys.diet.detail(id ?? ''),
    queryFn: () => dietPlansApi.getById(id!),
    enabled: !!id,
  });
}

export function useCreateDietPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDietPlanInput) => dietPlansApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.diet.all });
      toast.success('Diet plan created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateDietPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDietPlanInput }) =>
      dietPlansApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.diet.all });
      toast.success('Diet plan updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeactivateDietPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dietPlansApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.diet.all });
      toast.success('Diet plan deactivated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAssignDietPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssignDietPlanInput }) =>
      dietPlansApi.assign(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.diet.all });
      toast.success('Diet plan assigned');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDietAssignments(filters?: AssignmentFilters) {
  return useQuery({
    queryKey: planKeys.diet.assignments(filters),
    queryFn: () => dietPlansApi.assignments(filters),
  });
}

export function useCancelDietAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) =>
      dietPlansApi.cancelAssignment(assignmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.diet.all });
      toast.success('Assignment cancelled');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Exercise picker ─────────────────────────────────────────────

export function useExercises(filters?: ExerciseFilters) {
  return useQuery({
    queryKey: planKeys.exercises(filters),
    queryFn: () => exercisesApi.list(filters),
  });
}

// ── Exercise catalog management ─────────────────────────────────

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: exercisesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training-plans', 'exercises'] });
      toast.success('Exercise added');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ExerciseInput> }) =>
      exercisesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training-plans', 'exercises'] });
      toast.success('Exercise updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useArchiveExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => exercisesApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training-plans', 'exercises'] });
      toast.success('Exercise archived');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSeedExercises() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: exercisesApi.seedDefaults,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['training-plans', 'exercises'] });
      toast.success(
        res.created > 0
          ? `Added ${res.created} starter exercises`
          : 'Catalog already up to date',
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
