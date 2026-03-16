'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { authApi } from '@/features/auth';

/**
 * Central auth hook. Provides login, logout, workspace select, and session state.
 * All auth operations go through NestJS (Option A architecture).
 */
export function useAuth() {
  const router = useRouter();
  const { user, studio, isAuthenticated, loading, setAuth, setLoading, logout: clearAuth, updateUser, updateStudio } = useAuthStore();
  const { setWorkspaces, setActiveSlug } = useWorkspaceStore();

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await authApi.login(email, password);

      // 2FA challenge: redirect to verification page
      if (data.requires_2fa && data.temp_token) {
        router.push(`/verify-2fa?token=${encodeURIComponent(data.temp_token)}`);
        return data;
      }

      setAuth({
        user: data.user,
        studio: data.studio,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      // Multi-workspace: redirect to workspace selection
      if (data.requires_workspace_selection && data.workspaces) {
        setWorkspaces(data.workspaces.map((w) => ({
          id: w.studio_id,
          name: w.studio_name,
          slug: '',
          logo_url: null,
          role: w.roles[0] || 'staff',
        })));
        router.push('/workspace-select');
        return data;
      }

      // Still onboarding: redirect to appropriate step
      const step = data.user.onboarding_step;
      if (step && step !== 'complete') {
        const stepRoutes: Record<string, string> = {
          verify_email: '/verify-email',
          studio_info: '/onboarding/studio-info',
          setup_branches: '/onboarding/branches',
          setup_plans: '/onboarding/memberships',
          setup_staff: '/onboarding/staff',
          select_subscription: '/onboarding/subscription',
          // Legacy support
          select_plan: '/onboarding/subscription',
          setup_studio: '/onboarding/studio-info',
        };
        router.push(stepRoutes[step] || '/onboarding/studio-info');
        return data;
      }

      // Fully onboarded: redirect to dashboard
      if (data.studio?.slug) {
        setActiveSlug(data.studio.slug);
        router.push(`/${data.studio.slug}/dashboard`);
      } else {
        router.push('/onboarding/studio-info');
      }
      return data;
    } finally {
      setLoading(false);
    }
  }, [setAuth, setLoading, setWorkspaces, setActiveSlug, router]);

  const selectWorkspace = useCallback(async (studioId: string) => {
    setLoading(true);
    try {
      const data = await authApi.selectWorkspace(studioId);
      updateUser(data.user);
      updateStudio(data.studio);
      setActiveSlug(data.studio.slug);
      router.push(`/${data.studio.slug}/dashboard`);
      return data;
    } finally {
      setLoading(false);
    }
  }, [updateUser, updateStudio, setActiveSlug, setLoading, router]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Logout even if API call fails
    }
    clearAuth();
    router.push('/login');
  }, [clearAuth, router]);

  const refreshProfile = useCallback(async () => {
    const data = await authApi.getOnboardingStatus() as { user: Parameters<typeof setAuth>[0]['user'] };
    updateUser(data.user);
    return data.user;
  }, [updateUser]);

  return {
    user,
    studio,
    isAuthenticated,
    loading,
    login,
    logout,
    selectWorkspace,
    refreshProfile,
  };
}
