import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from './endpoints';
import { enqueue, sync } from '../offline/outbox';
import { submitWorkoutLog } from '../features/workout/submit';
import { uuid } from '../lib/uuid';
import type {
  BodyMetricInput,
  CheckInRequest,
  SetLog,
  MealLogInput,
  WaterLogInput,
  NutritionGoalInput,
  ExerciseList,
  ExerciseDetail,
  ChatMessage,
  ChatMessageList,
  WearableConnectInput,
  HealthSampleInput,
} from './types';

export const qk = {
  me: ['me'] as const,
  home: ['home'] as const,
  occupancy: ['occupancy'] as const,
  locations: ['locations'] as const,
  membership: ['membership'] as const,
  progress: ['progress'] as const,
  todayWorkout: ['workout', 'today'] as const,
  classes: ['classes'] as const,
  nutrition: ['nutrition', 'today'] as const,
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

// ── Nutrition (V2.1) ──────────────────────────────────────────────
export function useNutritionToday() {
  return useQuery({
    queryKey: qk.nutrition,
    queryFn: api.nutritionToday,
    staleTime: 30_000,
  });
}

export function useFoodSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['nutrition', 'foods', q] as const,
    queryFn: () => api.searchFoods(q),
    enabled: q.length >= 2,
    staleTime: 5 * 60_000, // catalog rarely changes
  });
}

export function useLogMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: MealLogInput) => {
      await enqueue({ kind: 'meal', body });
      await sync();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.nutrition });
      qc.invalidateQueries({ queryKey: qk.home });
    },
  });
}

export function useLogWater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: WaterLogInput) => {
      await enqueue({ kind: 'water', body });
      await sync();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.nutrition }),
  });
}

// ── Exercise library (V2.2) ───────────────────────────────────────
export function useExercises(
  query: string,
  muscle: string | null,
  favoritesOnly = false,
) {
  const q = query.trim();
  return useQuery({
    queryKey: ['exercises', q, muscle ?? '', favoritesOnly] as const,
    queryFn: () => api.exercises(q || undefined, muscle ?? undefined, favoritesOnly),
    staleTime: 5 * 60_000, // catalog rarely changes
  });
}

export function useExercise(id: string) {
  return useQuery({
    queryKey: ['exercise', id] as const,
    queryFn: () => api.exercise(id),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

/**
 * Toggle a favorite with an optimistic flip across every cached exercise list +
 * the detail, rolled back on error and reconciled on settle. Pass the item's
 * CURRENT favorited state; the hook calls the opposite endpoint.
 */
export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, favorited }: { id: string; favorited: boolean }) =>
      favorited ? api.removeFavorite(id) : api.setFavorite(id),
    onMutate: async ({ id, favorited }) => {
      const next = !favorited;
      await qc.cancelQueries({ queryKey: ['exercises'] });
      await qc.cancelQueries({ queryKey: ['exercise', id] });
      const prevLists = qc.getQueriesData<ExerciseList>({ queryKey: ['exercises'] });
      const prevDetail = qc.getQueryData<ExerciseDetail>(['exercise', id]);
      qc.setQueriesData<ExerciseList>({ queryKey: ['exercises'] }, (old) =>
        old?.exercises
          ? {
              ...old,
              exercises: old.exercises.map((e) =>
                e.id === id ? { ...e, favorited: next } : e,
              ),
            }
          : old,
      );
      qc.setQueryData<ExerciseDetail>(['exercise', id], (old) =>
        old ? { ...old, favorited: next } : old,
      );
      return { prevLists, prevDetail, id };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.prevLists?.forEach(([key, data]) => qc.setQueryData(key, data));
      if (ctx) qc.setQueryData(['exercise', ctx.id], ctx.prevDetail);
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: ['exercises'] });
      qc.invalidateQueries({ queryKey: ['exercise', id] });
    },
  });
}

