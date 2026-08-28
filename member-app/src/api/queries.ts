import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from './endpoints';
import { write, flush, pendingCount } from '../offline/outbox';
import { anyRefetching, refetchAll } from '../lib/refetch-all';
import type {
  ActivityInput,
  BodyMetricInput,
  ExerciseListItem,
  NutritionToday,
  Routine,
  RoutineExerciseInput,
  SetLog,
} from './types';

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
  context: ['me', 'context'] as const,
  water: ['me', 'water'] as const,
  progress: ['progress'] as const,
  activityRoutes: (days: number, sport: string | null) =>
    ['activities', 'routes', days, sport] as const,
  trainingLoad: (days: number) => ['training', 'load', days] as const,
  racePredictions: ['training', 'races'] as const,
  strengthPredictions: ['training', 'strength'] as const,
  weekly: ['weekly'] as const,
  todayWorkout: ['workout', 'today'] as const,
  exercise: (id: string) => ['exercise', id] as const,
  membershipPlans: ['membership', 'plans'] as const,
  chatThreads: ['chat', 'threads'] as const,
  chatMessages: (id: string) => ['chat', id] as const,
  goals: ['me', 'goals'] as const,
  profile: ['me', 'profile'] as const,
  weight: ['me', 'weight'] as const,
  healthDaily: ['me', 'health', 'daily'] as const,
  sports: ['activities', 'sports'] as const,
  feed: ['feed'] as const,
  myClubs: ['clubs', 'mine'] as const,
  conversations: ['dm'] as const,
  suggestions: ['people', 'suggestions'] as const,
  progressPhotos: ['progress', 'photos'] as const,
  groupChallenges: ['group-challenges'] as const,
  groupChallenge: (id: string) => ['group-challenge', id] as const,
  myCode: ['people', 'code'] as const,
  person: (id: string) => ['people', id] as const,
  conversation: (id: string) => ['dm', id] as const,
  discoverClubs: (sport?: string) => ['clubs', 'discover', sport ?? 'all'] as const,
  club: (id: string) => ['club', id] as const,
  clubFeed: (id: string) => ['club', id, 'feed'] as const,
  clubEvents: (id: string) => ['club', id, 'events'] as const,
  clubMembers: (id: string) => ['club', id, 'members'] as const,
  following: ['feed', 'following'] as const,
  activityComments: (id: string) => ['feed', id, 'comments'] as const,
  activities: (sport?: string) => ['activities', sport ?? 'all'] as const,
  activity: (id: string) => ['activity', id] as const,
  locations: ['gym', 'locations'] as const,
  myPlan: ['plans'] as const,
  visits: ['visits'] as const,
  pending: ['outbox', 'pending'] as const,
};

/**
 * The gym dashboard.
 *
 * `enabled` because this endpoint is gym-only and returns a clean 403 to an
 * independent user. Firing it unconditionally meant every gym-less member's
 * home screen opened with a failed request and an error state — the app asking
 * a question it already had the answer to.
 */
