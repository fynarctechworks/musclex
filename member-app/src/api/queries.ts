import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './endpoints';
import { write, flush, pendingCount } from '../offline/outbox';
import type { BodyMetricInput, RoutineExerciseInput, SetLog } from './types';

export const qk = {
  home: ['home'] as const,
  occupancy: ['occupancy'] as const,
  me: ['me'] as const,
  digitalId: ['digital-id'] as const,
  visitSummary: ['visits', 'summary'] as const,
  leaderboard: ['leaderboard'] as const,
  history: (id: string) => ['history', id] as const,
  classes: ['classes'] as const,
  nutrition: ['nutrition', 'today'] as const,
  challenges: ['challenges'] as const,
  badges: ['badges'] as const,
  coach: ['coach'] as const,
  progress: ['progress'] as const,
  weekly: ['weekly'] as const,
  todayWorkout: ['workout', 'today'] as const,
  exercise: (id: string) => ['exercise', id] as const,
  membershipPlans: ['membership', 'plans'] as const,
  chatThreads: ['chat', 'threads'] as const,
  chatMessages: (id: string) => ['chat', id] as const,
  goals: ['me', 'goals'] as const,
  profile: ['me', 'profile'] as const,
  weight: ['me', 'weight'] as const,
  locations: ['gym', 'locations'] as const,
  myPlan: ['plans'] as const,
  visits: ['visits'] as const,
  pending: ['outbox', 'pending'] as const,
};

export function useHome() {
  return useQuery({ queryKey: qk.home, queryFn: api.home });
}

/**
 * Live occupancy. Polled rather than pushed: it is a nice-to-know number, and a
 * socket per member for it would cost more than it returns.
 */
export function useOccupancy(enabled = true) {
  return useQuery({
    queryKey: qk.occupancy,
    queryFn: api.occupancy,
    refetchInterval: 30_000,
    enabled,
  });
}

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: api.me });
}

/** The dynamic QR expires in ~35s, so refetch inside that window. */
export function useDigitalId() {
  return useQuery({
    queryKey: qk.digitalId,
    queryFn: api.digitalId,
    refetchInterval: 30_000,
    staleTime: 0,
  });
}

export function useVisitSummary() {
  return useQuery({ queryKey: qk.visitSummary, queryFn: api.visitSummary });
}

export function useLeaderboard() {
  return useQuery({ queryKey: qk.leaderboard, queryFn: api.leaderboard });
}

export function useExercises(
  query: string,
  muscle: string | null = null,
  favoritesOnly = false,
  equipment: string | null = null,
) {
  return useQuery({
    queryKey: ['exercises', query, muscle ?? '', favoritesOnly, equipment ?? ''] as const,
    queryFn: () =>
      api.exercises({
        q: query || undefined,
        muscle: muscle ?? undefined,
        equipment: equipment ?? undefined,
        favorites: favoritesOnly,
      }),
    staleTime: 5 * 60_000,
  });
}

export function useCreateCustomExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createCustomExercise,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  });
}

export function useExerciseDetail(id: string | null) {
  return useQuery({
    queryKey: qk.exercise(id ?? ''),
    queryFn: () => api.exerciseDetail(id as string),
    enabled: !!id,
  });
}

/**
 * Favourite toggle with an optimistic flip. The star must respond instantly —
 * a round trip for a preference is the kind of lag that makes an app feel
 * cheap — and the server treats both directions as idempotent.
 */
export function useToggleFavorite(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (next: boolean) => (next ? api.favorite(id) : api.unfavorite(id)),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: qk.exercise(id) });
      const prev = qc.getQueryData(qk.exercise(id));
      qc.setQueryData(qk.exercise(id), (d: any) => (d ? { ...d, favorited: next } : d));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.exercise(id), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.exercise(id) });
      qc.invalidateQueries({ queryKey: ['exercises'] });
    },
  });
}

/** Full membership record. Returns null (via 404) when there is none. */
export function useMembership() {
  return useQuery({
    queryKey: ['membership'],
    queryFn: () => api.membership().catch(() => null),
  });
}

