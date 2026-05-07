import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { LoginResponse, Admin, ApiResponse } from '@/types';

// ── Login ────────────────────────────────────────────────────────────────────

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const { data } = await api.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
      return data.data;
    },
    onSuccess: (data) => {
      // If MFA is required, caller handles the mfa_session_token — don't set auth yet
      if (!data.requires_mfa && data.admin && data.access_token && data.refresh_token) {
        setAuth(data.admin, data.access_token, data.refresh_token);
      }
    },
  });
}

// ── MFA: verify TOTP code (step 2) ──────────────────────────────────────────

export function useVerifyMfaLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async (payload: { mfa_session_token: string; totp_code: string }) => {
      const { data } = await api.post<ApiResponse<LoginResponse>>('/auth/mfa/verify-login', payload);
      return data.data;
    },
    onSuccess: (data) => {
      if (data.admin && data.access_token && data.refresh_token) {
        setAuth(data.admin, data.access_token, data.refresh_token);
      }
    },
  });
}

// ── MFA: login via recovery code (lost phone) ────────────────────────────────

export function useRecoveryLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async (payload: { mfa_session_token: string; recovery_code: string }) => {
      const { data } = await api.post<ApiResponse<LoginResponse>>('/auth/mfa/recovery-login', payload);
      return data.data;
    },
    onSuccess: (data) => {
      if (data.admin && data.access_token && data.refresh_token) {
        setAuth(data.admin, data.access_token, data.refresh_token);
      }
    },
  });
}

// ── Forgot / Reset password ──────────────────────────────────────────────────

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await api.post<ApiResponse<{ success: boolean }>>('/auth/forgot-password', { email });
      return data.data;
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (payload: { token: string; new_password: string }) => {
      const { data } = await api.post<ApiResponse<{ success: boolean }>>('/auth/reset-password', payload);
      return data.data;
    },
  });
}

// ── Profile ──────────────────────────────────────────────────────────────────

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Admin>>('/auth/profile');
      return data.data;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const updateAdmin = useAuthStore((s) => s.updateAdmin);
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.patch<ApiResponse<Admin>>('/auth/profile', { name });
      return data.data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(['profile'], updated);
      updateAdmin(updated);
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: { current_password: string; new_password: string }) => {
      const { data } = await api.post<ApiResponse<{ success: boolean }>>('/auth/change-password', payload);
      return data.data;
    },
  });
}

// ── MFA Setup ────────────────────────────────────────────────────────────────

export function useInitMfaSetup() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ApiResponse<{
        secret: string;
        qr_code: string;
        manual_entry_key: string;
        issuer: string;
        account: string;
      }>>('/auth/mfa/setup/init');
      return data.data;
    },
  });
}

export function useConfirmMfaSetup() {
  const qc = useQueryClient();
  const updateAdmin = useAuthStore((s) => s.updateAdmin);
  return useMutation({
    mutationFn: async (totp_code: string) => {
      const { data } = await api.post<ApiResponse<{ success: boolean; backup_codes: string[] }>>(
        '/auth/mfa/setup/confirm',
        { totp_code },
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      updateAdmin({ mfa_enabled: true });
    },
  });
}

export function useDisableMfa() {
  const qc = useQueryClient();
  const updateAdmin = useAuthStore((s) => s.updateAdmin);
  return useMutation({
    mutationFn: async (password: string) => {
      const { data } = await api.post<ApiResponse<{ success: boolean }>>('/auth/mfa/disable', { password });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      updateAdmin({ mfa_enabled: false });
    },
  });
}
