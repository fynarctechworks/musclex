'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  role: string;
}

interface WorkspaceState {
  /** All workspaces the current user has access to */
  workspaces: Workspace[];
  /** Currently active workspace slug */
  activeSlug: string | null;

  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveSlug: (slug: string) => void;
  getActiveWorkspace: () => Workspace | undefined;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeSlug: null,

      setWorkspaces: (workspaces) => set({ workspaces }),
      setActiveSlug: (slug) => set({ activeSlug: slug }),
      getActiveWorkspace: () => {
        const { workspaces, activeSlug } = get();
        return workspaces.find((w) => w.slug === activeSlug);
      },
    }),
    { name: 'workspace-storage' },
  ),
);
