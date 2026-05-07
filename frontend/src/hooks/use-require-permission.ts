'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useGymSlug } from '@/lib/hooks/use-gym-slug';

type Mode = 'redirect' | 'deny';

export function useRequirePermission(
  module: string,
  action: string = 'view',
  mode: Mode = 'deny',
): { allowed: boolean; checked: boolean } {
  const router = useRouter();
  const { gymPath } = useGymSlug();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hydrated = useAuthStore((s) => s._hasHydrated);
  const [checked, setChecked] = useState(false);

  const allowed = !!user && hasPermission(module, action);

  useEffect(() => {
    if (!hydrated) return;
    setChecked(true);
    if (!user) return;
    if (!allowed && mode === 'redirect') {
      router.replace(gymPath('/dashboard'));
    }
  }, [hydrated, user, allowed, mode, router, gymPath]);

  return { allowed, checked };
}
