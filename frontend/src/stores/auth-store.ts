'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { attachSentryUserContext, clearSentryUserContext } from '@/lib/sentry-context';

type PermissionModule = string;
type ModuleAction = string;
type PermissionsMap = Record<string, string[]>;

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  studio_id?: string;
  organization_id?: string;
  branch_ids: string[];
  permissions?: PermissionsMap;
  permission_codes?: string[];
  onboarding_step?: string;
  account_type?: 'gym';
}

interface Studio {
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  timezone?: string;
  currency?: string;
  logo_url?: string | null;
  account_type?: 'gym';
  subscription_plan?: string;
}

interface AuthState {
  user: User | null;
  studio: Studio | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  _hasHydrated: boolean;
  activeBranchId: string | null; // null = "All Branches"
  setAuth: (data: {
    user: User;
    studio: Studio | null;
    access_token: string;
    refresh_token: string;
  }) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  updateStudio: (studio: Studio) => void;
  updateUser: (updates: Partial<User>) => void;
  setActiveBranch: (branchId: string | null) => void;
  hasPermission: (module: PermissionModule, action: ModuleAction) => boolean;
  hasAnyPermission: (module: PermissionModule) => boolean;
}

function setAuthCookie(token: string) {
  if (typeof document === 'undefined') return;
  const isSecure = window.location.protocol === 'https:';
  document.cookie = `auth-token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${isSecure ? '; Secure' : ''}`;
}

function removeAuthCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = 'auth-token=; path=/; max-age=0';
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      studio: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: false,
      _hasHydrated: false,
      activeBranchId: null,
      setAuth: (data) => {
        setAuthCookie(data.access_token);
        set({
          user: data.user,
          studio: data.studio,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          isAuthenticated: true,
          loading: false,
        });
        // Fire-and-forget — never block auth on observability.
        attachSentryUserContext({
          userId: data.user.id,
          gymId: data.user.studio_id,
          role: data.user.role,
        }).catch(() => {});
      },
      setLoading: (loading) => set({ loading }),
      logout: () => {
        removeAuthCookie();
        clearSentryUserContext();
        set({
          user: null,
          studio: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          loading: false,
        });
      },
      updateStudio: (studio) => set({ studio }),
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),
      setActiveBranch: (branchId) => set({ activeBranchId: branchId }),
      hasPermission: (module, action) => {
        const state = get();
        if (!state.user) return false;
        const role = state.user.role;
        if (role === 'owner' || role === 'super_admin' || role === 'brand_owner') return true;
        // Check permissions map
        const perms = state.user.permissions?.[module];
        if (Array.isArray(perms) && perms.includes(action)) return true;
        // Check flat permission codes (e.g. "members.create")
        const code = `${module}.${action}`;
        if (state.user.permission_codes?.includes(code)) return true;
        return false;
      },
      hasAnyPermission: (module) => {
        const state = get();
        if (!state.user) return false;
        const role = state.user.role;
        if (role === 'owner' || role === 'super_admin' || role === 'brand_owner') return true;
        const perms = state.user.permissions?.[module];
        if (Array.isArray(perms) && perms.length > 0) return true;
        if (state.user.permission_codes?.some((c) => c.startsWith(`${module}.`))) return true;
        return false;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        studio: state.studio,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        activeBranchId: state.activeBranchId,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ _hasHydrated: true });
      },
    },
  ),
);