export function useHome(enabled = true) {
  return useQuery({ queryKey: qk.home, queryFn: api.home, enabled });
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

/**
 * The exercise catalogue, from whichever surface this member has.
 *
 * A gym's catalogue is a tenant table, so someone with no gym gets a 403 and
 * would see NO exercises at all — which makes building a routine impossible.
 * They get the global catalogue instead, plus anything they added themselves.
 *
 * The personal source has no equipment tags, no media and no favourites yet,
 * so those filters are simply not applied rather than silently returning
 * nothing: an empty picker reads as "no exercises exist".
 */
export function useExercises(
  query: string,
  muscle: string | null = null,
  favoritesOnly = false,
  equipment: string | null = null,
): {
  data: { exercises: ExerciseListItem[] } | undefined;
  isLoading: boolean;
  refetch: () => void;
  isRefetching: boolean;
} {
  const who = useHasGym();
  const gym = useQuery({
    queryKey: ['exercises', query, muscle ?? '', favoritesOnly, equipment ?? ''] as const,
    queryFn: () =>
      api.exercises({
        q: query || undefined,
        muscle: muscle ?? undefined,
        equipment: equipment ?? undefined,
        favorites: favoritesOnly,
      }),
    staleTime: 5 * 60_000,
    enabled: !who.loading && who.hasGym,
  });
  const personal = useQuery({
    queryKey: ['exercises', 'personal', query] as const,
    queryFn: () => api.personalExercises(query || undefined),
    staleTime: 5 * 60_000,
    enabled: !who.loading && !who.hasGym,
  });

  if (who.hasGym) return gym;

  const rows = personal.data?.exercises ?? [];
  const filtered = muscle ? rows.filter((e) => e.muscle_group === muscle) : rows;
  return {
    isLoading: who.loading || personal.isLoading,
    // Only one of the two queries is ever enabled, so refreshing delegates to
    // whichever branch this member is actually on.
    refetch: personal.refetch,
    isRefetching: personal.isRefetching,
    data: personal.data
      ? {
          exercises: filtered.map((e): ExerciseListItem => ({
            id: e.id,
            name: e.name,
            muscleGroup: e.muscle_group,
            trackingType: e.tracking_type === 'duration' ? 'duration' : 'reps',
            // app_user_id set = they added it themselves.
            isCustom: e.app_user_id != null,
          })),
        }
      : undefined,
  };
}

export function useCreateCustomExercise() {
  const qc = useQueryClient();
  const who = useHasGym();
  return useMutation({
    mutationFn: async (
      body: Parameters<typeof api.createCustomExercise>[0],
    ): Promise<{ id: string; name: string; isCustom: boolean }> => {
      if (who.hasGym) return api.createCustomExercise(body);
      const made = await api.createPersonalExercise({
        name: body.name,
        muscleGroup: body.muscleGroup ?? undefined,
        trackingType: body.trackingType,
      });
      // Always custom on this surface — the global catalogue is read-only.
      return { id: made.id, name: made.name, isCustom: true };
    },
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
      // A new heavy set can move a projected 1RM, and that projection is the
      // first thing a lifter checks after a session.
      qc.invalidateQueries({ queryKey: qk.strengthPredictions });
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

/**
 * Today's food, from whichever surface this member has.
 *
 * Gym members log against their gym's food catalogue (/nutrition/today);
 * everyone else logs free-text items to /me/meals, which needs no gym and no
 * catalogue. Normalised to one shape so the nutrition screen stays one screen.
 */
export function useNutrition(): {
  data: NutritionToday | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  isRefetching: boolean;
} {
  const who = useHasGym();
  const gym = useQuery({
    queryKey: qk.nutrition,
    queryFn: api.nutritionToday,
    enabled: !who.loading && who.hasGym,
  });
  const personal = useQuery({
    queryKey: ['nutrition', 'personal'],
    queryFn: () => api.personalMeals(),
    enabled: !who.loading && !who.hasGym,
  });
  const water = useQuery({
    queryKey: qk.water,
    queryFn: () => api.water(),
    enabled: !who.loading && !who.hasGym,
  });

  if (who.hasGym) return gym;
  return {
    isLoading: who.loading || personal.isLoading,
    isError: personal.isError,
    /*
      BOTH queries, unlike the other merged hooks on this page.

      An independent member's nutrition is assembled from two calls — the meals
      and the water — and the screen shows them side by side. Refetching only
      the meals would redraw the food totals while leaving the water bar on a
      number that could be minutes old, which is worse than not refreshing at
      all because it looks current.
    */
    refetch: refetchAll(personal.refetch, water.refetch),
    isRefetching: anyRefetching(personal.isRefetching, water.isRefetching),
    data: personal.data
      ? {
          date: new Date().toISOString().slice(0, 10),
          /*
            There is no personal nutrition GOAL yet — the gym one lives on a
            gym table. These are the widely used defaults, and they are here so
            the screen can draw a bar at all; they are NOT this member's own
            targets and the screen says so.
          */
          goal: { kcal: 2000, proteinG: 120, carbsG: 250, fatG: 65, waterMl: 2500 },
          totals: personal.data.totals,
          waterMl: water.data?.amountMl ?? 0,
          meals: personal.data.meals.map((m) => ({
            id: m.id,
            mealType: m.mealType,
            loggedAt: m.loggedAt,
            items: m.items.map((i) => ({ name: i.name, kcal: i.kcal })),
          })),
        }
      : undefined,
  };
}

/**
 * Log a meal to whichever surface this member has.
 *
 * The gym path goes through the offline OUTBOX (`write`), because a gym member
 * logging lunch in a basement gym with no signal must not lose it. The personal
 * path posts directly but carries a clientKey, which the server treats as
 * idempotent — same protection, without teaching the outbox a second shape.
 */
export function useLogMeal() {
  const qc = useQueryClient();
  const who = useHasGym();
  return useMutation({
    mutationFn: async (
      body: { items: unknown[]; mealType: string },
    ): Promise<{ queued: boolean }> => {
      if (who.hasGym) return write('meal', body);
      await api.logPersonalMeal({
        mealType: body.mealType,
        items: body.items as { name: string }[],
      });
      // Normalised to the outbox's shape. The personal path posts straight
      // through, so it is never "queued" — but the screen should not have to
      // know which surface it is talking to.
      return { queued: false };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.nutrition });
      qc.invalidateQueries({ queryKey: ['nutrition', 'personal'] });
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

/**
 * Who this member is and what they may do.
 *
 * Long staleTime because it changes only when a membership does — but it is
 * NOT infinite: a membership can lapse or be suspended mid-session, and a UI
 * still offering class booking after that is worse than one extra request.
 */
/**
 * Whether this member has a gym, for hooks in THIS file that must pick a
 * surface. Deliberately not `useWho` from lib/use-capabilities — that module
 * imports from here, and importing it back would make the cycle real.
 */
function useHasGym(): { loading: boolean; hasGym: boolean } {
  const { data, isLoading } = useMemberContext();
  return {
    loading: isLoading,
    hasGym: data?.userType === 'member' && !!data.memberships?.some((m) => m.active),
  };
}

export function useMemberContext() {
  return useQuery({
    queryKey: qk.context,
    queryFn: api.context,
    staleTime: 5 * 60_000,
  });
}

export function useActivityRoutes(days = 365, sport: string | null = null) {
  return useQuery({
    queryKey: qk.activityRoutes(days, sport),
    queryFn: () => api.activityRoutes(days, sport ?? undefined),
    // Half a megabyte of geometry that only changes when a run is recorded,
    // and recording invalidates the whole ['activities'] prefix anyway.
    staleTime: 10 * 60_000,
  });
}

/* ── Training science ─────────────────────────────────────── */

export function useTrainingLoad(days = 90) {
  return useQuery({
    queryKey: qk.trainingLoad(days),
    queryFn: () => api.trainingLoad(days),
    // Recomputed from scratch server-side on every call, so it is never stale
    // in the wrong direction — but it also cannot change without a new
    // activity, and those invalidate it explicitly.
    staleTime: 5 * 60_000,
  });
}

export function useRacePredictions() {
  return useQuery({
    queryKey: qk.racePredictions,
    queryFn: api.racePredictions,
    staleTime: 5 * 60_000,
  });
}

export function useStrengthPredictions() {
  return useQuery({
    queryKey: qk.strengthPredictions,
    queryFn: api.strengthPredictions,
    staleTime: 5 * 60_000,
  });
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

/* ── Group challenges ──────────────────────────────────────── */

export function useGroupChallenges() {
  return useQuery({ queryKey: qk.groupChallenges, queryFn: api.groupChallenges });
}

export function useGroupChallenge(id: string | null) {
  return useQuery({
    queryKey: qk.groupChallenge(id ?? ''),
    queryFn: () => api.groupChallenge(id as string),
    enabled: !!id,
  });
}

export function useCreateGroupChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.createGroupChallenge(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.groupChallenges }),
  });
}

export function useInviteToChallenge(challengeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (appUserId: string) => api.inviteToChallenge(challengeId, appUserId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.groupChallenge(challengeId) }),
  });
}