/**
 * Start a renewal. Payment itself happens in the gym's hosted checkout, not
 * in-app: payment truth lives server-side behind a webhook, and re-implementing
 * a card form here would mean a second place that can be wrong about money.
 */
export function useRenewMembership() {
  return useMutation({ mutationFn: (planId: string) => api.renew(planId) });
}

export function useMembershipPlans() {
  return useQuery({ queryKey: qk.membershipPlans, queryFn: api.membershipPlans });
}

export function useExerciseHistory(id: string | null) {
  return useQuery({
    queryKey: qk.history(id ?? ''),
    queryFn: () => api.exerciseHistory(id as string),
    enabled: !!id,
    staleTime: 60_000,
  });
}

/**
 * Log a session through the outbox. Resolves `{ queued: true }` when the
 * request never reached the server — the caller must tell the member it is
 * saved and will sync, not that it failed.
 */
/** Today's trainer-assigned workout, if any. */
export function useTodayWorkout() {
  return useQuery({ queryKey: qk.todayWorkout, queryFn: api.todayWorkout });
}

/**
 * Log a session through the outbox. Pass the assignment id to log against a
 * trainer's plan; omit it for a freestyle session. Both queue identically.
 */
export function useTrainingStats(days = 30) {
  return useQuery({ queryKey: ['stats', days] as const, queryFn: () => api.stats(days) });
}

export function useLogWorkout(workoutId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sets: SetLog[]; startedAt?: string; endedAt?: string }) =>
      write('workout_log', { ...input, workoutId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.home });
      qc.invalidateQueries({ queryKey: ['history'] });
      qc.invalidateQueries({ queryKey: qk.visitSummary });
      qc.invalidateQueries({ queryKey: qk.pending });
    },
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => write('checkin', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.home });
      qc.invalidateQueries({ queryKey: qk.occupancy });
      qc.invalidateQueries({ queryKey: qk.visitSummary });
    },
  });
}

export function useLogWater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ml: number) => write('water', { amountMl: ml }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.home });
      qc.invalidateQueries({ queryKey: qk.nutrition });
    },
  });
}

/* ── Classes ───────────────────────────────────────────────── */

export function useClasses() {
  return useQuery({ queryKey: qk.classes, queryFn: api.classes, staleTime: 30_000 });
}

/**
 * Booking runs online only, never through the outbox: a seat cannot be
 * reserved while offline, and queueing one would promise a place that may be
 * gone by the time it sends.
 */
export function useBookClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bookClass(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.classes });
      qc.invalidateQueries({ queryKey: qk.home });
    },
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelBooking(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.classes });
      qc.invalidateQueries({ queryKey: qk.home });
    },
  });
}

/* ── Nutrition ─────────────────────────────────────────────── */

export function useNutrition() {
  return useQuery({ queryKey: qk.nutrition, queryFn: api.nutritionToday });
}

export function useLogMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { items: unknown[]; mealType: string }) => write('meal', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.nutrition });
      qc.invalidateQueries({ queryKey: qk.home });
      qc.invalidateQueries({ queryKey: qk.pending });
    },
  });
}

/* ── Community ─────────────────────────────────────────────── */

export function useChallenges() {
  return useQuery({ queryKey: qk.challenges, queryFn: api.challenges });
}

export function useJoinChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.joinChallenge(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.challenges }),
  });
}

export function useBadges() {
  return useQuery({ queryKey: qk.badges, queryFn: api.badges, staleTime: 5 * 60_000 });
}

/* ── Coach ─────────────────────────────────────────────────── */

export function useCoach() {
  return useQuery({ queryKey: qk.coach, queryFn: api.coach });
}

export function useAskCoach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => api.askCoach(message),
    onSuccess: (data) => qc.setQueryData(qk.coach, data),
  });
}

/* ── Progress ──────────────────────────────────────────────── */

export function useProgress() {
  return useQuery({ queryKey: qk.progress, queryFn: api.progress });
}

export function useWeekly() {
  return useQuery({ queryKey: qk.weekly, queryFn: api.weekly });
}

