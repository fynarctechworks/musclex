import { AsyncLocalStorage } from 'async_hooks';

/**
 * TENANT ISOLATION — Source of truth for the current request's tenant scope.
 *
 * Dimensions:
 *  - schemaName:       PostgreSQL schema (legacy — kept for backward compat)
 *  - gymId:            The studio UUID — used for gym_id column filtering
 *  - activeBranchId:   The branch the current request is scoped to (from
 *                      X-Active-Branch-Id header). null = no active branch.
 *  - allowedBranchIds: Branches the user may access. 'ALL' for owner/admin roles.
 *  - bypassBranchScope: Set by @CrossBranch() handlers that legitimately need
 *                      gym-wide reads (e.g., owner dashboard branch comparison).
 */

export interface TenantStore {
  schemaName: string;
  gymId: string; // studio UUID — empty string for unauthenticated / public-only requests
  activeBranchId: string | null;
  allowedBranchIds: string[] | 'ALL';
  bypassBranchScope: boolean;
}

export const tenantContext = new AsyncLocalStorage<TenantStore>();

export function getTenantSchema(): string | undefined {
  return tenantContext.getStore()?.schemaName || undefined;
}

export function getTenantGymId(): string | undefined {
  return tenantContext.getStore()?.gymId || undefined;
}

export function getActiveBranchId(): string | null {
  return tenantContext.getStore()?.activeBranchId ?? null;
}

export function getAllowedBranchIds(): string[] | 'ALL' {
  return tenantContext.getStore()?.allowedBranchIds ?? [];
}

export function isBranchScopeBypassed(): boolean {
  return tenantContext.getStore()?.bypassBranchScope ?? false;
}

/**
 * Mutate the current ALS store for the remainder of the request.
 * Used by ActiveBranchInterceptor (which runs AFTER TenantMiddleware set up the store)
 * to populate branch fields once req.user is available.
 */
export function setBranchContext(patch: {
  activeBranchId?: string | null;
  allowedBranchIds?: string[] | 'ALL';
  bypassBranchScope?: boolean;
}): void {
  const store = tenantContext.getStore();
  if (!store) return;
  if (patch.activeBranchId !== undefined) store.activeBranchId = patch.activeBranchId;
  if (patch.allowedBranchIds !== undefined) store.allowedBranchIds = patch.allowedBranchIds;
  if (patch.bypassBranchScope !== undefined) store.bypassBranchScope = patch.bypassBranchScope;
}
