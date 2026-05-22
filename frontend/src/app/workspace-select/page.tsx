'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Building2, ChevronRight } from 'lucide-react';
import { Spinner } from '@/components/shared';
import { useAuthStore } from '@/stores/auth-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useAuth } from '@/hooks/use-auth';
import { AuthLayout } from '@/components/auth/auth-layout';

export default function WorkspaceSelectPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const studio = useAuthStore((s) => s.studio);
  const { workspaces } = useWorkspaceStore();
  const { selectWorkspace, loading, logout } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  // If the user already has a studio in auth-store (single-studio owner), go straight to dashboard
  useEffect(() => {
    if (studio?.slug && workspaces.length === 0) {
      router.replace(`/${studio.slug}/dashboard`);
    }
  }, [studio, workspaces, router]);

  // If only one workspace in the list, auto-select it
  useEffect(() => {
    if (workspaces.length === 1) {
      selectWorkspace(workspaces[0].id);
    }
  }, [workspaces, selectWorkspace]);

  if (!isAuthenticated) return null;

  const handleSelect = async (studioId: string) => {
    try {
      await selectWorkspace(studioId);
    } catch {
      // Error handled in the hook
    }
  };

  return (
    <AuthLayout heading="Select your workspace" subheading="Choose which studio to manage.">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" label="Loading workspaces" />
        </div>
      ) : workspaces.length === 0 ? (
        <div className="text-center py-8">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">No workspaces found.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            You may need to be invited to a studio or create a new one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => handleSelect(ws.id)}
              disabled={loading}
              className="w-full flex items-center gap-4 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary hover:bg-canvas-soft group disabled:opacity-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-canvas-soft-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {ws.logo_url ? (
                  <Image
                    src={ws.logo_url}
                    alt={ws.name}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <Building2 className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{ws.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{ws.role}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 text-center">
        <button
          onClick={logout}
          className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </div>
    </AuthLayout>
  );
}
