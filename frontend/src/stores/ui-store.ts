'use client';

import { create } from 'zustand';

interface UiState {
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  globalSearchOpen: boolean;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarMobileOpen: (open: boolean) => void;
  setGlobalSearchOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  globalSearchOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
  setGlobalSearchOpen: (open) => set({ globalSearchOpen: open }),
}));
