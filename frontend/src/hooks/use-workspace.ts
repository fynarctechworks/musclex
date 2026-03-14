'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useWorkspaceStore } from '@/stores/workspace-store';

/**
 * Workspace-aware navigation. Provides the current gym slug,
 * path builder, and workspace switching.
 */
export function useWorkspace() {
  const params = useParams();
  const router = useRouter();
  const studio = useAuthStore((s) => s.studio);
  const { workspaces, setActiveSlug } = useWorkspaceStore();

  const gymSlug = (params?.gymSlug as string) || studio?.slug || '';

  /** Build a path scoped to the current workspace */
  const gymPath = (path: string) => `/${gymSlug}${path}`;

  /** Switch to a different workspace */
  const switchWorkspace = (slug: string) => {
    setActiveSlug(slug);
    router.push(`/${slug}/dashboard`);
  };

  return {
    gymSlug,
    gymPath,
    studio,
    workspaces,
    switchWorkspace,
  };
}