export function useLeaveChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.leaveChallenge(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.groupChallenges }),
  });
}

/* ── Progress photos ───────────────────────────────────────── */

export function useProgressPhotos() {
  return useQuery({
    queryKey: qk.progressPhotos,
    queryFn: api.progressPhotos,
    // Signed URLs expire in an hour, so a long-cached list would render
    // broken images. Refetching well inside that window avoids it.
    staleTime: 15 * 60_000,
  });
}

export function useAddProgressPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contentType, upload }: {
      contentType: string;
      upload: (uploadUrl: string) => Promise<void>;
    }) => {
      const { photoId, uploadUrl } = await api.photoUploadUrl(contentType);
      // The bytes go straight to storage; only the confirmation comes back
      // through our API.
      await upload(uploadUrl);
      return api.confirmPhoto(photoId, new Date().toISOString());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.progressPhotos }),
  });
}

/* ── Finding people ────────────────────────────────────────── */

export function useSuggestions() {
  return useQuery({ queryKey: qk.suggestions, queryFn: api.suggestions, staleTime: 300_000 });
}

export function useMyCode() {
  return useQuery({ queryKey: qk.myCode, queryFn: api.myCode, staleTime: Infinity });
}

export function usePerson(id: string | null) {
  return useQuery({
    queryKey: qk.person(id ?? ''),
    queryFn: () => api.person(id as string),
    enabled: !!id,
  });
}

