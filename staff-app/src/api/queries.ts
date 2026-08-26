import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { buildCheckInBody, type CheckInInput } from '@/api/checkin-payload';
import { toLocalISODate } from '@/lib/format';
import type {
  ActivityItem, BodyStats, Branch, Expense, FinanceDashboard, MonthlyReport, Exercise, ExpenseSummary, ExpenseCategory, DashboardAlert, DashboardKpis, DashboardPulse, Member, MembershipPlan,
  ClassSession, MemberDetail, Paginated, Payment, Product, StaffRow, TrainerSession, WorkoutPlan,
  SessionAttendance,
  SessionRoster,
} from '@/api/types';

/**
 * React Query hooks.
 *
 * Query keys start with the resource name and carry every input that changes
 * the result, so `invalidateQueries({ queryKey: ['members'] })` clears all
 * member lists regardless of filter.
 *
 * Note the cache is wiped wholesale on sign-out, workspace switch and branch
 * change (see SessionProvider) — keys deliberately do NOT include the gym or
 * branch id, because relying on key uniqueness for tenant separation would be
 * one forgotten key away from a cross-tenant leak.
 */

export const keys = {
  branches: ['branches'] as const,
  dashboard: ['dashboard'] as const,
  payments: (params?: PaymentListParams) => ['payments', params ?? {}] as const,
  members: (params?: MemberListParams) => ['members', params ?? {}] as const,
  member: (id: string) => ['member', id] as const,
};

export function useBranches() {
  return useQuery({
    queryKey: keys.branches,
    // Branch lists change rarely; a long stale time avoids refetching on every
    // screen that shows the branch switcher.
    staleTime: 10 * 60_000,
    queryFn: () => api.get<Branch[]>('/branches'),
  });
}

/**
 * Dashboard.
 *
 * The four calls are separate queries rather than one aggregate so a single
 * slow or failing section (alerts hit several tables) cannot blank the whole
 * screen — each renders its own loading/error state.
 */
export function useDashboardKpis() {
  return useQuery({
    queryKey: [...keys.dashboard, 'kpis'],
    staleTime: 60_000,
    queryFn: () => api.get<DashboardKpis>('/dashboard/kpis'),
  });
}

export function useDashboardPulse() {
  return useQuery({
    queryKey: [...keys.dashboard, 'pulse'],
    staleTime: 60_000,
    queryFn: () => api.get<DashboardPulse>('/dashboard/pulse'),
  });
}

export function useDashboardAlerts() {
  return useQuery({
    queryKey: [...keys.dashboard, 'alerts'],
    queryFn: () => api.get<DashboardAlert[]>('/dashboard/alerts'),
  });
}

export function useActivityFeed() {
  return useQuery({
    queryKey: [...keys.dashboard, 'activity'],
    // The live check-in feed is the point of this section; keep it fresh.
    staleTime: 15_000,
    queryFn: () => api.get<ActivityItem[]>('/dashboard/activity-feed'),
  });
}

/**
 * Class sessions for one day.
 *
 * The API paginates rather than taking a date range, so the day filter is
 * applied here after fetching a generous page. A gym runs a handful of classes
 * a day, so this is cheap — but if a studio ever runs hundreds, this needs a
 * server-side date filter rather than a bigger page.
 */
/**
 * A month of class sessions.
 *
 * Fetched as a RANGE rather than "everything, then filter". The previous
 * version asked for `limit: 200` and threw away every session but the selected
 * day's — so the calendar could only ever dot one day (the caption promised
 * dots for days with activity, and a gym with classes every day showed none),
 * and a busy gym would silently fall off the end of the 200.
 *
 * The endpoint takes `date_from` / `date_to`, so the month the user is looking
 * at is exactly what gets fetched, and both the day's list and the whole
 * month's marks come out of the one response.
 */
export function useSessionsInMonth(month: Date) {
  const from = new Date(month.getFullYear(), month.getMonth(), 1);
  // Day 0 of the NEXT month is the last day of this one.
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const fromKey = toLocalISODate(from);
  const toKey = toLocalISODate(to);

  return useQuery({
    queryKey: ['class-sessions', fromKey, toKey],
    queryFn: async () => {
      const res = await api.get<Paginated<ClassSession>>('/classes/sessions', {
        params: { date_from: fromKey, date_to: toKey, limit: 500 },
      });
      return res.data ?? [];
    },
  });
}

/**
 * Bucket sessions by LOCAL calendar day.
 *
 * Local on both sides: `start_time` is a UTC instant, and slicing its ISO
 * string would file an evening class under the next day.
 */
