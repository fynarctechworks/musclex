/**
 * React Query client configuration.
 * Centralized defaults for caching, retries, and stale times.
 */

import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,       // 1 minute
        gcTime: 5 * 60 * 1000,      // 5 minutes garbage collection
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// ─── Query Key Factory ───────────────────────────────────────
// Consistent key structure: [module, entity, ...filters]
// This prevents cache collisions and enables targeted invalidation.

export const queryKeys = {
  // Auth
  auth: {
    all: ['auth'] as const,
    session: () => [...queryKeys.auth.all, 'session'] as const,
    plans: () => [...queryKeys.auth.all, 'plans'] as const,
  },

  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    kpis: (branchId?: string) => [...queryKeys.dashboard.all, 'kpis', branchId] as const,
    revenueChart: (months?: number, branchId?: string) =>
      [...queryKeys.dashboard.all, 'revenue-chart', months, branchId] as const,
    activityFeed: (limit?: number) => [...queryKeys.dashboard.all, 'activity-feed', limit] as const,
    alerts: () => [...queryKeys.dashboard.all, 'alerts'] as const,
    branchComparison: () => [...queryKeys.dashboard.all, 'branch-comparison'] as const,
  },

  // Members
  members: {
    all: ['members'] as const,
    list: (filters?: unknown) => [...queryKeys.members.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.members.all, 'detail', id] as const,
    profile: (id: string) => [...queryKeys.members.all, 'profile', id] as const,
    bodyStats: (id: string) => [...queryKeys.members.all, 'body-stats', id] as const,
    visits: (id: string) => [...queryKeys.members.all, 'visits', id] as const,
    notes: (id: string) => [...queryKeys.members.all, 'notes', id] as const,
    tags: (id: string) => [...queryKeys.members.all, 'tags', id] as const,
    documents: (id: string) => [...queryKeys.members.all, 'documents', id] as const,
    churnRisk: () => [...queryKeys.members.all, 'churn-risk'] as const,
  },

  // Memberships
  memberships: {
    all: ['memberships'] as const,
    plans: (filters?: unknown) => [...queryKeys.memberships.all, 'plans', filters] as const,
    detail: (id: string) => [...queryKeys.memberships.all, 'detail', id] as const,
  },

  // Check-ins
  checkIns: {
    all: ['check-ins'] as const,
    list: (filters?: unknown) => [...queryKeys.checkIns.all, 'list', filters] as const,
    heatmap: (branchId?: string) => [...queryKeys.checkIns.all, 'heatmap', branchId] as const,
  },

  // Payments
  payments: {
    all: ['payments'] as const,
    list: (filters?: unknown) => [...queryKeys.payments.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.payments.all, 'detail', id] as const,
    invoice: (id: string) => [...queryKeys.payments.all, 'invoice', id] as const,
  },

  // Expenses
  expenses: {
    all: ['expenses'] as const,
    list: (filters?: unknown) => [...queryKeys.expenses.all, 'list', filters] as const,
  },

  // Finance
  finance: {
    all: ['finance'] as const,
    invoices: (filters?: unknown) => [...queryKeys.finance.all, 'invoices', filters] as const,
    invoice: (id: string) => [...queryKeys.finance.all, 'invoice', id] as const,
    refunds: (filters?: unknown) => [...queryKeys.finance.all, 'refunds', filters] as const,
    discounts: (filters?: unknown) => [...queryKeys.finance.all, 'discounts', filters] as const,
    dailyReport: (branchId: string, date?: string) => [...queryKeys.finance.all, 'daily', branchId, date] as const,
    monthlyReport: (branchId: string, year?: number, month?: number) => [...queryKeys.finance.all, 'monthly', branchId, year, month] as const,
    dashboard: (branchId: string) => [...queryKeys.finance.all, 'dashboard', branchId] as const,
    membershipRevenue: (branchId: string, dateFrom?: string, dateTo?: string) => [...queryKeys.finance.all, 'membership-revenue', branchId, dateFrom, dateTo] as const,
    ledger: (filters?: unknown) => [...queryKeys.finance.all, 'ledger', filters] as const,
  },

  // Classes
  classes: {
    all: ['classes'] as const,
    list: (filters?: unknown) => [...queryKeys.classes.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.classes.all, 'detail', id] as const,
    templates: (filters?: unknown) => [...queryKeys.classes.all, 'templates', filters] as const,
    template: (id: string) => [...queryKeys.classes.all, 'template', id] as const,
    sessions: (filters?: unknown) => [...queryKeys.classes.all, 'sessions', filters] as const,
    session: (id: string) => [...queryKeys.classes.all, 'session', id] as const,
    bookings: (sessionId: string) => [...queryKeys.classes.all, 'bookings', sessionId] as const,
    memberBookings: (memberId: string, filters?: unknown) => [...queryKeys.classes.all, 'member-bookings', memberId, filters] as const,
    attendance: (sessionId: string) => [...queryKeys.classes.all, 'attendance', sessionId] as const,
    memberAttendance: (memberId: string, filters?: unknown) => [...queryKeys.classes.all, 'member-attendance', memberId, filters] as const,
    rooms: (branchId?: string) => [...queryKeys.classes.all, 'rooms', branchId] as const,
    recurringRules: (filters?: unknown) => [...queryKeys.classes.all, 'recurring-rules', filters] as const,
    trainerSchedule: (trainerId: string, filters?: unknown) => [...queryKeys.classes.all, 'trainer-schedule', trainerId, filters] as const,
  },

  // Staff
  staff: {
    all: ['staff'] as const,
    list: (filters?: unknown) => [...queryKeys.staff.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.staff.all, 'detail', id] as const,
    profile: (id: string) => [...queryKeys.staff.all, 'profile', id] as const,
    availability: (id: string) => [...queryKeys.staff.all, 'availability', id] as const,
    attendance: (id: string, filters?: unknown) => [...queryKeys.staff.all, 'attendance', id, filters] as const,
    shifts: (filters?: unknown) => [...queryKeys.staff.all, 'shifts', filters] as const,
    leaves: (filters?: unknown) => [...queryKeys.staff.all, 'leaves', filters] as const,
    trainers: () => [...queryKeys.staff.all, 'trainers'] as const,
    trainerClients: (id: string) => [...queryKeys.staff.all, 'trainer-clients', id] as const,
    trainerSessions: (filters?: unknown) => [...queryKeys.staff.all, 'trainer-sessions', filters] as const,
    trainerDashboard: (id: string) => [...queryKeys.staff.all, 'trainer-dashboard', id] as const,
    trainerPerformance: (filters?: unknown) => [...queryKeys.staff.all, 'trainer-performance', filters] as const,
    payroll: (filters?: unknown) => [...queryKeys.staff.all, 'payroll', filters] as const,
    payrollConfig: (staffId: string) => [...queryKeys.staff.all, 'payroll-config', staffId] as const,
    payrollSummary: (filters?: unknown) => [...queryKeys.staff.all, 'payroll-summary', filters] as const,
    payrollRevenue: (filters?: unknown) => [...queryKeys.staff.all, 'payroll-revenue', filters] as const,
  },

  // Marketing
  marketing: {
    all: ['marketing'] as const,
    campaigns: (filters?: unknown) => [...queryKeys.marketing.all, 'campaigns', filters] as const,
    campaignDetail: (id: string) => [...queryKeys.marketing.all, 'campaign', id] as const,
    campaignAudience: (id: string, filters?: unknown) => [...queryKeys.marketing.all, 'campaign-audience', id, filters] as const,
    campaignAnalytics: (id: string) => [...queryKeys.marketing.all, 'campaign-analytics', id] as const,
    leads: (filters?: unknown) => [...queryKeys.marketing.all, 'leads', filters] as const,
    leadDetail: (id: string) => [...queryKeys.marketing.all, 'lead', id] as const,
    leadActivities: (id: string) => [...queryKeys.marketing.all, 'lead-activities', id] as const,
    leadFunnel: (filters?: unknown) => [...queryKeys.marketing.all, 'lead-funnel', filters] as const,
    templates: (filters?: unknown) => [...queryKeys.marketing.all, 'templates', filters] as const,
    template: (id: string) => [...queryKeys.marketing.all, 'template', id] as const,
    workflows: (filters?: unknown) => [...queryKeys.marketing.all, 'workflows', filters] as const,
    workflow: (id: string) => [...queryKeys.marketing.all, 'workflow', id] as const,
    referralPrograms: (filters?: unknown) => [...queryKeys.marketing.all, 'referral-programs', filters] as const,
    referralProgram: (id: string) => [...queryKeys.marketing.all, 'referral-program', id] as const,
    referralStats: () => [...queryKeys.marketing.all, 'referral-stats'] as const,
    notifications: (memberId: string) => [...queryKeys.marketing.all, 'notifications', memberId] as const,
  },

  // AI
  ai: {
    all: ['ai'] as const,
    conversations: () => [...queryKeys.ai.all, 'conversations'] as const,
    briefing: () => [...queryKeys.ai.all, 'briefing'] as const,
  },

  // Branches
  branches: {
    all: ['branches'] as const,
    list: (filters?: unknown) => [...queryKeys.branches.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.branches.all, 'detail', id] as const,
    settings: (id: string) => [...queryKeys.branches.all, 'settings', id] as const,
  },

  // Settings
  settings: {
    all: ['settings'] as const,
    studio: () => [...queryKeys.settings.all, 'studio'] as const,
    account: () => [...queryKeys.settings.all, 'account'] as const,
    invoices: () => [...queryKeys.settings.all, 'invoices'] as const,
    branchesSummary: () => [...queryKeys.settings.all, 'branches-summary'] as const,
    plans: () => [...queryKeys.settings.all, 'plans'] as const,
    roles: () => [...queryKeys.settings.all, 'roles'] as const,
    integrations: () => [...queryKeys.settings.all, 'integrations'] as const,
  },

  // Search
  search: {
    all: ['search'] as const,
    results: (query: string, entities?: string[]) => [...queryKeys.search.all, query, entities] as const,
  },
} as const;
