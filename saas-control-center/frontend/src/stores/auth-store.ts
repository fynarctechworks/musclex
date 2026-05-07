import { create } from 'zustand';
import type { Admin } from '@/types';

interface AuthState {
  admin: Admin | null;
  isAuthenticated: boolean;
  setAuth: (admin: Admin, accessToken: string, refreshToken: string) => void;
  updateAdmin: (partial: Partial<Admin>) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  admin: null,
  isAuthenticated: false,

  setAuth: (admin, accessToken, refreshToken) => {
    localStorage.setItem('scc_access_token', accessToken);
    localStorage.setItem('scc_refresh_token', refreshToken);
    localStorage.setItem('scc_admin', JSON.stringify(admin));
    set({ admin, isAuthenticated: true });
  },

  updateAdmin: (partial) => {
    const current = get().admin;
    if (!current) return;
    const updated = { ...current, ...partial };
    localStorage.setItem('scc_admin', JSON.stringify(updated));
    set({ admin: updated });
  },

  logout: () => {
    localStorage.removeItem('scc_access_token');
    localStorage.removeItem('scc_refresh_token');
    localStorage.removeItem('scc_admin');
    set({ admin: null, isAuthenticated: false });
    window.location.href = '/login';
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('scc_access_token');
    const adminStr = localStorage.getItem('scc_admin');
    if (token && adminStr) {
      try {
        set({ admin: JSON.parse(adminStr), isAuthenticated: true });
      } catch {
        set({ admin: null, isAuthenticated: false });
      }
    }
  },
}));