/**
 * Match contacts.
 *
 * A mutation rather than a query because it is an action the member takes
 * deliberately — nothing about it should happen on a screen simply loading.
 */
export function useMatchContacts() {
  return useMutation({ mutationFn: (hashes: string[]) => api.matchContacts(hashes) });
}

/* ── Direct messages ───────────────────────────────────────── */

export function useConversations() {
  return useQuery({
    queryKey: qk.conversations,
    queryFn: api.conversations,
    // The inbox is the one place a stale unread badge is actively annoying.
    staleTime: 15_000,
  });
}

export function useDirectMessages(conversationId: string | null) {
  return useQuery({
    queryKey: qk.conversation(conversationId ?? ''),
    queryFn: () => api.directMessages(conversationId as string),
    enabled: !!conversationId,
  });
}

export function useSendDirectMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => api.sendDirectMessage(id, body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.conversation(v.id) });
      qc.invalidateQueries({ queryKey: qk.conversations });
    },
  });
}

export function useOpenConversation() {
  return useMutation({ mutationFn: (appUserId: string) => api.openConversation(appUserId) });
}

export function useSetMessagePrivacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: 'everyone' | 'followers' | 'nobody') => api.setMessagePrivacy(value),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile }),
  });
}

export function useReport() {
  return useMutation({ mutationFn: (body: Record<string, unknown>) => api.reportSomething(body) });
}

/* ── Clubs ─────────────────────────────────────────────────── */

export function useMyClubs() {
  return useQuery({ queryKey: qk.myClubs, queryFn: api.myClubs });
}

export function useDiscoverClubs(sport?: string) {
  return useQuery({
    queryKey: qk.discoverClubs(sport),
    queryFn: () => api.discoverClubs(sport),
    staleTime: 60_000,
  });
}

export function useClub(id: string | null) {
  return useQuery({
    queryKey: qk.club(id ?? ''),
    queryFn: () => api.club(id as string),
    enabled: !!id,
  });
}

export function useClubFeed(id: string | null, joined: boolean) {
  return useQuery({
    queryKey: qk.clubFeed(id ?? ''),
    queryFn: () => api.clubFeed(id as string),
    // The server refuses a non-member; asking anyway would just log a 404.
    enabled: !!id && joined,
  });
}

export function useClubEvents(id: string | null, joined: boolean) {
  return useQuery({
    queryKey: qk.clubEvents(id ?? ''),
    queryFn: () => api.clubEvents(id as string),
    enabled: !!id && joined,
  });
}

export function useClubMembers(id: string | null, joined: boolean) {
  return useQuery({
    queryKey: qk.clubMembers(id ?? ''),
    queryFn: () => api.clubMembers(id as string),
    enabled: !!id && joined,
  });
}

export function useCreateClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.createClub(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clubs'] }),
  });
}

export function useToggleClubMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, joined }: { id: string; joined: boolean }) =>
      joined ? api.leaveClub(id) : api.joinClub(id),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['clubs'] });
      qc.invalidateQueries({ queryKey: qk.club(v.id) });
      qc.invalidateQueries({ queryKey: ['club', v.id] });
    },
  });
}