/* ── Trainer chat ──────────────────────────────────────────── */

export function useChatThreads() {
  return useQuery({ queryKey: qk.chatThreads, queryFn: api.chatThreads });
}

export function useChatMessages(trainerId: string | null) {
  return useQuery({
    queryKey: qk.chatMessages(trainerId ?? ''),
    queryFn: () => api.chatMessages(trainerId as string),
    enabled: !!trainerId,
    // A trainer replies on their own schedule, so poll while the thread is open
    // rather than opening a socket per member for a low-traffic conversation.
    refetchInterval: 15_000,
  });
}

export function useSendChat(trainerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.sendChat(trainerId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.chatMessages(trainerId) });
      qc.invalidateQueries({ queryKey: qk.chatThreads });
    },
  });
}

/* ── Goals + profile ───────────────────────────────────────── */

export function useGoals() {
  return useQuery({ queryKey: qk.goals, queryFn: api.goals });
}

export function useAddGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.addGoal(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.goals }),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.updateGoal(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.goals }),
  });
}

export function useProfile() {
  return useQuery({ queryKey: qk.profile, queryFn: api.profile });
}

/** Onboarding writes: PATCH /me, the only route that records completion. */
export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.updateMe(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: qk.profile });
      qc.invalidateQueries({ queryKey: qk.home });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.updateProfile(body),
    onSuccess: (data) => {
      qc.setQueryData(qk.profile, data);
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

/* ── Body weight ───────────────────────────────────────────── */

/** Record body measurements. Every field independent — measuring only arms
 *  should not require inventing a chest number. */
export function useAddMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BodyMetricInput) => api.addMetric(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.progress });
      qc.invalidateQueries({ queryKey: qk.weight });
    },
  });
}

export function useWeight() {
  return useQuery({ queryKey: qk.weight, queryFn: api.weight });
}

export function useLogWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kg: number) => api.logWeight(kg),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.weight });
      qc.invalidateQueries({ queryKey: qk.progress });
      qc.invalidateQueries({ queryKey: qk.profile });
    },
  });
}

/* ── Food + locations ──────────────────────────────────────── */

export function useFoods(q: string) {
  return useQuery({
    queryKey: ['foods', q] as const,
    queryFn: () => api.foods(q),
    enabled: q.trim().length >= 2,
    staleTime: 5 * 60_000,
  });
}

export function useLocations() {
  return useQuery({ queryKey: qk.locations, queryFn: api.locations, staleTime: 10 * 60_000 });
}

/* ── My Plan + visits ──────────────────────────────────────── */

export function useMyPlan() {
  return useQuery({ queryKey: qk.myPlan, queryFn: api.myPlan });
}

export function useVisits() {
  return useQuery({ queryKey: qk.visits, queryFn: api.visits });
}

/** Editable macro targets. Everything that reads them must re-fetch after. */
export function useSetNutritionGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, number>) => api.setNutritionGoal(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.nutrition });
      qc.invalidateQueries({ queryKey: qk.home });
    },
  });
}

/* ── Tools, referral, discovery ────────────────────────────── */

export function useComputeTools() {
  return useMutation({ mutationFn: (b: Record<string, unknown>) => api.computeTools(b) });
}

export function useApplyReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.applyReferral(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useNearbyGyms(q = '') {
  return useQuery({
    queryKey: ['nearby-gyms', q] as const,
    queryFn: () => api.nearbyGyms(q || undefined),
    staleTime: 10 * 60_000,
  });
}

/* ── Explore ───────────────────────────────────────────────── */

export function useExplore() {
  return useQuery({ queryKey: ['explore'], queryFn: api.explore, staleTime: 10 * 60_000 });
}

export function useExploreWorkout(slug: string | null) {
  return useQuery({
    queryKey: ['explore', slug ?? ''] as const,
    queryFn: () => api.exploreWorkout(slug as string),
    enabled: !!slug,
  });
}

export function useAddExploreWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.addExploreWorkout(slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routines'] });
      qc.invalidateQueries({ queryKey: ['explore'] });
    },
  });
}

