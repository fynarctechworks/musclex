import { apiClient } from '@/services/api-client';

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>('/auth/login', { email, password }),

  register: (data: { full_name: string; email: string; password: string; phone?: string }) =>
    apiClient.post<{ success: boolean; email: string; verification_url?: string; skip_verification?: boolean; access_token?: string; refresh_token?: string; user?: any }>('/auth/register', data),

  verifyEmail: (token: string) =>
    apiClient.post<LoginResponse>('/auth/verify-email', { token }),

  resendVerification: (email: string) =>
    apiClient.post<{ sent: boolean; verification_url?: string }>('/auth/resend-verification', { email }),

  forgotPassword: (email: string) =>
    apiClient.post<{ success: boolean }>('/auth/forgot-password', { email }),

  resetPassword: (otp: string, new_password: string) =>
    apiClient.post<{ success: boolean }>('/auth/reset-password', { otp, new_password }),

  getPlans: () =>
    apiClient.get<PlanItem[]>('/auth/plans'),

  selectPlan: (planId: string) =>
    apiClient.post<{ plan: string; onboarding_step: string }>('/auth/select-plan', { plan_id: planId }),

  setupStudio: (data: {
    studio_name: string;
    branch_name?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    timezone?: string;
    currency?: string;
  }) =>
    apiClient.post<LoginResponse>('/auth/setup-studio', data),

  refresh: (refreshToken: string) =>
    apiClient.post<{ access_token: string; refresh_token: string }>('/auth/refresh', { refresh_token: refreshToken }),

  logout: () =>
    apiClient.post('/auth/logout'),

  getOnboardingStatus: () =>
    apiClient.get('/auth/onboarding'),

  getMe: () =>
    apiClient.get<{ user: LoginUser; studio: LoginStudio | null }>('/auth/me'),

  selectWorkspace: (studioId: string, branchId?: string) =>
    apiClient.post<WorkspaceSelectResponse>('/auth/select-workspace', { studio_id: studioId, branch_id: branchId }),
};

// ─── Response Types ──────────────────────────────────────

export interface LoginUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  roles?: { role_name: string; branch_id: string | null; is_primary: boolean }[];
  studio_id?: string;
  branch_ids: string[];
  permission_codes?: string[];
  onboarding_step?: string;
}

export interface LoginStudio {
  id: string;
  name: string;
  slug: string;
  owner_user_id?: string;
  timezone?: string;
  currency?: string;
  logo_url?: string | null;
  account_type?: 'gym';
  subscription_plan?: string;
  [key: string]: unknown;
}

export interface WorkspaceEntry {
  studio_id: string;
  studio_name: string;
  roles: string[];
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  session_id?: string;
  user: LoginUser;
  studio: LoginStudio | null;
  requires_workspace_selection?: boolean;
  workspaces?: WorkspaceEntry[];
  device?: { id: string; is_new_device: boolean };
  // 2FA challenge
  requires_2fa?: boolean;
  temp_token?: string;
}

export interface WorkspaceSelectResponse {
  user: LoginUser;
  studio: LoginStudio;
}

export interface PlanItem {
  id: string;
  name: string;
  price: number;
  billing_period: string;
  features: string[];
  [key: string]: unknown;
}