export function groupSessionsByDay(sessions: ClassSession[]): Record<string, ClassSession[]> {
  const out: Record<string, ClassSession[]> = {};
  for (const s of sessions) {
    if (!s.start_time) continue;
    const key = toLocalISODate(new Date(s.start_time));
    (out[key] ??= []).push(s);
  }
  return out;
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    staleTime: 5 * 60_000,
    queryFn: () => api.get<Paginated<Product>>('/products', { params: { limit: 100 } }),
  });
}

/**
 * The signed-in user's STAFF row.
 *
 * POS sales require `staff_id` — the tenant staff row — but the session only
 * carries the auth user id. There is no /staff/me endpoint, so the row is found
 * by matching user_id in the staff list. Cached for the session: it does not
 * change while signed in.
 */
export function useCurrentStaff(userId: string | undefined) {
  return useQuery({
    queryKey: ['staff', 'me', userId ?? ''],
    enabled: Boolean(userId),
    staleTime: Infinity,
    queryFn: async () => {
      const res = await api.get<Paginated<StaffRow>>('/staff', { params: { limit: 200 } });
      return res.data.find((s) => s.user_id === userId) ?? null;
    },
  });
}

export type PosCartLine = { product: Product; quantity: number };

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      branchId: string;
      staffId: string;
      lines: PosCartLine[];
      paymentMethod: 'cash' | 'card' | 'upi' | 'wallet';
      memberId?: string;
    }) =>
      api.post<{ id: string; invoice_number?: string; total_amount?: number }>('/pos/sales', {
        branch_id: input.branchId,
        staff_id: input.staffId,
        payment_method: input.paymentMethod,
        items: input.lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        ...(input.memberId ? { member_id: input.memberId } : {}),
      }),
    onSuccess: () => {
      // A sale moves stock and money.
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export type PaymentListParams = { status?: string; page?: number; limit?: number };

/** Payments list. The row carries `member` when the API includes it. */
export function usePayments(params: PaymentListParams = {}) {
  const { limit = 20, ...rest } = params;
  return useQuery({
    queryKey: keys.payments({ ...rest, limit }),
    queryFn: () => api.get<Paginated<Payment & { member?: { full_name?: string } | null }>>(
      '/payments', { params: { ...rest, limit } },
    ),
  });
}

export type MemberListParams = {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export function useMembers(params: MemberListParams = {}) {
  const { limit = 20, ...rest } = params;
  return useQuery({
    queryKey: keys.members({ ...rest, limit }),
    queryFn: () => api.get<Paginated<Member>>('/members', { params: { ...rest, limit } }),
  });
}

export function useMember(id: string | undefined) {
  return useQuery({
    queryKey: keys.member(id ?? ''),
    enabled: Boolean(id),
    // Detail returns ALL memberships (the list only returns active ones), plus
    // payments and check-ins.
    queryFn: () => api.get<MemberDetail>(`/members/${id}`),
  });
}

/**
 * Check-in, by member id (manual) or by scanned QR token.
 *
 * `client_event_id` is a client-generated idempotency key. A gym doorway has
 * poor signal and staff double-tap; without it a retry records a second visit
 * and can consume a second class credit. The key is generated ONCE per attempt
 * and reused across retries.
 *
 * The scanned string is forwarded VERBATIM and is never parsed here. It is an
 * HMAC-signed token (`mxqr.v1…`) whose signature, gym and replay-nonce are all
 * checked server-side; a client that tried to decode it could only ever reach
 * a weaker conclusion than the server does, and any leniency we invented here
 * would become the real check.
 */
export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckInInput) =>
      api.post<{ id: string; status?: string }>('/check-ins', buildCheckInBody(input)),
    onSuccess: () => {
      // A check-in changes last_visit_at and the dashboard feed.
      void qc.invalidateQueries({ queryKey: ['members'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * One class session, and who is on it.
 *
 * Two calls because the API keeps them apart: the session carries the class
 * itself (name, time, capacity) and the roster carries the bookings. Fetched
 * separately so the header still renders if the roster is slow, rather than
 * the whole screen waiting on the longer of the two.
 */
export function useClassSession(id: string | undefined) {
  return useQuery({
    queryKey: ['class-session', id],
    queryFn: () => api.get<ClassSession>(`/classes/sessions/${id}`),
    enabled: Boolean(id),
  });
}

export function useSessionRoster(id: string | undefined) {
  return useQuery({
    queryKey: ['class-roster', id],
    queryFn: () => api.get<SessionRoster>(`/classes/bookings/session/${id}`),
    enabled: Boolean(id),
  });
}

/**
 * Book a member into a class.
 *
 * The seat claim is atomic server-side: a guarded `updateMany` that only
 * increments when a seat is genuinely free, so two staff booking the last
 * place at once cannot overbook — the loser goes to the waitlist. Nothing here
 * should second-guess that by pre-checking capacity, because a check on the
 * client is exactly the race the server already closed.
 */
export function useBookMember(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      api.post<{ booking_status?: string; waitlist_position?: number }>('/classes/bookings', {
        session_id: sessionId,
        member_id: memberId,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['class-roster', sessionId] });
      void qc.invalidateQueries({ queryKey: ['class-session', sessionId] });
      // The schedule's capacity bars are now stale too.
      void qc.invalidateQueries({ queryKey: ['class-sessions'] });
    },
  });
}

/** Cancel a booking — frees the seat and may promote somebody off the waitlist. */
export function useCancelBooking(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      api.post(`/classes/bookings/${bookingId}/cancel`, reason ? { reason } : {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['class-roster', sessionId] });
      void qc.invalidateQueries({ queryKey: ['class-session', sessionId] });
      void qc.invalidateQueries({ queryKey: ['class-sessions'] });
    },
  });
}

