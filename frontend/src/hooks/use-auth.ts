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

      // Auto-select branch for the logged-in user.
      // - Single-branch users (any role): pin to that branch so all queries scope correctly.
      // - Multi-branch owners: default to "All Branches" (null) for the cross-branch dashboard.
      // - Multi-branch staff/trainer/manager: default to their first assigned branch.
      // (AppLayout re-validates this once /branches loads — it's the source of truth
      //  for whether a "single-branch" gym actually has 1 branch.)
      const isOwner = data.user?.role === 'owner' || data.user?.role === 'brand_owner';
      const userBranchIds = data.user?.branch_ids || data.user?.roles
        ?.filter((r: any) => r.branch_id)
        .map((r: any) => r.branch_id) || [];

      if (userBranchIds.length === 1) {
        useAuthStore.getState().setActiveBranch(userBranchIds[0]);
      } else if (isOwner) {
        useAuthStore.getState().setActiveBranch(null);
      } else if (userBranchIds.length > 0) {
        useAuthStore.getState().setActiveBranch(userBranchIds[0]);
      } else {
        // Clear stale branch from previous user session
        useAuthStore.getState().setActiveBranch(null);
      }

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
          payment: '/onboarding/payment',
          // Legacy support
          select_plan: '/onboarding/subscription',
          setup_studio: '/onboarding/studio-info',
        };
        router.push(stepRoutes[step] || '/onboarding/studio-info');
        return data;
      }

      // Fully onboarded: redirect to the appropriate dashboard
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
    const data = await authApi.getMe();
    updateUser(data.user as unknown as Parameters<typeof setAuth>[0]['user']);
    if (data.studio) updateStudio(data.studio as unknown as Parameters<typeof updateStudio>[0]);
    return data.user;
  }, [updateUser, updateStudio]);

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
