import { apiClient } from '@/services/api-client';
import type {
  AssignDietPlanInput,
  AssignmentFilters,
  AssignWorkoutPlanInput,
  AssignWorkoutPlanResult,
  CreateDietPlanInput,
  CreateWorkoutPlanInput,
  DietAssignment,
  DietPlan,
  DietPlanDetail,
  DietPlanFilters,
  ExerciseFilters,
  ExerciseRef,
  PaginatedList,
  UpdateDietPlanInput,
  UpdateWorkoutPlanInput,
  WorkoutAssignment,
  WorkoutPlan,
  WorkoutPlanDetail,
  WorkoutPlanFilters,
  ExerciseInput,
} from './types';

// ── Workout plans ───────────────────────────────────────────────

export const workoutPlansApi = {
  list: (filters?: WorkoutPlanFilters) =>
    apiClient.get<PaginatedList<WorkoutPlan>>('/workout-plans', {
      params: filters,
    }),

  getById: (id: string) =>
    apiClient.get<WorkoutPlanDetail>(`/workout-plans/${id}`),

  create: (data: CreateWorkoutPlanInput) =>
    apiClient.post<WorkoutPlanDetail>('/workout-plans', data),

  update: (id: string, data: UpdateWorkoutPlanInput) =>
    apiClient.patch<WorkoutPlanDetail>(`/workout-plans/${id}`, data),

  deactivate: (id: string) => apiClient.delete(`/workout-plans/${id}`),

  assign: (id: string, data: AssignWorkoutPlanInput) =>
    apiClient.post<AssignWorkoutPlanResult>(
      `/workout-plans/${id}/assign`,
      data,
    ),

  assignments: (filters?: AssignmentFilters) =>
    apiClient.get<PaginatedList<WorkoutAssignment>>(
      '/workout-plans/assignments',
      { params: filters },
    ),

  cancelAssignment: (assignmentId: string) =>
    apiClient.delete(`/workout-plans/assignments/${assignmentId}`),
};

// ── Diet plans ──────────────────────────────────────────────────

export const dietPlansApi = {
  list: (filters?: DietPlanFilters) =>
    apiClient.get<PaginatedList<DietPlan>>('/diet-plans', { params: filters }),

  getById: (id: string) => apiClient.get<DietPlanDetail>(`/diet-plans/${id}`),

  create: (data: CreateDietPlanInput) =>
    apiClient.post<DietPlanDetail>('/diet-plans', data),

  update: (id: string, data: UpdateDietPlanInput) =>
    apiClient.patch<DietPlanDetail>(`/diet-plans/${id}`, data),

  deactivate: (id: string) => apiClient.delete(`/diet-plans/${id}`),

  assign: (id: string, data: AssignDietPlanInput) =>
    apiClient.post(`/diet-plans/${id}/assign`, data),

  assignments: (filters?: AssignmentFilters) =>
    apiClient.get<PaginatedList<DietAssignment>>('/diet-plans/assignments', {
      params: filters,
    }),

  cancelAssignment: (assignmentId: string) =>
    apiClient.delete(`/diet-plans/assignments/${assignmentId}`),
};

// ── Exercise picker ─────────────────────────────────────────────

export const exercisesApi = {
  list: (filters?: ExerciseFilters) =>
    apiClient.get<PaginatedList<ExerciseRef>>('/exercises', {
      params: filters,
    }),

  create: (data: ExerciseInput) => apiClient.post<ExerciseRef>('/exercises', data),

  update: (id: string, data: Partial<ExerciseInput>) =>
    apiClient.patch<ExerciseRef>(`/exercises/${id}`, data),

  /** Soft delete — plans, set logs and PRs reference exercises. */
  archive: (id: string) => apiClient.delete(`/exercises/${id}`),

  /** Populate the starter catalog (idempotent). */
  seedDefaults: () =>
    apiClient.post<{ created: number; skipped: number; total: number }>(
      '/exercises/seed-defaults',
    ),
};