/**
 * Who actually turned up.
 *
 * A THIRD call, because bookings and attendance are separate tables and the
 * roster endpoint carries only the former. Merging them is the client's job —
 * without it a mark saves correctly and the row still reads "Not marked",
 * which is the one thing a register must never do.
 */
export function useSessionAttendance(id: string | undefined) {
  return useQuery({
    queryKey: ['class-attendance', id],
    queryFn: () => api.get<SessionAttendance>(`/classes/bookings/attendance/${id}`),
    enabled: Boolean(id),
  });
}

/**
 * Mark one member's attendance.
 *
 * Deliberately per-member rather than a save-at-the-end form. A trainer marks
 * the register while people walk in, and a screen that loses the marks when
 * the app is backgrounded mid-class is worse than useless — the class is over
 * by the time anyone notices.
 */
export function useMarkAttendance(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { memberId: string; status: string }) =>
      api.post(`/classes/bookings/attendance/${sessionId}`, {
        member_id: input.memberId,
        attendance_status: input.status,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['class-attendance', sessionId] });
    },
  });
}

/** Mark everyone still unmarked in one call — the common end-of-class action. */
export function useBulkAttendance(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entries: { member_id: string; attendance_status: string }[]) =>
      api.post(`/classes/bookings/attendance/${sessionId}/bulk`, { entries }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['class-attendance', sessionId] });
    },
  });
}

/** Headline finance numbers. Gym-wide; no branch needed. */
export function useFinanceDashboard() {
  return useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: () => api.get<FinanceDashboard>('/financial-reports/dashboard'),
  });
}

/**
 * One month's P&L.
 *
 * `branch_id` is REQUIRED — like the expense summary, and unlike the finance
 * dashboard above. The inconsistency is the API's, not ours; the screen copes
 * by only asking once a branch is chosen rather than sending a request that
 * can only 400.
 */
export function useMonthlyReport(branchId: string | null | undefined, month?: Date) {
  const when = month ?? new Date();
  const year = when.getFullYear();
  const monthNum = when.getMonth() + 1;

  return useQuery({
    queryKey: ['monthly-report', branchId ?? '', year, monthNum],
    enabled: Boolean(branchId),
    queryFn: () =>
      api.get<MonthlyReport>('/financial-reports/monthly', {
        params: { branch_id: branchId, year, month: monthNum },
      }),
  });
}

/**
 * Expenses — what the gym spent.
 *
 * `amount` arrives as a Decimal string like every other money field here, so
 * callers must coerce before arithmetic (`toAmount` in lib/format).
 */
export function useExpenses(params: { branchId?: string | null; limit?: number } = {}) {
  const { branchId, limit = 50 } = params;
  return useQuery({
    queryKey: ['expenses', branchId ?? 'all', limit],
    queryFn: () =>
      api.get<Paginated<Expense>>('/expenses', {
        params: { limit, ...(branchId ? { branch_id: branchId } : {}) },
      }),
  });
}

/**
 * Today, this month, and a category breakdown.
 *
 * `branch_id` is REQUIRED by this endpoint — it 400s without one — unlike the
 * list, which happily spans branches. So the caller must resolve a branch
 * before asking, and the summary is skipped on "All branches" rather than
 * firing a request that can only fail.
 */
export function useExpenseSummary(branchId: string | null | undefined) {
  return useQuery({
    queryKey: ['expense-summary', branchId ?? ''],
    enabled: Boolean(branchId),
    queryFn: () =>
      api.get<ExpenseSummary>('/expenses/summary', { params: { branch_id: branchId } }),
  });
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense-categories'],
    staleTime: 10 * 60 * 1000,
    queryFn: () => api.get<ExpenseCategory[]>('/expense-categories'),
  });
}