// ── Trainer chat (V2.3) ───────────────────────────────────────────
export const chatKeys = {
  threads: ['chat', 'threads'] as const,
  messages: (trainerId: string) => ['chat', 'messages', trainerId] as const,
};

export function useChatThreads() {
  return useQuery({
    queryKey: chatKeys.threads,
    queryFn: api.chatThreads,
    refetchInterval: 20_000, // near-real-time until a WS gateway lands
  });
}

export function useChatMessages(trainerId: string) {
  return useQuery({
    queryKey: chatKeys.messages(trainerId),
    queryFn: () => api.chatMessages(trainerId),
    enabled: !!trainerId,
    // WebSocket delivers messages live; this is just a reconnect/missed-event backstop.
    refetchInterval: 30_000,
  });
}

export function useSendMessage(trainerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      await enqueue({ kind: 'chat', trainerId, body });
      await sync();
    },
    // Optimistically append the member's message so the bubble appears instantly.
    onMutate: async (body: string) => {
      const key = chatKeys.messages(trainerId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ChatMessageList>(key);
      const optimistic: ChatMessage = {
        id: `temp-${uuid()}`,
        sender: 'member',
        body,
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<ChatMessageList>(key, (old) =>
        old
          ? { ...old, messages: [...(old.messages ?? []), optimistic] }
          : { trainerId, messages: [optimistic] },
      );
      return { prev };
    },
    onError: (_e, _body, ctx) => {
      if (ctx) qc.setQueryData(chatKeys.messages(trainerId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(trainerId) });
      qc.invalidateQueries({ queryKey: chatKeys.threads });
    },
  });
}

// ── Community (V2.5) ──────────────────────────────────────────────
export const communityKeys = {
  leaderboard: (period: number) => ['community', 'leaderboard', period] as const,
  challenges: ['community', 'challenges'] as const,
  badges: ['community', 'badges'] as const,
};

export function useLeaderboard(period = 30) {
  return useQuery({
    queryKey: communityKeys.leaderboard(period),
    queryFn: () => api.leaderboard(period),
    staleTime: 60_000,
  });
}

export function useCommunityChallenges() {
  return useQuery({
    queryKey: communityKeys.challenges,
    queryFn: api.communityChallenges,
    staleTime: 60_000,
  });
}

export function useBadges() {
  return useQuery({
    queryKey: communityKeys.badges,
    queryFn: api.badges,
    staleTime: 5 * 60_000,
  });
}

export function useJoinChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) => api.joinChallenge(challengeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.challenges }),
  });
}

export function useSetNutritionGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NutritionGoalInput) => api.setNutritionGoal(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.nutrition }),
  });
}

// ── Health Data Platform (wearable telemetry) ─────────────────────
export const healthKeys = {
  summary: (from?: string, to?: string, types?: string) =>
    ['health', 'summary', from ?? '', to ?? '', types ?? ''] as const,
  connections: ['health', 'connections'] as const,
};

export function useHealthSummary(from?: string, to?: string, types?: string) {
  return useQuery({
    queryKey: healthKeys.summary(from, to, types),
    queryFn: () => api.healthSummary(from, to, types),
    staleTime: 60_000,
  });
}

export function useWearableConnections() {
  return useQuery({
    queryKey: healthKeys.connections,
    queryFn: api.wearableConnections,
    staleTime: 5 * 60_000,
  });
}

export function useConnectWearable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: WearableConnectInput) => api.connectWearable(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: healthKeys.connections });
    },
  });
}

export function useRevokeWearable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => api.revokeWearable(provider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: healthKeys.connections });
    },
  });
}

/**
 * Manually log a single health sample (weight, mood, …). Manual entries need no
 * wearable connection. Invalidates the summary so the dashboard updates.
 */
export function useLogHealthSample() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sample: HealthSampleInput) => api.ingestHealth([sample], uuid()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health', 'summary'] });
      qc.invalidateQueries({ queryKey: qk.home });
    },
  });
}