export function useCreateClubEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.createClubEvent(id, body),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.clubEvents(v.id) }),
  });
}

export function useRsvp(clubId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, status }: { eventId: string; status: 'going' | 'interested' | null }) =>
      api.rsvp(eventId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clubEvents(clubId) }),
  });
}

/* ── Feed ──────────────────────────────────────────────────── */

/**
 * The feed, a page at a time.
 *
 * `api.feed` has always returned a `nextBefore` cursor and this hook used to
 * throw it away, so the feed stopped at page one with no way to reach anything
 * older — which reads to a member as "nobody I follow has done anything
 * lately" rather than as a page boundary.
 *
 * `getNextPageParam` returns undefined when the server sends a null cursor,
 * which is what tells React Query it has reached the end.
 */
export function useFeed() {
  return useInfiniteQuery({
    queryKey: qk.feed,
    queryFn: ({ pageParam }: { pageParam?: string }) => api.feed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: { nextBefore: string | null }) => last.nextBefore ?? undefined,
    staleTime: 30_000,
  });
}

export function useFollowing() {
  return useQuery({ queryKey: qk.following, queryFn: api.following });
}

export function useToggleFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, following }: { id: string; following: boolean }) =>
      following ? api.unfollow(id) : api.follow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.feed });
      qc.invalidateQueries({ queryKey: qk.following });
    },
  });
}

export function useBlockPerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.blockPerson(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.feed });
      qc.invalidateQueries({ queryKey: qk.following });
    },
  });
}

/**
 * Kudos, applied optimistically.
 *
 * A heart that waits for a round trip feels broken, and this is the one action
 * where being wrong for a moment costs nothing — the rollback restores the
 * exact previous value.
 */
export function useToggleKudos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kudosed }: { id: string; kudosed: boolean }) =>
      kudosed ? api.removeKudos(id) : api.giveKudos(id),
    onMutate: async ({ id, kudosed }) => {
      await qc.cancelQueries({ queryKey: qk.feed });
      const prev = qc.getQueryData(qk.feed);
      // The cache is paged now, so the activity could be on any page — map
      // every page rather than just the first. Missing this left kudos on
      // anything below the first page waiting for the round trip.
      qc.setQueryData(qk.feed, (old: any) =>
        !old?.pages ? old : {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            activities: page.activities.map((a: any) =>
              a.id !== id ? a : {
                ...a,
                kudosedByMe: !kudosed,
                kudosCount: a.kudosCount + (kudosed ? -1 : 1),
              },
            ),
          })),
        },
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.feed, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.feed }),
  });
}

export function useActivityComments(id: string | null) {
  return useQuery({
    queryKey: qk.activityComments(id ?? ''),
    queryFn: () => api.activityComments(id as string),
    enabled: !!id,
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => api.addActivityComment(id, body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.activityComments(v.id) });
      qc.invalidateQueries({ queryKey: qk.feed });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId }: { commentId: string; activityId: string }) =>
      api.deleteActivityComment(commentId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.activityComments(v.activityId) });
      qc.invalidateQueries({ queryKey: qk.feed });
    },
  });
}

/* ── Activities ────────────────────────────────────────────── */

/** The sports the server accepts. Effectively static, so cached hard. */
export function useSports() {
  return useQuery({ queryKey: qk.sports, queryFn: api.sports, staleTime: 3_600_000 });
}

export function useActivities(sport?: string) {
  return useQuery({
    queryKey: qk.activities(sport),
    queryFn: () => api.activities(undefined, sport),
    staleTime: 30_000,
  });
}

export function useActivity(id: string | null) {
  return useQuery({
    queryKey: qk.activity(id ?? ''),
    queryFn: () => api.activity(id as string),
    enabled: !!id,
  });
}

/**
 * Save a finished recording.
 *
 * Deliberately NOT through the offline outbox. The outbox replays a whole
 * payload later, and a recorded ride carries its streams in a second request —
 * a queued create whose streams never arrive would leave a headless activity.
 * The record screen keeps the track on the device until the save succeeds.
 */
export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ActivityInput) => api.createActivity(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities'] });
      qc.invalidateQueries({ queryKey: qk.home });
      // Fitness, form and race predictions are all functions of the activity
      // list. Leaving them cached shows a curve that ignores the session the
      // member just finished — the one moment they are most likely to look.
      qc.invalidateQueries({ queryKey: ['training'] });
    },
  });
}