/**
 * The membership plans this gym sells.
 *
 * Returns a bare ARRAY, not the `{ data, total }` envelope most list endpoints
 * use — so it must not be unwrapped like the others. Assuming the envelope
 * yields `undefined` and an empty screen that looks like "this gym sells
 * nothing".
 */
export function useMembershipPlans() {
  return useQuery({
    queryKey: ['membership-plans'],
    staleTime: 5 * 60_000,
    queryFn: () => api.get<MembershipPlan[]>('/membership-plans'),
  });
}

/**
 * The gym's staff.
 *
 * Note the shape difference from `useCurrentStaff` below: this is the LIST for
 * a manager to read, while that one exists only to resolve the signed-in
 * user's staff row id. They hit the same endpoint; keeping them separate stops
 * a screen filter from invalidating the id lookup POS and PT sessions depend on.
 */
export function useStaff(limit = 100) {
  return useQuery({
    queryKey: ['staff', 'list', limit],
    queryFn: () => api.get<Paginated<StaffRow>>('/staff', { params: { limit } }),
  });
}

/** Record an expense. Append-only: the API models these as events. */
export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      branchId: string;
      categoryId: string;
      amount: number;
      description: string;
      expenseDate: string;
      vendor?: string;
      paymentMethod?: string;
    }) =>
      api.post<Expense>('/expenses', {
        branch_id: input.branchId,
        category_id: input.categoryId,
        amount: input.amount,
        description: input.description,
        expense_date: input.expenseDate,
        ...(input.vendor ? { vendor: input.vendor } : {}),
        ...(input.paymentMethod ? { payment_method: input.paymentMethod } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['expense-summary'] });
    },
  });
}

/**
 * The gym's workout plan library.
 *
 * Gated on `members.view`, which every staff role has — a trainer can read the
 * library. Authoring needs `members.create`/`edit`, which trainers do NOT have,
 * so the screen is read-only for them by design (see TODO_FOR_ME item 7 — the
 * same permissions question as measurements).
 */
export function useWorkoutPlans(limit = 50) {
  return useQuery({
    queryKey: ['workout-plans', limit],
    queryFn: () => api.get<Paginated<WorkoutPlan>>('/workout-plans', { params: { limit } }),
  });
}

/** One plan WITH its exercises — the list endpoint omits them. */
export function useWorkoutPlan(id: string | undefined) {
  return useQuery({
    queryKey: ['workout-plan', id],
    queryFn: () => api.get<WorkoutPlan>(`/workout-plans/${id}`),
    enabled: Boolean(id),
  });
}

/**
 * The exercise library.
 *
 * Filtered server-side by muscle group rather than fetched whole and filtered
 * here: the library grows per gym, and "download everything then hide most of
 * it" is the habit that makes a list screen slow on the mid-range Android
 * phones front-desk staff actually use.
 */
export function useExercises(params: { search?: string; muscleGroup?: string } = {}) {
  const { search, muscleGroup } = params;
  return useQuery({
    queryKey: ['exercises', search ?? '', muscleGroup ?? ''],
    queryFn: () =>
      api.get<Paginated<Exercise>>('/exercises', {
        params: {
          limit: 100,
          ...(search ? { search } : {}),
          ...(muscleGroup ? { muscle_group: muscleGroup } : {}),
        },
      }),
  });
}

/**
 * PT sessions.
 *
 * `trainer_id` is the STAFF row id, not the auth user id the session carries —
 * they are different columns (`staff.id` vs `staff.user_id`). Passing the auth
 * id makes the API throw "Trainer not found", so callers must resolve their
 * staff row first via `useCurrentStaff`. This is the same mismatch POS already
 * had to solve.
 */
export function usePtSessions(params: {
  trainerId?: string | null;
  status?: string;
  limit?: number;
  /**
   * Hold the request until the caller knows WHICH trainer it means. Filtering
   * by "me" before the staff row resolves would otherwise fire a query with no
   * trainer_id and quietly show the whole gym's sessions as if they were mine.
   */
  enabled?: boolean;
} = {}) {
  const { trainerId, status, limit = 50, enabled = true } = params;
  return useQuery({
    enabled,
    queryKey: ['pt-sessions', trainerId ?? 'all', status ?? 'all', limit],
    queryFn: () =>
      api.get<Paginated<TrainerSession>>('/trainer/sessions', {
        params: {
          limit,
          ...(trainerId ? { trainer_id: trainerId } : {}),
          ...(status ? { status } : {}),
        },
      }),
  });
}

