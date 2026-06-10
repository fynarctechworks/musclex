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
 * Mutate the current request's tenant (gym) scope for the remainder of the request.
 *
 * Used by the member BFF's TenantContextInterceptor, which runs AFTER the admin
 * TenantMiddleware has already created an (empty) ALS store. Member access tokens
 * do not carry `user_metadata.studio_id`, so TenantMiddleware leaves gymId="".
 * The interceptor resolves the gym from the *verified member JWT* and writes it
 * here — every downstream Prisma query then auto-filters by this gym_id exactly
 * as it does for admin requests.
 *
 * SECURITY: the gymId passed here MUST originate from a verified token claim,
 * never from a client-supplied body/query/header.
 */
export function setTenantContext(patch: {
  gymId?: string;
  schemaName?: string;
}): void {
  const store = tenantContext.getStore();
  if (!store) return;
  if (patch.gymId !== undefined) store.gymId = patch.gymId;
  if (patch.schemaName !== undefined) store.schemaName = patch.schemaName;
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