/* ── Routines ──────────────────────────────────────────────── */

export function useRoutines() {
  return useQuery({ queryKey: ['routines'], queryFn: api.routines });
}

export function useRoutine(id: string | null) {
  return useQuery({
    queryKey: ['routine', id ?? ''] as const,
    queryFn: () => api.routine(id as string),
    enabled: !!id,
  });
}

export function useCreateRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createRoutine,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routines'] }),
  });
}

export function useUpdateRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; notes?: string; exercises?: RoutineExerciseInput[] }) =>
      api.updateRoutine(id, body),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['routines'] });
      // The editor reads the single-routine query, so refresh that too or a
      // re-open shows the pre-edit exercise list.
      qc.invalidateQueries({ queryKey: ['routine', r.id] });
    },
  });
}

export function useDeleteRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteRoutine(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routines'] }),
  });
}

export function useShareRoutine() {
  return useMutation({ mutationFn: (id: string) => api.shareRoutine(id) });
}

export function useSharedRoutine(token: string | null) {
  return useQuery({
    queryKey: ['shared-routine', token ?? ''] as const,
    queryFn: () => api.previewSharedRoutine(token as string),
    enabled: !!token,
    retry: false,
  });
}

export function useImportRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.importRoutine(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routines'] }),
  });
}

/* ── Outbox ────────────────────────────────────────────────── */

/** How many writes are still waiting to sync. Drives the pending banner. */
export function usePending() {
  return useQuery({
    queryKey: qk.pending,
    queryFn: pendingCount,
    refetchInterval: 15_000,
  });
}

export function useFlush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: flush,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.pending });
      qc.invalidateQueries({ queryKey: qk.home });
    },
  });
}

/* ── Friends ───────────────────────────────────────────────────────────────
 * The feed and the friends list share a cache key prefix so accepting a
 * request, or unfriending, refreshes both without either screen knowing about
 * the other.
 */

export function useFriends() {
  return useQuery({ queryKey: ['friends'], queryFn: api.friends });
}

export function useFriendFeed() {
  return useQuery({ queryKey: ['friends', 'feed'], queryFn: api.friendFeed });
}

export function useFriendSearch(phone: string) {
  return useQuery({
    queryKey: ['friends', 'search', phone],
    queryFn: () => api.friendSearch(phone),
    // Only once it could plausibly be a number — otherwise every keystroke is
    // a request that cannot match anything.
    enabled: phone.replace(/\D/g, '').length >= 6,
  });
}

export function useFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (appUserId: string) => api.friendRequest(appUserId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }),
  });
}

export function useFriendRespond() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) =>
      api.friendRespond(requestId, accept),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }),
  });
}

export function useFriendRemove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (appUserId: string) => api.friendRemove(appUserId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }),
  });
}

export function useFriendKudos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.friendKudos(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends', 'feed'] }),
  });
}

export function useFriendPrs(appUserId: string | null) {
  return useQuery({
    queryKey: ['friends', 'prs', appUserId ?? ''],
    queryFn: () => api.friendPrs(appUserId as string),
    enabled: !!appUserId,
  });
}

export function useSharePrefs() {
  return useQuery({ queryKey: ['friends', 'sharing'], queryFn: api.sharePrefs });
}

export function useSetSharePrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.setSharePrefs,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends', 'sharing'] });
      // Turning a category off withdraws published rows, so the feed a friend
      // sees changes too — refresh rather than show a stale one.
      qc.invalidateQueries({ queryKey: ['friends', 'feed'] });
    },
  });
}

export function useSendRoutineToFriend() {
  return useMutation({
    mutationFn: ({ appUserId, routineId }: { appUserId: string; routineId: string }) =>
      api.sendRoutineToFriend(appUserId, routineId),
  });
}

export function useRoutineInbox() {
  return useQuery({ queryKey: ['friends', 'routine-inbox'], queryFn: api.routineInbox });
}

export function useAcceptSentRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.acceptSentRoutine(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends', 'routine-inbox'] });
      qc.invalidateQueries({ queryKey: ['routines'] });
    },
  });
}
