'use client';

import { useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import type { PermissionModule, ModuleAction } from '@/types';

/**
 * Permission-based UI control.
 * Use this to conditionally render buttons, actions, and sections.
 *
 * @example
 * const { can, canAny } = usePermissions();
 * if (can('members', 'delete')) { showDeleteButton(); }
 */
export function usePermissions() {
  const { hasPermission, hasAnyPermission, user } = useAuthStore();

  const can = useCallback(
    (module: PermissionModule, action: ModuleAction) => hasPermission(module, action),
    [hasPermission],
  );

  const canAny = useCallback(
    (module: PermissionModule) => hasAnyPermission(module),
    [hasAnyPermission],
  );

  const isOwner = user?.role === 'owner';
  const isManager = user?.role === 'manager' || isOwner;

  return { can, canAny, isOwner, isManager, role: user?.role };
}
