/**
 * React Query client configuration.
 * Centralized defaults for caching, retries, and stale times.
 */

import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 3 * 60 * 1000,   // 3 minutes — data fresh enough for gym ops
        gcTime: 20 * 60 * 1000,     // 20 minutes — keep cache across nav
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,      // use cache if data exists, don't refetch on every mount
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
    pulse: (branchId?: string) => [...queryKeys.dashboard.all, 'pulse', branchId] as const,
    actions: (branchId?: string) => [...queryKeys.dashboard.all, 'actions', branchId] as const,
    actionReceipts: (limit?: number) =>
      [...queryKeys.dashboard.all, 'action-receipts', limit] as const,
    revenueChart: (months?: number, branchId?: string) =>
      [...queryKeys.dashboard.all, 'revenue-chart', months, branchId] as const,
    activityFeed: (limit?: number, branchId?: string) => [...queryKeys.dashboard.all, 'activity-feed', limit, branchId] as const,
    alerts: (branchId?: string) => [...queryKeys.dashboard.all, 'alerts', branchId] as const,
    branchComparison: () => [...queryKeys.dashboard.all, 'branch-comparison'] as const,
    // Wave 8–14
    tiles: () => [...queryKeys.dashboard.all, 'tiles'] as const,
    occupancy: (branchId?: string) => [...queryKeys.dashboard.all, 'occupancy', branchId] as const,
    todaysClasses: (branchId?: string) => [...queryKeys.dashboard.all, 'todays-classes', branchId] as const,
    revenueMix: (groupBy?: 'plan' | 'trainer', branchId?: string, from?: string, to?: string) =>
      [...queryKeys.dashboard.all, 'revenue-mix', groupBy, branchId, from, to] as const,
    paymentMethods: (branchId?: string, from?: string, to?: string) =>
      [...queryKeys.dashboard.all, 'payment-methods', branchId, from, to] as const,
    revenueSummary: (branchId?: string, from?: string, to?: string) =>
      [...queryKeys.dashboard.all, 'revenue-summary', branchId, from, to] as const,
    cohorts: (branchId?: string, months?: number) =>
      [...queryKeys.dashboard.all, 'cohorts', branchId, months] as const,
    segments: (branchId?: string) => [...queryKeys.dashboard.all, 'segments', branchId] as const,
    businessMetrics: (branchId?: string) => [...queryKeys.dashboard.all, 'business-metrics', branchId] as const,
    heatmap: (branchId?: string, days?: number) => [...queryKeys.dashboard.all, 'heatmap', branchId, days] as const,
    systemStatus: () => [...queryKeys.dashboard.all, 'system-status'] as const,
    inventory: (branchId?: string) => [...queryKeys.dashboard.all, 'inventory', branchId] as const,
    layout: () => [...queryKeys.dashboard.all, 'layout'] as const,
  },

  // Members
  members: {
    all: ['members'] as const,
    list: (filters?: unknown) => [...queryKeys.members.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.members.all, 'detail', id] as const,
    profile: (id: string) => [...queryKeys.members.all, 'profile', id] as const,
    bodyStats: (id: string) => [...queryKeys.members.all, 'body-stats', id] as const,
    progressSummary: (id: string) => [...queryKeys.members.all, 'progress-summary', id] as const,
    progressPhotos: (id: string) => [...queryKeys.members.all, 'progress-photos', id] as const,
    visits: (id: string) => [...queryKeys.members.all, 'visits', id] as const,
    notes: (id: string) => [...queryKeys.members.all, 'notes', id] as const,
    tags: (id: string) => [...queryKeys.members.all, 'tags', id] as const,
    allTags: () => [...queryKeys.members.all, 'all-tags'] as const,
    documents: (id: string) => [...queryKeys.members.all, 'documents', id] as const,
    referrals: (id: string) => [...queryKeys.members.all, 'referrals', id] as const,
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
    timeline: (filters?: unknown) => [...queryKeys.expenses.all, 'timeline', filters] as const,
    summary: (branchId?: string, month?: string) => [...queryKeys.expenses.all, 'summary', branchId, month] as const,
    intelligence: (branchId: string, range?: unknown) => [...queryKeys.expenses.all, 'intelligence', branchId, range] as const,
    detail: (id: string) => [...queryKeys.expenses.all, 'detail', id] as const,
    categories: (filters?: unknown) => [...queryKeys.expenses.all, 'categories', filters] as const,
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
    invites: (filters?: unknown) => [...queryKeys.staff.all, 'invites', filters] as const,
    permissions: (staffId: string) => [...queryKeys.staff.all, 'permissions', staffId] as const,
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

  // Inventory
  inventory: {
    all: ['inventory'] as const,
    products: (filters?: unknown) => [...queryKeys.inventory.all, 'products', filters] as const,
    product: (id: string) => [...queryKeys.inventory.all, 'product', id] as const,
    categories: () => [...queryKeys.inventory.all, 'categories'] as const,
    stock: (filters?: unknown) => [...queryKeys.inventory.all, 'stock', filters] as const,
    lowStock: () => [...queryKeys.inventory.all, 'low-stock'] as const,
    transactions: (filters?: unknown) => [...queryKeys.inventory.all, 'transactions', filters] as const,
    suppliers: (filters?: unknown) => [...queryKeys.inventory.all, 'suppliers', filters] as const,
    supplier: (id: string) => [...queryKeys.inventory.all, 'supplier', id] as const,
    batches: (filters?: unknown) => [...queryKeys.inventory.all, 'batches', filters] as const,
    expiringBatches: (filters?: unknown) => [...queryKeys.inventory.all, 'expiring-batches', filters] as const,
    transfers: (filters?: unknown) => [...queryKeys.inventory.all, 'transfers', filters] as const,
    transfer: (id: string) => [...queryKeys.inventory.all, 'transfer', id] as const,
    branchPrices: (productId: string) => [...queryKeys.inventory.all, 'branch-prices', productId] as const,
    bundles: (filters?: unknown) => [...queryKeys.inventory.all, 'bundles', filters] as const,
    bundle: (id: string) => [...queryKeys.inventory.all, 'bundle', id] as const,
  },

  // POS
  pos: {
    all: ['pos'] as const,
    sales: (filters?: unknown) => [...queryKeys.pos.all, 'sales', filters] as const,
    sale: (id: string) => [...queryKeys.pos.all, 'sale', id] as const,
    dailyReport: (branchId: string, date?: string) => [...queryKeys.pos.all, 'daily-report', branchId, date] as const,
    topProducts: (filters?: unknown) => [...queryKeys.pos.all, 'top-products', filters] as const,
  },

  // Wallet & Loyalty
  wallet: {
    all: ['wallet'] as const,
    member: (memberId: string) => [...queryKeys.wallet.all, 'member', memberId] as const,
    transactions: (memberId: string, filters?: unknown) =>
      [...queryKeys.wallet.all, 'transactions', memberId, filters] as const,
    loyaltyConfig: () => [...queryKeys.wallet.all, 'loyalty-config'] as const,
  },

  // Analytics / Reports
  analytics: {
    all: ['analytics'] as const,
    dashboard: (filters?: unknown) => [...queryKeys.analytics.all, 'dashboard', filters] as const,
    dailyMetrics: (filters?: unknown) => [...queryKeys.analytics.all, 'daily-metrics', filters] as const,
    trend: (filters?: unknown) => [...queryKeys.analytics.all, 'trend', filters] as const,
    revenue: (filters?: unknown) => [...queryKeys.analytics.all, 'revenue', filters] as const,
    memberships: (filters?: unknown) => [...queryKeys.analytics.all, 'memberships', filters] as const,
    classes: (filters?: unknown) => [...queryKeys.analytics.all, 'classes', filters] as const,
    memberBehavior: (filters?: unknown) => [...queryKeys.analytics.all, 'member-behavior', filters] as const,
    churnRisk: (filters?: unknown) => [...queryKeys.analytics.all, 'churn-risk', filters] as const,
    trainers: (filters?: unknown) => [...queryKeys.analytics.all, 'trainers', filters] as const,
    trainerLeaderboard: (filters?: unknown) => [...queryKeys.analytics.all, 'trainer-leaderboard', filters] as const,
    campaigns: (filters?: unknown) => [...queryKeys.analytics.all, 'campaigns', filters] as const,
    branchComparison: (filters?: unknown) => [...queryKeys.analytics.all, 'branch-comparison', filters] as const,
  },

  // Search
  search: {
    all: ['search'] as const,
    results: (query: string, entities?: string[]) => [...queryKeys.search.all, query, entities] as const,
  },
} as const;
