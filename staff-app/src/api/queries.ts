import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { buildCheckInBody, type CheckInInput } from '@/api/checkin-payload';
import { toLocalISODate } from '@/lib/format';
import type {
  ActivityItem, Branch, DashboardAlert, DashboardKpis, DashboardPulse, Member,
  ClassSession, MemberDetail, Paginated, Payment, Product, StaffRow,
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
export function useSessionsForDay(day: Date) {
  const key = toLocalISODate(day);
  return useQuery({
    queryKey: ['class-sessions', key],
    queryFn: async () => {
      const res = await api.get<Paginated<ClassSession>>('/classes/sessions', {
        params: { limit: 200 },
      });
      // Compare in LOCAL time on both sides: start_time is a UTC instant, and
      // slicing its ISO string would bucket an evening class into the next day.
      return res.data.filter(
        (s) => s.start_time && toLocalISODate(new Date(s.start_time)) === key,
      );
    },
  });
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