/**
 * Change a PT session's outcome.
 *
 * Completing one is not merely a status flip: the server records trainer
 * revenue and commission off it, priced from the gym's configured session
 * rate. So this is a money-moving action, which is why it sits behind
 * `staff.edit` rather than the trainer's own `staff.view`.
 */
export function useUpdatePtSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status?: string; notes?: string }) =>
      api.patch<TrainerSession>(`/trainer/sessions/${id}`, {
        ...(status ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pt-sessions'] });
    },
  });
}

/**
 * A member's measurement history, newest first (the API's own order).
 *
 * Numbers arrive as Prisma `Decimal`s serialised to STRINGS, so nothing here
 * may assume `number`. `toAmount()` in lib/format handles the same problem for
 * money; measurements need the same care, and forgetting it is how a chart
 * plots NaN and renders nothing.
 */
export function useBodyStats(memberId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ['body-stats', memberId, limit],
    queryFn: () => api.get<BodyStats[]>(`/members/${memberId}/body-stats`, { params: { limit } }),
    enabled: Boolean(memberId),
  });
}

/** Record a new measurement. */
export function useRecordBodyStats(memberId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, number>) =>
      api.post<BodyStats>(`/members/${memberId}/body-stats`, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['body-stats', memberId] });
      void qc.invalidateQueries({ queryKey: ['member', memberId] });
    },
  });
}

/**
 * The offline roster.
 *
 * Member SEARCH is server-side, which means that with no uplink the front desk
 * cannot find the person standing in front of them — and an offline check-in
 * queue you cannot reach is worth nothing. So a page of members is fetched and
 * persisted deliberately, to be searched locally when the server is
 * unreachable.
 *
 * 500 is the server's own clamp on this endpoint. A gym larger than that has a
 * PARTIAL offline roster, and the check-in screen says so rather than
 * implying the member does not exist.
 */
export const ROSTER_LIMIT = 500;

export function useMemberRoster(enabled = true) {
  return useQuery({
    // A key of its own, so it is not invalidated by every filtered list view
    // and is cached as one stable entry.
    queryKey: ['members', 'roster'],
    queryFn: () => api.get<Paginated<Member>>('/members', { params: { limit: ROSTER_LIMIT } }),
    enabled,
    // The roster is a fallback, not a live view — refetching it constantly
    // would cost a 500-row payload for data only read when the network dies.
    staleTime: 15 * 60 * 1000,
  });
}

/**
 * Edit a member's own details.
 *
 * PATCH, and only the fields that actually changed — a full-object PUT from a
 * short mobile form would blank the columns the phone never showed (date of
 * birth, address, emergency contact), silently destroying data the web app
 * collected.
 */
export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Record<string, unknown> }) =>
      api.patch<Member>(`/members/${id}`, changes),
    onSuccess: (member) => {
      void qc.invalidateQueries({ queryKey: ['members'] });
      void qc.invalidateQueries({ queryKey: ['member', member?.id] });
    },
  });
}

/**
 * Create a member.
 *
 * `branch_id` is required by the DTO. When the user is on "All branches" we
 * fall back to their first assigned branch rather than failing validation with
 * a message the staffer cannot act on.
 */
export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      fullName: string; phone: string; email?: string; branchId: string;
      gender?: string;
    }) =>
      api.post<Member>('/members', {
        full_name: input.fullName.trim(),
        phone: input.phone.trim(),
        branch_id: input.branchId,
        ...(input.email?.trim() ? { email: input.email.trim() } : {}),
        ...(input.gender ? { gender: input.gender } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['members'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * Record a payment taken at the desk.
 *
 * POST /payments/cash despite the name — the endpoint covers cash, card, UPI
 * and bank transfer; "cash" here means "recorded manually" as opposed to a
 * gateway callback.
 */
export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      memberId: string; branchId: string; amount: number;
      method: 'cash' | 'card' | 'upi' | 'bank_transfer'; membershipId?: string;
    }) =>
      api.post<{ id: string; receipt_number?: string }>('/payments/cash', {
        member_id: input.memberId,
        branch_id: input.branchId,
        amount: input.amount,
        payment_method: input.method,
        ...(input.membershipId ? { membership_id: input.membershipId } : {}),
      }),
    onSuccess: (_r, input) => {
      void qc.invalidateQueries({ queryKey: ['payments'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: keys.member(input.memberId) });
    },
  });
}

/** Invalidate every member list — use after any mutation that changes one. */
export function useInvalidateMembers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['members'] });
}

export { useMutation };
