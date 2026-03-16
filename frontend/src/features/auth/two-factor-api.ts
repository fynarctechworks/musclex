import { apiClient } from '@/services/api-client';

// ─── Types ───────────────────────────────────────────────

export interface TwoFactorSetupResponse {
  qr_code: string; // data:image/png;base64,...
  manual_key: string;
  otpauth_url: string;
}

export interface TwoFactorVerifyResponse {
  enabled: boolean;
  backup_codes: string[];
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
  method: string | null;
}

export interface TwoFactorLoginResponse {
  access_token: string;
  refresh_token: string;
  session_id?: string;
  user: Record<string, unknown>;
  studio: Record<string, unknown> | null;
  requires_workspace_selection?: boolean;
  workspaces?: { studio_id: string; studio_name: string; roles: string[] }[];
}

export interface TwoFactorRecoveryRequestResponse {
  sent: boolean;
}

export interface TwoFactorResetResponse {
  reset: boolean;
}

// ─── API ─────────────────────────────────────────────────

export const twoFactorApi = {
  /** Begin 2FA setup — returns QR code + manual key */
  setup: () =>
    apiClient.post<TwoFactorSetupResponse>('/auth/2fa/setup'),

  /** Verify setup with 6-digit code */
  verifySetup: (code: string) =>
    apiClient.post<TwoFactorVerifyResponse>('/auth/2fa/verify', { code }),

  /** Step-2 login with temp token + code */
  verifyLogin: (tempToken: string, code: string) =>
    apiClient.post<TwoFactorLoginResponse>('/auth/2fa/login', {
      tempToken,
      code,
    }),

  /** Disable 2FA (requires password) */
  disable: (password: string) =>
    apiClient.post<{ disabled: boolean }>('/auth/2fa/disable', { password }),

  /** Get current 2FA status */
  getStatus: () =>
    apiClient.get<TwoFactorStatusResponse>('/auth/2fa/status'),

  /** Request a one-time recovery link for lost authenticator access */
  requestRecovery: (email: string) =>
    apiClient.post<TwoFactorRecoveryRequestResponse>('/auth/recover-2fa', { email }),

  /** Complete reset by recovery token + password confirmation */
  resetWithRecovery: (token: string, password: string) =>
    apiClient.post<TwoFactorResetResponse>('/auth/reset-2fa', { token, password }),
};