export function usePutActivityStreams() {
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; streams: Record<string, unknown[]>; laps?: unknown[] }) =>
      api.putActivityStreams(id, body),
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.updateActivity(id, body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.activity(v.id) });
      qc.invalidateQueries({ queryKey: ['activities'] });
      qc.invalidateQueries({ queryKey: ['training'] });
    },
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteActivity(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities'] });
      qc.invalidateQueries({ queryKey: ['training'] });
    },
  });
}

/* ── Steps ─────────────────────────────────────────────────── */

export function useHealthDaily(days = 30) {
  return useQuery({
    queryKey: qk.healthDaily,
    queryFn: () => api.healthDaily(days),
    staleTime: 60_000,
  });
}

/**
 * Write one day's step total.
 *
 * Deliberately NOT through the offline outbox. The outbox exists for additive
 * writes that must not be lost or duplicated; this is a latest-wins upsert on
 * (member, day), so a queued stale count could overwrite a newer one on flush.
 * Losing a sync costs nothing — the next read re-sends the running total.
 */
export function useLogSteps() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { date: string; steps: number; source: string }) =>
      api.logHealthDaily(body),
    // Only the day's own rows are invalidated. A `steps` goal is NOT scored
    // from these — nothing on the server moves goal.currentValue when a day is
    // written, so the goals screen still reads 0 after a 6,482-step day. The
    // card uses the goal for its TARGET only.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.healthDaily }),
  });
}

/* ── Goals + profile ───────────────────────────────────────── */

