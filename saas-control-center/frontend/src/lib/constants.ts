export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api/v1';

export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  TRIAL: 'bg-blue-50 text-blue-700 border-blue-200',
  TRIALING: 'bg-blue-50 text-blue-700 border-blue-200',
  EXPIRED: 'bg-red-50 text-red-700 border-red-200',
  SUSPENDED: 'bg-orange-50 text-orange-700 border-orange-200',
  PAST_DUE: 'bg-amber-50 text-amber-700 border-amber-200',
  CANCELED: 'bg-gray-50 text-gray-600 border-gray-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  REFUNDED: 'bg-purple-50 text-purple-700 border-purple-200',
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-blue-50 text-blue-700 border-blue-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
  SUSPEND: 'bg-orange-50 text-orange-700 border-orange-200',
  ACTIVATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  IMPERSONATE: 'bg-purple-50 text-purple-700 border-purple-200',
  LOGIN: 'bg-gray-50 text-gray-600 border-gray-200',
  PLAN_CHANGE: 'bg-blue-50 text-blue-700 border-blue-200',
  PAYMENT_RETRY: 'bg-amber-50 text-amber-700 border-amber-200',
  REFUND: 'bg-purple-50 text-purple-700 border-purple-200',
  FEATURE_TOGGLE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};
