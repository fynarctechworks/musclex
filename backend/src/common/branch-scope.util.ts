import { JwtPayload } from './decorators/current-user.decorator';

export interface BranchScope {
  /** Prisma where-fragment: `{}` = no filter, `{ branch_id: X }`, `{ branch_id: { in: [...] } }`, or `{ branch_id: '__none__' }` */
  branchFilter: Record<string, unknown>;
  /** true when the caller has gym-wide access (owner / brand_owner / any role with branch_id=null) */
  hasGlobalAccess: boolean;
  /** Resolved allowed-branch ids, or 'ALL' when global. Empty array = no access. */
  allowedIds: string[] | 'ALL';
}

const GLOBAL_ROLES: ReadonlySet<string> = new Set(['owner', 'brand_owner']);

/**
 * Resolve the branch-scope for a request. Single source of truth for every
 * service that applies branch-level clamping.
 *
 * Rules:
 *  1. `role === 'owner' | 'brand_owner'` → global, no filter.
 *  2. Any `roles[]` entry with `branch_id === null` → global (role was granted
 *     without a branch, meaning gym-wide).
 *  3. Otherwise clamp to `branch_ids[]`. If empty and not global → fail-closed
 *     with `{ branch_id: '__none__' }`.
 *  4. An explicit `branch_id` query param must be inside the allowed set
 *     (else fail-closed).
 */
export function resolveBranchScope(
  user?: JwtPayload,
  explicitBranchId?: string,
): BranchScope {
  const roleIsGlobal = !!user && GLOBAL_ROLES.has(user.role);
  const hasGlobalRoleEntry = !!user?.roles?.some((r) => r.branch_id === null);
  const isGlobal = !user || roleIsGlobal || hasGlobalRoleEntry;

  if (explicitBranchId) {
    if (!isGlobal && !user?.branch_ids?.includes(explicitBranchId)) {
      return {
        branchFilter: { branch_id: '__none__' },
        hasGlobalAccess: false,
        allowedIds: [],
      };
    }
    return {
      branchFilter: { branch_id: explicitBranchId },
      hasGlobalAccess: isGlobal,
      allowedIds: [explicitBranchId],
    };
  }

  if (isGlobal) {
    return { branchFilter: {}, hasGlobalAccess: true, allowedIds: 'ALL' };
  }

  if (user!.branch_ids?.length) {
    return {
      branchFilter: { branch_id: { in: user!.branch_ids } },
      hasGlobalAccess: false,
      allowedIds: user!.branch_ids,
    };
  }

  return {
    branchFilter: { branch_id: '__none__' },
    hasGlobalAccess: false,
    allowedIds: [],
  };
}

/**
 * Convenience helper for controllers that forward `user_branch_ids` to a service.
 * Returns `undefined` for global-access callers (service should not clamp), or
 * the caller's branch list (possibly empty → service will return no rows).
 */
export function restrictedBranchIdsForUser(user?: JwtPayload): string[] | undefined {
  const scope = resolveBranchScope(user);
  if (scope.hasGlobalAccess) return undefined;
  return scope.allowedIds === 'ALL' ? undefined : scope.allowedIds;
}