export function useGoals() {
  // Goals change rarely and are read on Today as well as the goals screen, so
  // a short stale window keeps the dashboard off the network. Every mutation
  // below invalidates this key explicitly, so staleness never outlives an edit.
  return useQuery({ queryKey: qk.goals, queryFn: api.goals, staleTime: 300_000 });
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

/**
 * Routines, from whichever surface this member actually has.
 *
 * A gym member's routines live in their gym's schema and come from /routines.
 * Someone with no gym gets a 403 there, so theirs come from /me/routines — a
 * public table keyed by app_user_id.
 *
 * The branch lives HERE rather than in the screens, so every routine screen
 * stays one screen. The personal shape is normalised to `Routine` on the way
 * out: the two are near-identical, and letting a second shape reach the UI
 * would mean every consumer growing a fork.
 */
export function useRoutines(): {
  data: { routines: Routine[] } | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  isRefetching: boolean;
} {
  const who = useHasGym();
  const gym = useQuery({
    queryKey: ['routines'],
    queryFn: api.routines,
    enabled: !who.loading && who.hasGym,
  });
  const personal = useQuery({
    queryKey: ['routines', 'personal'],
    queryFn: api.personalRoutines,
    enabled: !who.loading && !who.hasGym,
  });

  if (who.hasGym) return gym;
  return {
    isLoading: who.loading || personal.isLoading,
    isError: personal.isError,
    // Only one branch is ever enabled, so refresh follows whichever this
    // member is on.
    refetch: personal.refetch,
    isRefetching: personal.isRefetching,
    data: personal.data
      ? {
          routines: personal.data.routines.map((r): Routine => ({
            id: r.id,
            name: r.name,
            notes: r.notes,
            // A personal routine has no share links yet, so it is never a copy.
            importedFromLink: false,
            updatedAt: r.updatedAt,
            exercises: r.exercises.map((e) => ({
              exerciseId: e.exerciseId,
              name: e.name,
              trackingType: e.trackingType === 'duration' ? 'duration' : 'reps',
              targetSets: e.targetSets ?? undefined,
              targetReps: e.targetReps ?? undefined,
              targetDurationSeconds: e.targetDurationSeconds ?? undefined,
            })),
          })),
        }
      : undefined,
  };
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
  const who = useHasGym();
  return useMutation({
    mutationFn: async (
      body: Parameters<typeof api.createRoutine>[0],
    ): Promise<Routine> => {
      if (who.hasGym) return api.createRoutine(body);
      const made = await api.createPersonalRoutine({
        name: body.name,
        notes: body.notes ?? undefined,
        exercises: (body.exercises ?? []).map((e) => ({
          exerciseId: e.exerciseId,
          targetSets: e.targetSets,
          targetReps: e.targetReps,
          targetDurationSeconds: e.targetDurationSeconds,
        })),
      });
      // Same normalisation as useRoutines, so callers see one shape.
      return {
        id: made.id,
        name: made.name,
        notes: made.notes,
        importedFromLink: false,
        updatedAt: made.updatedAt,
        exercises: made.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          name: e.name,
          trackingType: e.trackingType === 'duration' ? 'duration' : 'reps',
          targetSets: e.targetSets ?? undefined,
          targetReps: e.targetReps ?? undefined,
          targetDurationSeconds: e.targetDurationSeconds ?? undefined,
        })),
      };
    },
    // One prefix covers both surfaces: personal lives at ['routines','personal'].
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

/**
 * ────────────────────────────────────────────────────────────────
 * THE WEEKLY ROUTINE SCHEDULE
 * ────────────────────────────────────────────────────────────────
 *
 * Which routine the member trains on each weekday, and the prompt that appears
 * when they missed yesterday's.
 *
 * GYM MEMBERS ONLY for now. These endpoints read the tenant schema, so a
 * gym-less member gets a 403 — the public-schema half
 * (app_user_routine_schedule) has a table but no service behind it yet. The
 * `enabled` gate is what keeps an independent user from firing a request that
 * can only fail; when the gym-less service lands, this is the single place that
 * changes.
 */
export function useRoutineSchedule() {
  const who = useHasGym();
  return useQuery({
    queryKey: ['routine-schedule'] as const,
    queryFn: api.routineSchedule,
    enabled: !who.loading && who.hasGym,
    staleTime: 60_000,
  });
}

/**
 * What the member is meant to train today, and WHY there may be nothing.
 *
 * /home's todayWorkout says what to train but reports a chosen rest day and a
 * member with no schedule identically, as null. The home card has to word those
 * two differently, so it asks here for the reason.
 */
export function useTodayPlan() {
  const who = useHasGym();
  return useQuery({
    queryKey: ['today-plan'] as const,
    queryFn: api.todayPlan,
    enabled: !who.loading && who.hasGym,
    staleTime: 60_000,
  });
}

export function useSetScheduleDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ weekday, routineId }: { weekday: number; routineId: string | null }) =>
      api.setRoutineScheduleDay(weekday, routineId),
    onSuccess: (schedule) => {
      // The server returns the whole week, so seed it rather than refetch.
      qc.setQueryData(['routine-schedule'], schedule);
      // Today's card and the missed prompt both read from the schedule.
      qc.invalidateQueries({ queryKey: qk.home });
      qc.invalidateQueries({ queryKey: ['today-plan'] });
      qc.invalidateQueries({ queryKey: ['missed-yesterday'] });
    },
  });
}

/**
 * Yesterday's planned routine, when it was planned and not done.
 *
 * Not cached for long: it is a question about a day boundary, and a member who
 * leaves the app open across midnight should not still be asked about the day
 * before last.
 */
export function useMissedYesterday() {
  const who = useHasGym();
  return useQuery({
    queryKey: ['missed-yesterday'] as const,
    queryFn: api.missedYesterday,
    enabled: !who.loading && who.hasGym,
    staleTime: 60_000,
  });
}

/** "Do it now" — take up yesterday's session and slide the rest of the week. */
export function useResumeMissed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.resumeMissed,
    onSuccess: () => {
      // The whole week has shifted, so everything that reads it is now stale.
      qc.invalidateQueries({ queryKey: ['routine-schedule'] });
      qc.invalidateQueries({ queryKey: ['missed-yesterday'] });
      qc.invalidateQueries({ queryKey: ['today-plan'] });
      qc.invalidateQueries({ queryKey: qk.home });
    },
  });
}

/** "Back to my normal week" — clears any accumulated shift. */
export function useResetScheduleShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.resetScheduleShift,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routine-schedule'] });
      qc.invalidateQueries({ queryKey: ['today-plan'] });
      qc.invalidateQueries({ queryKey: qk.home });
    },
  });
}
