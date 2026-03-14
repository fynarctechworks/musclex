import { apiClient } from '@/services/api-client';

export const settingsApi = {
  getStudio: () =>
    apiClient.get('/settings/studio'),

  updateStudio: (data: {
    studio_name?: string;
    tagline?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    business_name?: string;
    business_type?: string;
    timezone?: string;
    currency?: string;
    billing_name?: string;
    billing_email?: string;
    billing_address?: string;
    tax_id?: string;
  }) => apiClient.patch('/settings/studio', data),

  getAccount: () =>
    apiClient.get('/settings/account'),

  getInvoices: () =>
    apiClient.get('/settings/invoices'),

  getBranchesSummary: () =>
    apiClient.get('/settings/branches-summary'),

  getPlans: () =>
    apiClient.get('/settings/plans'),
};
